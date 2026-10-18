import { asc } from "drizzle-orm";
import { ok, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { serviceTypes } from "@/server/db/schema";
import { serializeServiceType } from "@/server/dispatch/serialize";

/** Enabled + legally approved types by default; `?all=1` includes disabled/unapproved ones (shown greyed out with the reason). */
export const GET = route(async (req) => {
  const db = await getDb();
  const all = new URL(req.url).searchParams.get("all") === "1";
  const rows = await db.select().from(serviceTypes).orderBy(asc(serviceTypes.sortOrder));
  return ok({ serviceTypes: rows.filter((r) => all || (r.enabled && r.legalStatus === "approved")).map(serializeServiceType) });
});
