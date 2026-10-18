import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireAdmin, requireStaff } from "@/server/auth/guards";
import { getPricing, updatePricing } from "@/server/admin/service";
import { clientIp } from "@/server/security/rate-limit";

export const GET = route(async () => {
  await requireStaff();
  return ok(await getPricing());
});

const int = z.number().int().min(0).max(10_000_000);
const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  isDemo: z.boolean().optional(),
  baseFareAgorot: int.optional(),
  perKmAgorot: int.optional(),
  perMinuteAgorot: int.optional(),
  bookingFeeAgorot: int.optional(),
  minFareAgorot: int.optional(),
  maxFareAgorot: int.optional(),
  commissionPercentBp: z.number().int().min(0).max(5000).optional(),
  commissionFixedAgorot: int.optional(),
  cancellationFeeAgorot: int.optional(),
  freeCancelWindowSec: z.number().int().min(0).max(3600).optional(),
  nightMultiplierBp: z.number().int().min(10000).max(30000).optional(),
  nightStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  nightEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  roundingAgorot: z.number().int().min(1).max(100).optional(),
  quoteTtlSec: z.number().int().min(30).max(3600).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const PUT = route(async (req) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, schema);
  return ok({ active: await updatePricing(admin, input, clientIp(req)) });
});
