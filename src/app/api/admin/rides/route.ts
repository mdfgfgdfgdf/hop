import { z } from "zod";
import { ok, parseQuery, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { listRides } from "@/server/admin/service";

const schema = z.object({
  status: z.string().max(20).optional(),
  flagged: z.enum(["true", "false"]).optional(),
  q: z.string().trim().max(80).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const GET = route(async (req) => {
  await requireStaff();
  const q = parseQuery(req, schema);
  const rides = await listRides({ status: q.status, flagged: q.flagged === "true", q: q.q, from: q.from ? new Date(q.from) : undefined, to: q.to ? new Date(q.to) : undefined, limit: q.limit });
  return ok({ rides });
});
