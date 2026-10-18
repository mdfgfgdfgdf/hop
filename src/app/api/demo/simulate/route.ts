import { ok, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { isDemoMode } from "@/server/env";
import { notFound } from "@/server/errors";
import { sweep } from "@/server/dispatch/scheduler";

/** Runs one scheduler/demo-autopilot tick on demand (demo mode only). */
export const POST = route(async () => {
  if (!isDemoMode()) throw notFound();
  await requireUser();
  await sweep();
  return ok({ ok: true });
});
