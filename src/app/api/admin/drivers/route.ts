import { z } from "zod";
import { ok, parseQuery, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { listDrivers } from "@/server/admin/service";

const schema = z.object({
  status: z.enum(["documents_required", "under_review", "approved", "rejected", "suspended"]).optional(),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const GET = route(async (req) => {
  await requireStaff();
  return ok({ drivers: await listDrivers(parseQuery(req, schema)) });
});
