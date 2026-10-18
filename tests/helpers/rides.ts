/**
 * Service-layer shortcuts for integration tests: book a ride from a fresh
 * quote and walk a driver through the lifecycle.
 */
import type { User } from "@/server/db/schema";
import {
  completeRide,
  createQuotes,
  createRide,
  driverArrived,
  driverArriving,
  respondToOffer,
  startRide,
} from "@/server/dispatch/service";

type Pt = { lat: number; lng: number; address: string };

export async function bookRide(
  rider: User,
  pickup: Pt,
  dropoff: Pt,
  opts: { serviceTypeId?: string; paymentMethod?: "cash" | "card_demo"; promoCode?: string } = {},
) {
  const q = await createQuotes({ rider, pickup, dropoff, promoCode: opts.promoCode ?? null });
  const quote = q.quotes.find((x) => x.serviceType.id === (opts.serviceTypeId ?? "taxi"));
  if (!quote) throw new Error(`no quote for ${opts.serviceTypeId ?? "taxi"}`);
  const ride = await createRide({ rider, quoteId: quote.id, paymentMethod: opts.paymentMethod ?? "cash" });
  return { quotes: q, quote, ride };
}

/** accept → arriving → arrived → start. */
export async function acceptAndStart(driver: User, rideId: string) {
  await respondToOffer({ driver, rideId, accept: true });
  await driverArriving({ driver, rideId });
  await driverArrived({ driver, rideId });
  return startRide({ driver, rideId });
}

/** accept → … → complete. */
export async function driveToCompletion(driver: User, rideId: string) {
  await acceptAndStart(driver, rideId);
  return completeRide({ driver, rideId });
}
