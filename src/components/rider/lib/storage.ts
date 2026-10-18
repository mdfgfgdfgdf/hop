"use client";
/**
 * Tiny localStorage-backed stores (recent destinations, payment preference)
 * exposed through useSyncExternalStore so SSR renders the empty default and
 * every tab stays in sync.
 */
import { useSyncExternalStore } from "react";
import type { PlaceDTO } from "@/lib/types";

type Store<T> = { get: () => T; set: (v: T) => void; subscribe: (cb: () => void) => () => void; serverValue: T };

function createStore<T>(key: string, fallback: T, validate: (raw: unknown) => T): Store<T> {
  let cacheRaw: string | null | undefined;
  let cacheVal: T = fallback;
  const listeners = new Set<() => void>();

  const read = (): T => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }
    if (raw === cacheRaw) return cacheVal;
    cacheRaw = raw;
    try {
      cacheVal = raw ? validate(JSON.parse(raw)) : fallback;
    } catch {
      cacheVal = fallback;
    }
    return cacheVal;
  };

  return {
    get: read,
    serverValue: fallback,
    set: (v) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* storage full / private mode — keep in memory only */
        cacheRaw = JSON.stringify(v);
        cacheVal = v;
      }
      listeners.forEach((l) => l());
    },
    subscribe: (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) cb();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}

function useStore<T>(store: Store<T>) {
  return useSyncExternalStore(store.subscribe, store.get, () => store.serverValue);
}

// ───────────────────────────── recent destinations ─────────────────────────────

export type RecentPlace = Pick<PlaceDTO, "id" | "name" | "address" | "lat" | "lng" | "kind" | "provider">;
const EMPTY_RECENTS: RecentPlace[] = [];
const MAX_RECENTS = 6;

function isPlace(x: unknown): x is RecentPlace {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return typeof p.name === "string" && typeof p.address === "string" && typeof p.lat === "number" && typeof p.lng === "number";
}

const recentsStore = createStore<RecentPlace[]>("hop.rider.recents.v1", EMPTY_RECENTS, (raw) =>
  Array.isArray(raw) ? raw.filter(isPlace).slice(0, MAX_RECENTS) : EMPTY_RECENTS,
);

export function useRecents() {
  return useStore(recentsStore);
}

export function addRecent(place: RecentPlace) {
  const current = recentsStore.get();
  const key = (p: RecentPlace) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  const next = [
    { id: place.id, name: place.name, address: place.address, lat: place.lat, lng: place.lng, kind: place.kind, provider: place.provider },
    ...current.filter((p) => key(p) !== key(place) && p.name !== place.name),
  ].slice(0, MAX_RECENTS);
  recentsStore.set(next);
}

export function clearRecents() {
  recentsStore.set([]);
}

// ───────────────────────────── payment preference ─────────────────────────────

export type PaymentMethod = "cash" | "card_demo";
const paymentStore = createStore<PaymentMethod>("hop.rider.payment.v1", "cash", (raw) => (raw === "card_demo" ? "card_demo" : "cash"));

export function usePaymentPreference() {
  return useStore(paymentStore);
}

export function setPaymentPreference(v: PaymentMethod) {
  paymentStore.set(v);
}
