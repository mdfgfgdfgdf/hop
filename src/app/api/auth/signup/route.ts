import { created, parseBody, route } from "@/server/api";
import { signup, signupSchema } from "@/server/auth/service";
import { setSessionCookie } from "@/server/auth/session";
import { publicUser } from "@/server/auth/guards";
import { clientIp, rateLimit } from "@/server/security/rate-limit";

export const POST = route(async (req) => {
  rateLimit(`signup:${clientIp(req)}`, 10, 15 * 60_000);
  const input = await parseBody(req, signupSchema);
  const { user, session } = await signup(input, { ip: clientIp(req), userAgent: req.headers.get("user-agent") });
  await setSessionCookie(session.token, session.expiresAt);
  return created({ user: publicUser(user) });
});
