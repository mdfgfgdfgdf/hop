import { z } from "zod";
import { created, ok, parseBody, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { listMessages, MESSAGE_MAX_CHARS, sendMessage } from "@/server/rides/extras";
import { rateLimit } from "@/server/security/rate-limit";

const schema = z.object({ body: z.string().min(1).max(MESSAGE_MAX_CHARS * 2) });

/** Rider ↔ driver chat of a ride (staff may read for safety reviews). */
export const GET = route<{ id: string }>(async (_req, ctx) => {
  const user = await requireUser(["rider", "driver", "admin", "support"]);
  const { id } = await ctx.params;
  return ok({ messages: await listMessages({ actor: user, rideId: id }) });
});

export const POST = route<{ id: string }>(async (req, ctx) => {
  const user = await requireUser(["rider", "driver"]);
  rateLimit(`chat:${user.id}`, 20, 60_000);
  const { id } = await ctx.params;
  const { body } = await parseBody(req, schema);
  return created({ message: await sendMessage({ actor: user, rideId: id, body }) });
});
