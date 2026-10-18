/**
 * In-process realtime event bus. Channels:
 *   user:{userId}  — everything relevant to one user (ride updates, offers)
 *   ride:{rideId}  — ride specific (location pings, status)
 *   admin          — platform wide feed for the operator dashboard
 *
 * Consumers are SSE streams (see /api/events). Single-instance by design;
 * replace with Redis pub/sub or a managed broker when scaling out.
 */
import { EventEmitter } from "node:events";

export type RealtimeEvent = {
  id: string;
  type:
    | "ride.updated"
    | "ride.offer"
    | "ride.offer.cancelled"
    | "ride.message"
    | "ride.tip"
    | "driver.location"
    | "driver.availability"
    | "admin.ride"
    | "admin.driver"
    | "notification"
    | "ping";
  at: string;
  data: unknown;
};

const g = globalThis as unknown as { __hopBus?: EventEmitter; __hopSeq?: number };
const emitter = (g.__hopBus ??= new EventEmitter());
emitter.setMaxListeners(1000);

function nextId() {
  g.__hopSeq = (g.__hopSeq ?? 0) + 1;
  return `${Date.now().toString(36)}-${g.__hopSeq.toString(36)}`;
}

export function publish(channel: string, type: RealtimeEvent["type"], data: unknown) {
  const event: RealtimeEvent = { id: nextId(), type, at: new Date().toISOString(), data };
  emitter.emit(channel, event);
  return event;
}

export function subscribe(channels: string[], handler: (e: RealtimeEvent) => void) {
  for (const ch of channels) emitter.on(ch, handler);
  return () => {
    for (const ch of channels) emitter.off(ch, handler);
  };
}

export const channels = {
  user: (id: string) => `user:${id}`,
  ride: (id: string) => `ride:${id}`,
  admin: "admin",
};
