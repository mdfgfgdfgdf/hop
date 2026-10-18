import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireAdmin, requireStaff } from "@/server/auth/guards";
import { getUser, setUserRole, setUserStatus } from "@/server/admin/service";
import { clientIp } from "@/server/security/rate-limit";

export const GET = route<{ id: string }>(async (_req, ctx) => {
  await requireStaff();
  const { id } = await ctx.params;
  return ok(await getUser(id));
});

const schema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  reason: z.string().trim().max(300).optional().nullable(),
  role: z.enum(["rider", "driver", "admin", "support"]).optional(),
});

export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  let user;
  if (input.role) {
    const admin = await requireAdmin();
    user = await setUserRole(admin, id, input.role, clientIp(req));
  }
  if (input.status) {
    const staff = await requireStaff();
    user = await setUserStatus(staff, id, { status: input.status, reason: input.reason ?? null, ip: clientIp(req) });
  }
  if (!user) await requireStaff();
  return ok({ user: user ?? (await getUser(id)).user });
});
