import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireDriver } from "@/server/auth/guards";
import { setDriverAvailability } from "@/server/dispatch/service";
import { serializeDriverProfile } from "@/server/dispatch/serialize";
import { sweep } from "@/server/dispatch/scheduler";

const schema = z.object({
  online: z.boolean(),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional().nullable(),
});

export const POST = route(async (req) => {
  const driver = await requireDriver();
  const input = await parseBody(req, schema);
  const profile = await setDriverAvailability({ driver, online: input.online, location: input.location ?? null });
  if (input.online) sweep().catch(() => {});
  return ok({ profile: serializeDriverProfile(profile) });
});
