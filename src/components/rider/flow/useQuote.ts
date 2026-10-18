"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { QuoteResponse } from "@/lib/types";
import { describeError, type FriendlyError } from "../lib/errors";
import { toQuotePoint, type SelectedPlace } from "./types";

export type QuoteInput = { pickup: SelectedPlace; dropoff: SelectedPlace };
type Result = { id: string; key: string; data?: QuoteResponse; error?: FriendlyError };

export const quoteKey = (i: QuoteInput) =>
  `${i.pickup.lat.toFixed(5)},${i.pickup.lng.toFixed(5)},${i.pickup.address}|${i.dropoff.lat.toFixed(5)},${i.dropoff.lng.toFixed(5)},${i.dropoff.address}`;

/**
 * Quotes for the current pickup/dropoff. Keeps the previous prices visible
 * while refreshing, refreshes automatically shortly before they expire, and
 * validates promo codes before applying them.
 */
export function useQuote(input: QuoteInput | null) {
  const key = input ? quoteKey(input) : null;
  const [promo, setPromo] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<Result | null>(null);
  const requestId = key ? `${key}#${promo ?? ""}#${nonce}` : null;

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    if (!input || !key || !requestId) return;
    if (resultRef.current?.id === requestId) return; // already loaded (e.g. by applyPromo)
    let cancelled = false;
    api.quotes
      .create({ pickup: toQuotePoint(input.pickup), dropoff: toQuotePoint(input.dropoff), promoCode: promo })
      .then((data) => {
        if (!cancelled) setResult({ id: requestId, key, data });
      })
      .catch((err) => {
        if (cancelled) return;
        setResult((prev) => ({ id: requestId, key, error: describeError(err), data: prev?.key === key ? prev.data : undefined }));
      });
    return () => {
      cancelled = true;
    };
  }, [input, key, promo, requestId]);

  const data = result && result.key === key ? result.data : undefined;
  const error = result && result.id === requestId ? result.error ?? null : null;
  const loading = requestId != null && result?.id !== requestId;

  // Auto-refresh a few seconds before the quote expires.
  const expiresAt = data?.quotes[0]?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const ms = Date.parse(expiresAt) - Date.now() - 5000;
    const t = setTimeout(() => setNonce((n) => n + 1), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [expiresAt]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  /** Validates the code by quoting with it; returns an error when invalid. */
  const applyPromo = useCallback(
    async (code: string): Promise<FriendlyError | null> => {
      if (!input || !key) return null;
      const clean = code.trim().toUpperCase();
      try {
        const res = await api.quotes.create({ pickup: toQuotePoint(input.pickup), dropoff: toQuotePoint(input.dropoff), promoCode: clean });
        const id = `${key}#${clean}#${nonce}`;
        const next = { id, key, data: res };
        resultRef.current = next;
        setResult(next);
        setPromo(clean);
        return null;
      } catch (err) {
        return describeError(err);
      }
    },
    [input, key, nonce],
  );

  const clearPromo = useCallback(() => setPromo(null), []);

  return { data, error, loading, refreshing: loading && data != null, promo, refresh, applyPromo, clearPromo };
}
