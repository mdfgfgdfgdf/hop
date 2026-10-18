import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireDriver } from "@/server/auth/guards";
import { updateDriverLocation } from "@/server/dispatch/service";
import { rateLimit } from "@/server/security/rate-limit";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional().nullable(),
  speedMps: z.number().min(0).max(100).optional().nullable(),
});

export const POST = route(async (req) => {
  const driver = await requireDriver();
  rateLimit(`loc:${driver.id}`, 120, 60_000);
  const input = await parseBody(req, schema);
  await updateDriverLocation({ driver, ...input });
  return ok({ ok: true });
});
