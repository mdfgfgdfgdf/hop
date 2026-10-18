import { ok, route } from "@/server/api";
import { dbKind, getDb } from "@/server/db/client";
import { env, isDemoMode } from "@/server/env";

export const GET = route(async () => {
  await getDb();
  return ok({ status: "ok", db: dbKind(), demoMode: isDemoMode(), geoProvider: env().GEO_PROVIDER, time: new Date().toISOString() });
});
