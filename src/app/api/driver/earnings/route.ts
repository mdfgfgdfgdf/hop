import { z } from "zod";
import { ok, parseQuery, route } from "@/server/api";
import { requireDriver } from "@/server/auth/guards";
import { earnings } from "@/server/driver/service";

const schema = z.object({
  range: z.enum(["today", "week", "month", "all"]).default("week"),
});

export const GET = route(async (req) => {
  const driver = await requireDriver();
  const { range } = parseQuery(req, schema);
  const to = new Date();
  const from = new Date(to);
  if (range === "today") from.setHours(0, 0, 0, 0);
  else if (range === "week") from.setDate(from.getDate() - 7);
  else if (range === "month") from.setDate(from.getDate() - 30);
  else from.setFullYear(2000);
  return ok({ earnings: await earnings(driver.id, { from, to }) });
});
