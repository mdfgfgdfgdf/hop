import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { adjustRide } from "@/server/admin/service";
import { getRideDTO } from "@/server/dispatch/service";
import { clientIp } from "@/server/security/rate-limit";

const schema = z.object({ refundAgorot: z.number().int().min(0).max(1_000_000).optional(), note: z.string().trim().min(2).max(500) });

export const POST = route<{ id: string }>(async (req, ctx) => {
  const staff = await requireStaff();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  await adjustRide(staff, id, { ...input, ip: clientIp(req) });
  return ok({ ride: await getRideDTO(id, staff) });
});
