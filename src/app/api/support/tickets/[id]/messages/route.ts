import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { addMessage } from "@/server/support/service";

const schema = z.object({ body: z.string().trim().min(1).max(3000), internal: z.boolean().optional() });

export const POST = route<{ id: string }>(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  return ok({ ticket: await addMessage(user, id, input.body, input.internal ?? false) });
});
