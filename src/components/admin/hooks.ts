"use client";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";
import type { PublicUserDTO } from "@/lib/types";

export function errorMessage(err: unknown, fallback = "משהו השתבש. נסו שוב בעוד רגע.") {
  if (err instanceof ApiClientError) {
    if (err.status === 403) return "אין לכם הרשאה לפעולה הזו (דורש הרשאת מנהל).";
    return err.message || fallback;
  }
  return fallback;
}

type LoadState<T> = { key: string | null; tick: number; data: T | undefined; error: string | null };

export type Loaded<T> = {
  data: T | undefined;
  error: string | null;
  /** First load for this key (nothing to show yet). */
  loading: boolean;
  /** A newer request (key change or reload) is in flight while older data is shown. */
  refreshing: boolean;
  reload: () => void;
  mutate: (fn: (d: T) => T) => void;
};

/**
 * Minimal data loader: re-runs when `key` changes or `reload()` is called,
 * keeps the previous data visible while refreshing (no skeleton flash), and
 * ignores out-of-order responses. Pass `null` as key to skip loading.
 */
export function useLoad<T>(key: string | null, fn: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<LoadState<T>>({ key: null, tick: -1, data: undefined, error: null });
  const [tick, setTick] = useState(0);
  const run = useEffectEvent(fn);

  useEffect(() => {
    if (key === null) return;
    let active = true;
    run().then(
      (data) => {
        if (active) setState({ key, tick, data, error: null });
      },
      (err: unknown) => {
        if (active) setState((p) => ({ ...p, key, tick, error: errorMessage(err) }));
      },
    );
    return () => {
      active = false;
    };
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const mutate = useCallback((f: (d: T) => T) => setState((p) => (p.data === undefined ? p : { ...p, data: f(p.data) })), []);
  const settled = state.key === key && state.tick === tick;
  return {
    data: state.data,
    error: settled ? state.error : null,
    loading: state.data === undefined && !(settled && state.error),
    refreshing: !settled && state.data !== undefined,
    reload,
    mutate,
  };
}

export function useDebouncedValue<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Returns a stable function that calls `fn` once things go quiet for `ms`. */
export function useDebouncedCallback(fn: () => void, ms = 800) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current(), ms);
  }, [ms]);
}

/** URL-backed filters (so overview cards can deep-link into filtered lists). */
export function useQueryParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") p.delete(k);
        else p.set(k, v);
      }
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, router, pathname],
  );
  return [params, set] as const;
}

// ───────────── staff directory (names for ticket authors, audit actors, tariff editors) ─────────────

export type StaffEntry = Pick<PublicUserDTO, "id" | "name" | "role" | "email">;
let staffPromise: Promise<Map<string, StaffEntry>> | null = null;

function loadStaff() {
  if (!staffPromise) {
    staffPromise = Promise.all([api.admin.users({ role: "admin", limit: 200 }), api.admin.users({ role: "support", limit: 200 })])
      .then(([a, s]) => new Map([...a.users, ...s.users].map((u) => [u.id, { id: u.id, name: u.name, role: u.role, email: u.email }])))
      .catch((err) => {
        staffPromise = null;
        throw err;
      });
  }
  return staffPromise;
}

export function useStaffDirectory() {
  const [map, setMap] = useState<Map<string, StaffEntry>>(() => new Map());
  useEffect(() => {
    let active = true;
    loadStaff().then(
      (m) => active && setMap(m),
      () => {},
    );
    return () => {
      active = false;
    };
  }, []);
  return map;
}

/** Local-date helpers for <input type="date"> ↔ ISO range boundaries. */
export function dateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDayIso(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

export function endOfDayIso(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

export function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}
