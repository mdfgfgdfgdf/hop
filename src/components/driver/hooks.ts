"use client";
/** Driver-app hooks: clock, geolocation watch, location reporting, media queries. */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api, ApiClientError } from "@/lib/api";
import { haversineM } from "./geo";

/** A ticking clock (ms since epoch). Returns 0 until the first tick on the client. */
export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [intervalMs, enabled]);
  return now;
}

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  };
}

/** `true` on ≥ lg screens (desktop layout: map + side panel). */
export function useIsDesktop() {
  const query = "(min-width: 1024px)";
  return useSyncExternalStore(
    subscribeMedia(query),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export type GeoStatus = "off" | "locating" | "ok" | "denied" | "unavailable" | "unsupported";
export type DriverPosition = { lat: number; lng: number; heading: number | null; speedMps: number | null; accuracy: number | null; at: number };

function toPosition(p: GeolocationPosition): DriverPosition {
  const { latitude, longitude, heading, speed, accuracy } = p.coords;
  return {
    lat: latitude,
    lng: longitude,
    heading: heading != null && Number.isFinite(heading) && heading >= 0 && heading <= 360 ? heading : null,
    speedMps: speed != null && Number.isFinite(speed) && speed >= 0 ? Math.min(speed, 100) : null,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    at: p.timestamp || Date.now(),
  };
}

/**
 * Watches the device position while `enabled`. Status distinguishes a denied
 * permission (needs the user to change browser settings) from a temporary
 * lack of signal.
 */
export function useGeolocation(enabled: boolean) {
  const [status, setStatus] = useState<GeoStatus>("off");
  const [position, setPosition] = useState<DriverPosition | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const t = setTimeout(() => setStatus("unsupported"), 0);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "ok" ? s : "locating"));
    }, 0);
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (cancelled) return;
        setPosition(toPosition(p));
        setStatus("ok");
      },
      (err) => {
        if (cancelled) return;
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else if (err.code === err.POSITION_UNAVAILABLE) setStatus("unavailable");
        // TIMEOUT: keep the last known state; the watch keeps trying.
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
      navigator.geolocation.clearWatch(id);
    };
  }, [enabled, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  /** One-shot fix, used when going online before the watch delivered a position. */
  const getOnce = useCallback(
    () =>
      new Promise<DriverPosition>((resolve, reject) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          reject(new Error("unsupported"));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const pos = toPosition(p);
            setPosition(pos);
            setStatus("ok");
            resolve(pos);
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) setStatus("denied");
            reject(err);
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
        );
      }),
    [],
  );

  return { status: enabled ? status : ("off" as GeoStatus), position, retry, getOnce };
}

/**
 * While `enabled`, POSTs the latest position every `intervalMs` and right away
 * on significant movement (≥ 30 m, throttled), so dispatch always sees a fresh
 * location. Backs off on rate limiting.
 */
export function useLocationReporter(position: DriverPosition | null, enabled: boolean, intervalMs = 5000) {
  const latest = useRef<DriverPosition | null>(position);
  const lastSent = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const inFlight = useRef(false);
  const backoffUntil = useRef(0);
  const [failing, setFailing] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  const send = useCallback(async () => {
    const p = latest.current;
    if (!p || inFlight.current || Date.now() < backoffUntil.current) return;
    inFlight.current = true;
    try {
      await api.driver.location({ lat: p.lat, lng: p.lng, heading: p.heading, speedMps: p.speedMps });
      const at = Date.now();
      lastSent.current = { lat: p.lat, lng: p.lng, at };
      setLastSentAt(at);
      setFailing(false);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "rate_limited") backoffUntil.current = Date.now() + 15_000;
      else setFailing(true);
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Keep the ref fresh and push immediately on significant movement.
  useEffect(() => {
    latest.current = position;
    if (!enabled || !position) return;
    const last = lastSent.current;
    if (!last || (haversineM(last, position) >= 30 && Date.now() - last.at > 2000)) void send();
  }, [position, enabled, send]);

  useEffect(() => {
    if (!enabled) return;
    const first = setTimeout(() => void send(), 0);
    const id = setInterval(() => void send(), intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [enabled, intervalMs, send]);

  return { failing: enabled && failing, lastSentAt };
}

/** Observes an element's height (callback ref + value). */
export function useElementHeight<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.borderBoxSize?.[0]?.blockSize ?? entries[0]?.contentRect.height ?? 0;
      setHeight(Math.round(h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, height] as const;
}
