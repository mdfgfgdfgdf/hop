import { z } from "zod";
import { ok, parseQuery, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { listUsers } from "@/server/admin/service";

const schema = z.object({
  role: z.enum(["rider", "driver", "admin", "support"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const GET = route(async (req) => {
  await requireStaff();
  return ok({ users: await listUsers(parseQuery(req, schema)) });
});
