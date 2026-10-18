"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True once the component has hydrated on the client (false during SSR and the first paint). */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
