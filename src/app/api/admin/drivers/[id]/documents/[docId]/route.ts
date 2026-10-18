import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { reviewDocument } from "@/server/admin/service";
import { clientIp } from "@/server/security/rate-limit";

const schema = z.object({ status: z.enum(["approved", "rejected"]), notes: z.string().trim().max(500).optional().nullable() });

export const POST = route<{ id: string; docId: string }>(async (req, ctx) => {
  const staff = await requireStaff();
  const { id, docId } = await ctx.params;
  const input = await parseBody(req, schema);
  return ok({ document: await reviewDocument(staff, id, docId, { ...input, ip: clientIp(req) }) });
});
