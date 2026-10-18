"use client";
/**
 * Single source of truth for the rider's active ride across every /ride page.
 * - fetches /api/rides/active on mount, on every ride/notification SSE event
 * and on reconnect (driver.location pings only move the car)
 * - polls every 4s while a ride is live (SSE is only a hint)
 * - keeps the driver's live position from `driver.location` events
 * - when the active ride disappears, loads its final state so the UI can show
 *   the receipt / cancellation summary
 * One SSE connection is shared with other rider screens via `useRiderEvents`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { RideDTO, SseEvent } from "@/lib/types";

export type DriverPos = { lat: number; lng: number; heading: number | null; at: number };
type LivePos = DriverPos & { rideId: string };

type Ctx = {
  ride: RideDTO | null;
  loaded: boolean;
  /** Last ride that ended while this session was watching it. */
  endedRide: RideDTO | null;
  driverPos: DriverPos | null;
  connected: boolean;
  refresh: () => void;
  adoptRide: (ride: RideDTO) => void;
  /** The ride ended from this client (e.g. rider cancelled); optionally show its summary. */
  markEnded: (ride: RideDTO, showSummary: boolean) => void;
  clearEnded: () => void;
  subscribe: (fn: (e: SseEvent) => void) => () => void;
};

const ActiveRideContext = createContext<Ctx | null>(null);
const LIVE: RideDTO["status"][] = ["requested", "searching", "offered", "accepted", "driver_arriving", "in_progress"];
const POLL_MS = 4000;

export function ActiveRideProvider({ children }: { children: React.ReactNode }) {
  const [ride, setRide] = useState<RideDTO | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [endedRide, setEndedRide] = useState<RideDTO | null>(null);
  const [livePos, setLivePos] = useState<LivePos | null>(null);
  const listeners = useRef(new Set<(e: SseEvent) => void>());
  const seq = useRef(0);
  const inflight = useRef(false);
  const again = useRef(false);
  const lastRideId = useRef<string | null>(null);

  const finish = useCallback(async (id: string) => {
    try {
      const { ride: finalRide } = await api.rides.get(id);
      if (LIVE.includes(finalRide.status)) return finalRide;
      setEndedRide(finalRide);
      return null;
    } catch {
      return null;
    }
  }, []);

  const loadOnce = useCallback(async () => {
    const mySeq = ++seq.current;
    try {
      const res = await api.rides.active();
      if (mySeq !== seq.current) return;
      let next = res.ride;
      if (!next && lastRideId.current) {
        const prev = lastRideId.current;
        lastRideId.current = null;
        next = await finish(prev);
        if (mySeq !== seq.current) return;
      }
      if (next) {
        lastRideId.current = next.id;
        setEndedRide(null);
      }
      setRide(next);
      setLoaded(true);
    } catch {
      // keep last known state; polling / reconnect will retry
      if (mySeq === seq.current) setLoaded(true);
    }
  }, [finish]);

  /** Coalesces concurrent requests: at most one in flight, one queued. */
  const refresh = useCallback(async () => {
    if (inflight.current) {
      again.current = true;
      return;
    }
    inflight.current = true;
    try {
      do {
        again.current = false;
        await loadOnce();
      } while (again.current);
    } finally {
      inflight.current = false;
    }
  }, [loadOnce]);

  const adoptRide = useCallback((r: RideDTO) => {
    seq.current++;
    lastRideId.current = r.id;
    setEndedRide(null);
    setRide(r);
    setLoaded(true);
  }, []);

  const markEnded = useCallback((r: RideDTO, showSummary: boolean) => {
    seq.current++;
    lastRideId.current = null;
    setRide(null);
    setEndedRide(showSummary ? r : null);
    setLoaded(true);
  }, []);

  const clearEnded = useCallback(() => setEndedRide(null), []);

  const { connected } = useRealtime({
    onEvent: (e) => {
      if (e.type === "driver.location") {
        const d = e.data as { rideId?: string; lat?: number; lng?: number; heading?: number | null; at?: string };
        if (typeof d.lat === "number" && typeof d.lng === "number" && d.rideId && d.rideId === lastRideId.current) {
          setLivePos({ rideId: d.rideId, lat: d.lat, lng: d.lng, heading: d.heading ?? null, at: d.at ? Date.parse(d.at) : Date.now() });
        }
      } else if (e.type !== "ping") {
        // Location pings only move the car (the 4s poll keeps the rest fresh);
        // re-fetching on each one would hammer the API.
        void refresh();
      }
      listeners.current.forEach((fn) => fn(e));
    },
    onReconnect: () => void refresh(),
  });

  // Initial load (async; state is set in the promise callbacks).
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Polling fallback while a ride is live.
  const live = ride != null && LIVE.includes(ride.status);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [live, refresh]);

  // Refresh when the tab becomes visible again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const subscribe = useCallback((fn: (e: SseEvent) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  // Newest of SSE position and the server's last known location.
  const driverPos = useMemo<DriverPos | null>(() => {
    const loc = ride?.driver?.location;
    const fromRide = loc ? { lat: loc.lat, lng: loc.lng, heading: loc.heading, at: Date.parse(loc.at) } : null;
    const fromLive = livePos && ride && livePos.rideId === ride.id ? livePos : null;
    if (fromRide && fromLive) return fromLive.at >= fromRide.at ? fromLive : fromRide;
    return fromLive ?? fromRide;
  }, [ride, livePos]);

  const value = useMemo<Ctx>(
    () => ({ ride, loaded, endedRide, driverPos, connected, refresh: () => void refresh(), adoptRide, markEnded, clearEnded, subscribe }),
    [ride, loaded, endedRide, driverPos, connected, refresh, adoptRide, markEnded, clearEnded, subscribe],
  );
  return <ActiveRideContext.Provider value={value}>{children}</ActiveRideContext.Provider>;
}

export function useActiveRide() {
  const ctx = useContext(ActiveRideContext);
  if (!ctx) throw new Error("useActiveRide must be used within ActiveRideProvider");
  return ctx;
}

/** Subscribe to the shared SSE stream (e.g. support ticket replies). */
export function useRiderEvents(handler: (e: SseEvent) => void) {
  const { subscribe } = useActiveRide();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => subscribe((e) => ref.current(e)), [subscribe]);
}

export function isLive(ride: RideDTO | null | undefined) {
  return ride != null && LIVE.includes(ride.status);
}
