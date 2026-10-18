import { ok, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { deletePlace } from "@/server/places/service";

export const DELETE = route<{ id: string }>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return ok(await deletePlace(user.id, id));
});
