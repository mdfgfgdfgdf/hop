"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LatLng, PlaceDTO } from "@/lib/types";
import { describeError, isAbort, type FriendlyError } from "../lib/errors";

type Result = { key: string; place: PlaceDTO | null; error?: FriendlyError };

const keyOf = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

/** Reverse-geocodes a point; `loading` is true until the current point resolves. */
export function useReverseGeocode(point: LatLng | null) {
  const key = point ? keyOf(point) : null;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!key) return;
    const [lat, lng] = key.split(",").map(Number);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api.geo
        .reverse(lat, lng, ctrl.signal)
        .then((r) => setResult({ key, place: r.place }))
        .catch((err) => {
          if (!isAbort(err)) setResult({ key, place: null, error: describeError(err) });
        });
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [key]);

  const current = result && result.key === key ? result : null;
  return { place: current?.place ?? null, error: current?.error ?? null, loading: key != null && current == null };
}
