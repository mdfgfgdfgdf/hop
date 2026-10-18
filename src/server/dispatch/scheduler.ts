/**
 * Background sweep: expires stale offers, retries matching for rides still
 * searching, and (in demo mode) drives the simulated drivers. Runs as a
 * single interval per process; every API call can also call `sweep()` so a
 * lost timer never strands a ride.
 */
import { and, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "../db/client";
import { rides } from "../db/schema";
import { isDemoMode } from "../env";
import { expireOffer, runMatching } from "./service";

const g = globalThis as unknown as { __hopScheduler?: NodeJS.Timeout; __hopSweeping?: boolean };

export async function sweep() {
  if (g.__hopSweeping) return;
  g.__hopSweeping = true;
  try {
    const db = await getDb();
    const now = new Date();
    const expired = await db
      .select({ id: rides.id })
      .from(rides)
      .where(and(eq(rides.status, "offered"), lt(rides.offerExpiresAt, now)));
    for (const r of expired) await expireOffer(r.id).catch((e) => console.error("[sweep] expire", e));

    const searching = await db
      .select({ id: rides.id })
      .from(rides)
      .where(inArray(rides.status, ["searching", "requested"]));
    for (const r of searching) await runMatching(r.id).catch((e) => console.error("[sweep] match", e));

    if (isDemoMode()) {
      const { simulateDemoDrivers } = await import("../demo/simulator");
      await simulateDemoDrivers().catch((e) => console.error("[sweep] demo", e));
    }
  } finally {
    g.__hopSweeping = false;
  }
}

export function ensureScheduler(intervalMs = 2500) {
  if (g.__hopScheduler) return;
  g.__hopScheduler = setInterval(() => {
    sweep().catch((e) => console.error("[scheduler]", e));
  }, intervalMs);
  g.__hopScheduler.unref?.();
}

export function stopScheduler() {
  if (g.__hopScheduler) clearInterval(g.__hopScheduler);
  g.__hopScheduler = undefined;
}
