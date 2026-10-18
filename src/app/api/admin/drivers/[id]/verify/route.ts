import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { verifyDriver } from "@/server/admin/service";
import { clientIp } from "@/server/security/rate-limit";

const schema = z.object({
  decision: z.enum(["approve", "reject", "suspend", "reinstate"]),
  reason: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const POST = route<{ id: string }>(async (req, ctx) => {
  const staff = await requireStaff();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  return ok({ profile: await verifyDriver(staff, id, { ...input, ip: clientIp(req) }) });
});
