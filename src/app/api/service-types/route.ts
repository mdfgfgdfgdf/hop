import { asc } from "drizzle-orm";
import { ok, route } from "@/server/api";
import { getDb } from "@/server/db/client";
import { serviceTypes } from "@/server/db/schema";
import { serializeServiceType } from "@/server/dispatch/serialize";

export const GET = route(async () => {
  const db = await getDb();
  const rows = await db.select().from(serviceTypes).orderBy(asc(serviceTypes.sortOrder));
  return ok({ serviceTypes: rows.filter((r) => r.enabled && r.legalStatus === "approved").map(serializeServiceType) });
});
