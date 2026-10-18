/**
 * Cookie sessions. The raw token lives only in the httpOnly cookie; the
 * database stores a SHA-256 hash, so a database leak does not leak sessions.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getDb } from "../db/client";
import { sessions, users, type User } from "../db/schema";
import { env, isProduction } from "../env";

export const SESSION_COOKIE = "hop_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function hashToken(token: string) {
  return createHash("sha256")
    .update(token + env().HOP_SESSION_SECRET)
    .digest("hex");
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
    lastSeenAt: new Date(),
  });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function revokeSessionByToken(token: string) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function revokeAllSessions(userId: string) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function getUserByToken(token: string | undefined | null): Promise<User | null> {
  if (!token) return null;
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.user.status === "suspended") return null;
  // Touch lastSeenAt at most once a minute (cheap heartbeat for admin tooling).
  const last = row.session.lastSeenAt?.getTime() ?? 0;
  if (now.getTime() - last > 60_000) {
    db.update(sessions)
      .set({ lastSeenAt: now })
      .where(eq(sessions.id, row.session.id))
      .catch(() => {});
  }
  return row.user;
}

/** Current user for server components and route handlers (null if anonymous). */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  return getUserByToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requestMeta() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
  };
}
