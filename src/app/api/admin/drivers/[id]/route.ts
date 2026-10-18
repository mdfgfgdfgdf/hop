import { ok, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { getDriver } from "@/server/admin/service";

export const GET = route<{ id: string }>(async (_req, ctx) => {
  await requireStaff();
  const { id } = await ctx.params;
  return ok(await getDriver(id));
});
