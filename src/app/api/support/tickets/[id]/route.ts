import { ok, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { getTicket } from "@/server/support/service";

export const GET = route<{ id: string }>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return ok({ ticket: await getTicket(user, id) });
});
