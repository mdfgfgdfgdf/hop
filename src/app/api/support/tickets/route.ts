import { z } from "zod";
import { created, ok, parseBody, parseQuery, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { createTicket, getTicket, listTicketsFor } from "@/server/support/service";
import { rateLimit } from "@/server/security/rate-limit";

const createSchema = z.object({
  rideId: z.string().optional().nullable(),
  category: z.enum(["complaint", "safety", "lost_item", "payment", "incident", "other"]),
  subject: z.string().trim().min(3).max(120),
  body: z.string().trim().min(5).max(3000),
});

export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`ticket:${user.id}`, 10, 60 * 60_000);
  const input = await parseBody(req, createSchema);
  const t = await createTicket(user, input);
  return created({ ticket: await getTicket(user, t.id) });
});

const listSchema = z.object({ status: z.enum(["open", "in_progress", "resolved", "closed"]).optional() });

export const GET = route(async (req) => {
  const user = await requireUser();
  const q = parseQuery(req, listSchema);
  return ok({ tickets: await listTicketsFor(user, q) });
});
