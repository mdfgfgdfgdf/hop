"use client";
/**
 * useRealtime — subscribes to /api/events (SSE) with automatic reconnection
 * and a staleness watchdog. On every (re)connect `onReconnect` fires so the
 * caller can re-fetch authoritative state; events are best-effort hints.
 */
import { useEffect, useEffectEvent, useState } from "react";
import type { SseEvent } from "./types";

type Handler = (e: SseEvent) => void;

export function useRealtime(opts: { onEvent?: Handler; onReconnect?: () => void; enabled?: boolean } = {}) {
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const onEvent = useEffectEvent((e: SseEvent) => opts.onEvent?.(e));
  const onReconnect = useEffectEvent(() => opts.onReconnect?.());

  useEffect(() => {
    if (opts.enabled === false) return;
    let es: EventSource | null = null;
    let closed = false;
    let lastSeen = Date.now();
    let hadConnection = false;
    let watchdog: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      es?.close();
      es = new EventSource("/api/events");
      es.onopen = () => {
        setConnected(true);
        lastSeen = Date.now();
        if (hadConnection) onReconnect();
        hadConnection = true;
      };
      es.onerror = () => {
        setConnected(false);
        // EventSource retries by itself; the watchdog recreates it if it stalls.
      };
      const onMessage = (ev: MessageEvent) => {
        lastSeen = Date.now();
        setLastEventAt(lastSeen);
        try {
          const parsed = JSON.parse(ev.data) as SseEvent;
          if (parsed.type !== "ping") onEvent(parsed);
        } catch {
          /* ignore malformed */
        }
      };
      for (const t of ["ping", "ride.updated", "ride.offer", "ride.offer.cancelled", "driver.location", "driver.availability", "admin.ride", "admin.driver", "notification"]) {
        es.addEventListener(t, onMessage as EventListener);
      }
    };

    connect();
    watchdog = setInterval(() => {
      if (Date.now() - lastSeen > 45_000) {
        setConnected(false);
        retryTimer = setTimeout(connect, 500);
      }
    }, 10_000);

    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSeen > 20_000) connect();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      closed = true;
      es?.close();
      if (watchdog) clearInterval(watchdog);
      if (retryTimer) clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [opts.enabled]);

  return { connected, lastEventAt };
}
