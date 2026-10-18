import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { getTicket, updateTicket } from "@/server/support/service";

export const GET = route<{ id: string }>(async (_req, ctx) => {
  const staff = await requireStaff();
  const { id } = await ctx.params;
  return ok({ ticket: await getTicket(staff, id) });
});

const schema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedTo: z.string().optional().nullable(),
});

export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const staff = await requireStaff();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  return ok({ ticket: await updateTicket(staff, id, input) });
});
