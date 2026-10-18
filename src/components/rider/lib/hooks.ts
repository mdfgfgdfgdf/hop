"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { LatLng } from "@/lib/types";
import { TEL_AVIV_CENTER } from "./geo";

/** Wall-clock that re-renders every `intervalMs` (client only). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");

/** window.innerHeight, kept in sync on resize (800 during SSR). */
export function useViewportHeight() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("resize", cb);
      return () => window.removeEventListener("resize", cb);
    },
    () => window.innerHeight,
    () => 800,
  );
}

export type GeoState = { status: "pending" | "ok" | "approx"; pos: LatLng };

/** Current position with a Tel Aviv fallback (status "approx"). */
export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({ status: "pending", pos: TEL_AVIV_CENTER });
  useEffect(() => {
    let cancelled = false;
    const fallback = () => {
      if (!cancelled) setState((s) => (s.status === "ok" ? s : { status: "approx", pos: TEL_AVIV_CENTER }));
    };
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const t = setTimeout(fallback, 0);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(fallback, 9000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        if (!cancelled) setState({ status: "ok", pos: { lat: p.coords.latitude, lng: p.coords.longitude } });
      },
      () => {
        clearTimeout(timer);
        fallback();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
  return state;
}

/** Observe an element's rendered height (e.g. the bottom sheet) for map padding. */
export function useElementHeight(el: Element | null) {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const border = entry.borderBoxSize?.[0]?.blockSize;
      setH(Math.round(border ?? entry.contentRect.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return h;
}

/** Time-of-day greeting; null during SSR to avoid hydration mismatch. */
export function useGreeting() {
  return useSyncExternalStore(
    () => () => {},
    () => {
      const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date()));
      if (h >= 5 && h < 12) return "בוקר טוב";
      if (h >= 12 && h < 17) return "צהריים טובים";
      if (h >= 17 && h < 22) return "ערב טוב";
      return "לילה טוב";
    },
    () => "שלום",
  );
}

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
