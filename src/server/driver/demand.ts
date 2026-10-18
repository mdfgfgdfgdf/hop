/**
 * Where riders are asking for rides: real ride requests from the last hour,
 * bucketed into ~600 m cells. No rider identities, counts only, and cells with
 * a single request are dropped so one person's pickup cannot be singled out.
 */
import { gte } from "drizzle-orm";
import { getDb } from "../db/client";
import { rides } from "../db/schema";
import type { DemandCellDTO } from "@/lib/types";

const WINDOW_MS = 60 * 60_000;
const CELL_LAT = 0.0055; // ≈ 600 m
const CELL_LNG = 0.0065; // ≈ 600 m at 32°N

export async function demandCells(now = new Date()): Promise<DemandCellDTO[]> {
  const db = await getDb();
  const rows = await db
    .select({ lat: rides.pickupLat, lng: rides.pickupLng })
    .from(rides)
    .where(gte(rides.requestedAt, new Date(now.getTime() - WINDOW_MS)));
  const cells = new Map<string, { i: number; j: number; n: number }>();
  for (const r of rows) {
    const i = Math.floor(r.lat / CELL_LAT);
    const j = Math.floor(r.lng / CELL_LNG);
    const k = `${i}:${j}`;
    const c = cells.get(k) ?? { i, j, n: 0 };
    c.n++;
    cells.set(k, c);
  }
  return [...cells.values()]
    .filter((c) => c.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, 40)
    .map((c) => ({ lat: Math.round((c.i + 0.5) * CELL_LAT * 1e5) / 1e5, lng: Math.round((c.j + 0.5) * CELL_LNG * 1e5) / 1e5, requests: c.n }));
}
