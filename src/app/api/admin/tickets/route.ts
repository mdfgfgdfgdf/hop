import { z } from "zod";
import { ok, parseQuery, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { listTicketsFor } from "@/server/support/service";

const schema = z.object({ status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(), limit: z.coerce.number().int().min(1).max(500).default(100) });

export const GET = route(async (req) => {
  const staff = await requireStaff();
  return ok({ tickets: await listTicketsFor(staff, parseQuery(req, schema)) });
});
