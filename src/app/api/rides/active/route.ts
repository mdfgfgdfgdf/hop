import { ok, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { getActiveRideFor } from "@/server/dispatch/service";
import { sweep } from "@/server/dispatch/scheduler";

export const GET = route(async () => {
  const user = await requireUser(["rider", "driver"]);
  await sweep();
  const ride = await getActiveRideFor(user);
  return ok({ ride });
});
