import { ok, parseBody, route } from "@/server/api";
import { login, loginSchema } from "@/server/auth/service";
import { setSessionCookie } from "@/server/auth/session";
import { publicUser } from "@/server/auth/guards";
import { clientIp, rateLimit } from "@/server/security/rate-limit";

export const POST = route(async (req) => {
  rateLimit(`login:${clientIp(req)}`, 20, 15 * 60_000);
  const input = await parseBody(req, loginSchema);
  const { user, session } = await login(input, { ip: clientIp(req), userAgent: req.headers.get("user-agent") });
  await setSessionCookie(session.token, session.expiresAt);
  return ok({ user: publicUser(user) });
});
