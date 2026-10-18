import { z } from "zod";
import { ok, parseQuery, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { report } from "@/server/admin/service";

const schema = z.object({ from: z.string().optional(), to: z.string().optional() });

export const GET = route(async (req) => {
  await requireStaff();
  const q = parseQuery(req, schema);
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 86_400_000);
  return ok(await report({ from, to }));
});
