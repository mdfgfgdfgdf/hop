import { cookies } from "next/headers";
import { ok, route } from "@/server/api";
import { SESSION_COOKIE, clearSessionCookie, revokeSessionByToken } from "@/server/auth/session";

export const POST = route(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionByToken(token);
  await clearSessionCookie();
  return ok({ ok: true });
});
