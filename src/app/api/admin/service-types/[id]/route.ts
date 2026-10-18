import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireAdmin } from "@/server/auth/guards";
import { updateServiceType } from "@/server/admin/service";
import { clientIp } from "@/server/security/rate-limit";

const schema = z.object({
  enabled: z.boolean().optional(),
  nameHe: z.string().trim().min(2).max(60).optional(),
  descriptionHe: z.string().trim().max(200).optional(),
  priceMultiplierBp: z.number().int().min(5000).max(40000).optional(),
  vehicleClasses: z.array(z.enum(["standard", "xl", "premium", "accessible"])).optional(),
  seats: z.number().int().min(1).max(8).optional(),
  sortOrder: z.number().int().min(0).max(100).optional(),
  legalStatus: z.enum(["approved", "requires_regulatory_approval"]).optional(),
});

export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  return ok({ serviceType: await updateServiceType(admin, id, input, clientIp(req)) });
});
