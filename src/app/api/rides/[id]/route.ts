import { ok, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { getRideDTO } from "@/server/dispatch/service";

export const GET = route<{ id: string }>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const ride = await getRideDTO(id, user);
  return ok({ ride });
});
