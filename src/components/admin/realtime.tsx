"use client";
/**
 * One SSE connection for the whole dashboard, fanned out to any screen that
 * subscribes with `useAdminFeed`. Events are hints: screens re-fetch the
 * authoritative state (debounced) when something relevant happens.
 */
import { createContext, useContext, useEffect, useEffectEvent, useMemo, useState } from "react";
import { useRealtime } from "@/lib/realtime";
import type { SseEvent } from "@/lib/types";

export type AdminFeedEvent = SseEvent | { type: "reconnect"; id: string; at: string; data: null };
type Listener = (e: AdminFeedEvent) => void;

function createBus() {
  const listeners = new Set<Listener>();
  return {
    emit(e: AdminFeedEvent) {
      for (const l of listeners) l(e);
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

type Bus = ReturnType<typeof createBus>;
type FeedContextValue = { connected: boolean; lastEventAt: number | null; bus: Bus };

const FeedContext = createContext<FeedContextValue | null>(null);

export function AdminRealtimeProvider({ children }: { children: React.ReactNode }) {
  const [bus] = useState(createBus);
  const { connected, lastEventAt } = useRealtime({
    onEvent: (e) => bus.emit(e),
    onReconnect: () => bus.emit({ type: "reconnect", id: "reconnect", at: new Date().toISOString(), data: null }),
  });
  const value = useMemo(() => ({ connected, lastEventAt, bus }), [connected, lastEventAt, bus]);
  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeedStatus() {
  const ctx = useContext(FeedContext);
  return { connected: ctx?.connected ?? false, lastEventAt: ctx?.lastEventAt ?? null };
}

/** Subscribe to the admin feed for the lifetime of the component. */
export function useAdminFeed(handler: (e: AdminFeedEvent) => void) {
  const ctx = useContext(FeedContext);
  const onEvent = useEffectEvent(handler);
  const bus = ctx?.bus;
  useEffect(() => {
    if (!bus) return;
    return bus.subscribe((e) => onEvent(e));
  }, [bus]);
}

// ───────────── typed readers for event payloads (data is `unknown` on the wire) ─────────────

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

export function readDriverLocation(e: AdminFeedEvent) {
  if (e.type !== "driver.location") return null;
  const d = obj(e.data);
  if (!d || typeof d.driverId !== "string" || typeof d.lat !== "number" || typeof d.lng !== "number") return null;
  return { driverId: d.driverId, lat: d.lat, lng: d.lng, heading: typeof d.heading === "number" ? d.heading : null, at: typeof d.at === "string" ? d.at : e.at };
}

export function readAdminDriver(e: AdminFeedEvent) {
  if (e.type !== "admin.driver") return null;
  const d = obj(e.data);
  if (!d || typeof d.driverId !== "string") return null;
  const availability: "online" | "busy" | "offline" | null = d.availability === "online" || d.availability === "busy" || d.availability === "offline" ? d.availability : null;
  return { driverId: d.driverId, availability, verificationStatus: typeof d.verificationStatus === "string" ? d.verificationStatus : null };
}

export function readAdminRide(e: AdminFeedEvent) {
  if (e.type !== "admin.ride") return null;
  const d = obj(e.data);
  if (!d || typeof d.rideId !== "string") return null;
  return { rideId: d.rideId, status: typeof d.status === "string" ? d.status : null };
}

export function readNotification(e: AdminFeedEvent) {
  if (e.type !== "notification") return null;
  const d = obj(e.data);
  if (!d || typeof d.kind !== "string") return null;
  return { kind: d.kind, ticketId: typeof d.ticketId === "string" ? d.ticketId : null, priority: typeof d.priority === "string" ? d.priority : null };
}
