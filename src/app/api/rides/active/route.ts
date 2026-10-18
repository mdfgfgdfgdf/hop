import { ok, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { getActiveRideFor } from "@/server/dispatch/service";
import { ensureScheduler } from "@/server/dispatch/scheduler";

export const GET = route(async () => {
  const user = await requireUser(["rider", "driver"]);
  ensureScheduler(); // reads never advance dispatch; the background sweep does
  const ride = await getActiveRideFor(user);
  return ok({ ride });
});
