import { z } from "zod";
import { ok, parseQuery, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { listAuditLogs } from "@/server/admin/service";

const schema = z.object({ action: z.string().max(60).optional(), actorId: z.string().max(60).optional(), limit: z.coerce.number().int().min(1).max(1000).default(200) });

export const GET = route(async (req) => {
  await requireStaff();
  return ok({ logs: await listAuditLogs(parseQuery(req, schema)) });
});
