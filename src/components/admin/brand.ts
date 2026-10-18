"use client";
/**
 * Lets admin screens tell the shell's living logo that data is being
 * (re)fetched, so the sidebar wordmark revs its needle while it happens.
 */
import { useEffect, useState, useSyncExternalStore } from "react";

const busy = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Marks `key` as busy while `on` is true (and clears it on unmount). */
export function useReportBusy(key: string, on: boolean) {
  useEffect(() => {
    if (!on) return;
    busy.add(key);
    notify();
    return () => {
      busy.delete(key);
      notify();
    };
  }, [key, on]);
}

/** True while any screen reports busy, and for `holdMs` after, so a quick refetch still reads as one gauge sweep. */
export function useBrandBusy(holdMs = 1100) {
  const raw = useSyncExternalStore(subscribe, () => busy.size > 0, () => false);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!raw) return;
    const t = setTimeout(() => setHeld(true), 0);
    return () => clearTimeout(t);
  }, [raw]);
  useEffect(() => {
    if (!held || raw) return;
    const t = setTimeout(() => setHeld(false), holdMs);
    return () => clearTimeout(t);
  }, [held, raw, holdMs]);
  return raw || held;
}
