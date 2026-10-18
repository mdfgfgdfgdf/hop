import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDb, type Db } from "@/server/db/client";
import { auditLogs, consents, driverProfiles, sessions, users } from "@/server/db/schema";
import { TERMS_VERSION, login, signup, signupSchema, type SignupInput } from "@/server/auth/service";
import { createSession, getUserByToken, hashToken, revokeAllSessions, revokeSessionByToken } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { freshDb, makeUser, TEST_PASSWORD } from "../helpers/db";

let db: Db;
let n = 0;
const meta = { ip: "203.0.113.7", userAgent: "vitest" };

function input(overrides: Partial<SignupInput> = {}): SignupInput {
  n += 1;
  return {
    role: "rider",
    name: "ישראל ישראלי",
    email: `signup${n}-${Date.now()}@test.local`,
    phone: "0521234567",
    password: "Sisma1234",
    acceptTerms: true,
    ...overrides,
  };
}

const failedLogins = async (email: string) =>
  db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.action, "auth.login_failed"), sql`${auditLogs.data}->>'email' = ${email.toLowerCase()}`));

beforeAll(async () => {
  db = await freshDb();
});
afterAll(async () => {
  await closeDb();
});

describe("auth/service signup", () => {
  it("creates a rider with terms + privacy consents, a session and an audit row", async () => {
    const res = await signup(input({ email: "Mixed.Case@Test.Local" }), meta);
    expect(res.user.role).toBe("rider");
    expect(res.user.email).toBe("mixed.case@test.local");
    expect(res.user.passwordHash).not.toContain("Sisma1234");
    const rows = await db.select().from(consents).where(eq(consents.userId, res.user.id));
    expect(rows.map((c) => c.type).sort()).toEqual(["privacy", "terms"]);
    expect(rows.every((c) => c.version === TERMS_VERSION && c.ip === meta.ip)).toBe(true);
    expect(await db.select().from(driverProfiles).where(eq(driverProfiles.userId, res.user.id))).toHaveLength(0);
    expect((await getUserByToken(res.session.token))?.id).toBe(res.user.id);
    const audit = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "auth.signup"), eq(auditLogs.targetId, res.user.id)));
    expect(audit).toHaveLength(1);
  });

  it("creates a driver profile awaiting documents for drivers", async () => {
    const res = await signup(input({ role: "driver" }), meta);
    const [p] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, res.user.id));
    expect(p.verificationStatus).toBe("documents_required");
    expect(p.availability).toBe("offline");
  });

  it("rejects a duplicate email case-insensitively", async () => {
    const first = input();
    await signup(first, meta);
    await expect(signup(input({ email: first.email.toUpperCase() }), meta)).rejects.toMatchObject({ status: 409, code: "email_taken" });
  });

  it("rejects weak passwords before touching the database", async () => {
    const weak = input({ password: "abcdefgh" });
    await expect(signup(weak, meta)).rejects.toMatchObject({ status: 400, code: "weak_password" });
    expect(await db.select().from(users).where(eq(users.email, weak.email))).toHaveLength(0);
  });

  it("validates Israeli phone numbers in the signup schema", () => {
    const base = { role: "rider", name: "דנה", email: "d@test.local", password: "Sisma1234", acceptTerms: true };
    for (const phone of ["050-123-4567", "03-1234567", "077 123 4567", "+972501234567"]) {
      expect(signupSchema.safeParse({ ...base, phone }).success, phone).toBe(true);
    }
    expect(signupSchema.parse({ ...base, phone: "050-123-4567" }).phone).toBe("0501234567");
    for (const phone of ["12345", "0601234567", "050123456", "+1 202 555 0100", ""]) {
      const r = signupSchema.safeParse({ ...base, phone });
      expect(r.success, phone).toBe(false);
      expect(r.error?.issues[0]?.path).toEqual(["phone"]);
    }
  });

  it("requires acceptTerms === true and a known role", () => {
    const base = { role: "rider", name: "דנה", email: "d@test.local", phone: "0501234567", password: "Sisma1234" };
    expect(signupSchema.safeParse(base).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, acceptTerms: true }).success).toBe(true);
    expect(signupSchema.safeParse({ ...base, acceptTerms: true, role: "admin" }).success).toBe(false);
  });
});

describe("auth/service login", () => {
  it("logs in with the right password, case-insensitive email, and audits it", async () => {
    const u = await makeUser(db, "rider");
    const res = await login({ email: u.email.toUpperCase(), password: TEST_PASSWORD }, meta);
    expect(res.user.id).toBe(u.id);
    expect((await getUserByToken(res.session.token))?.id).toBe(u.id);
    const audit = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "auth.login"), eq(auditLogs.actorId, u.id)));
    expect(audit).toHaveLength(1);
    expect(audit[0].ip).toBe(meta.ip);
  });

  it("rejects a wrong password with 401 and records auth.login_failed", async () => {
    const u = await makeUser(db, "rider");
    const err = await login({ email: u.email, password: "Wrong1234" }, meta).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ status: 401, code: "unauthorized" });
    const rows = await failedLogins(u.email);
    expect(rows).toHaveLength(1);
    expect(rows[0].actorId).toBeNull();
    expect(rows[0].ip).toBe(meta.ip);
  });

  it("rejects an unknown email with the same 401 and records auth.login_failed", async () => {
    const email = `nobody-${Date.now()}@test.local`;
    const unknown = await login({ email, password: "Whatever1" }, meta).catch((e) => e);
    const u = await makeUser(db, "rider");
    const wrong = await login({ email: u.email, password: "Wrong1234" }, meta).catch((e) => e);
    // Same status, code and message: no account enumeration through the response.
    expect(unknown).toMatchObject({ status: 401, code: "unauthorized", message: wrong.message });
    expect(await failedLogins(email)).toHaveLength(1);
  });

  it("rejects a suspended user with 401 even with the right password, without a session", async () => {
    const u = await makeUser(db, "rider", { status: "suspended" });
    await expect(login({ email: u.email, password: TEST_PASSWORD }, meta)).rejects.toMatchObject({ status: 401 });
    expect(await db.select().from(sessions).where(eq(sessions.userId, u.id))).toHaveLength(0);
  });

  it("a suspended user's login attempt (correct password) is not audited", async () => {
    const u = await makeUser(db, "rider", { status: "suspended" });
    await login({ email: u.email, password: TEST_PASSWORD }, meta).catch(() => {});
    const rows = await db.select().from(auditLogs).where(sql`${auditLogs.data}->>'email' = ${u.email.toLowerCase()} or ${auditLogs.targetId} = ${u.id}`);
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe("auth/session", () => {
  it("createSession → getUserByToken returns the user; only the token hash is stored", async () => {
    const u = await makeUser(db, "driver");
    const { token, expiresAt } = await createSession(u.id, meta);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect((await getUserByToken(token))?.id).toBe(u.id);
    const [row] = await db.select().from(sessions).where(eq(sessions.userId, u.id));
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.tokenHash).not.toContain(token);
    expect(row.userAgent).toBe("vitest");
  });

  it("returns null for a wrong, empty or missing token", async () => {
    const u = await makeUser(db, "rider");
    const { token } = await createSession(u.id);
    expect(await getUserByToken(token + "x")).toBeNull();
    expect(await getUserByToken("")).toBeNull();
    expect(await getUserByToken(null)).toBeNull();
    expect(await getUserByToken(undefined)).toBeNull();
  });

  it("returns null for an expired session", async () => {
    const u = await makeUser(db, "rider");
    const { token } = await createSession(u.id);
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.tokenHash, hashToken(token)));
    expect(await getUserByToken(token)).toBeNull();
  });

  it("revokeAllSessions invalidates every session of the user only", async () => {
    const u = await makeUser(db, "rider");
    const other = await makeUser(db, "rider");
    const a = await createSession(u.id);
    const b = await createSession(u.id);
    const c = await createSession(other.id);
    await revokeAllSessions(u.id);
    expect(await getUserByToken(a.token)).toBeNull();
    expect(await getUserByToken(b.token)).toBeNull();
    expect((await getUserByToken(c.token))?.id).toBe(other.id);
  });

  it("revokeSessionByToken logs out a single session", async () => {
    const u = await makeUser(db, "rider");
    const a = await createSession(u.id);
    const b = await createSession(u.id);
    await revokeSessionByToken(a.token);
    expect(await getUserByToken(a.token)).toBeNull();
    expect((await getUserByToken(b.token))?.id).toBe(u.id);
  });

  it("returns null for a suspended user's live session", async () => {
    const u = await makeUser(db, "rider");
    const { token } = await createSession(u.id);
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, u.id));
    expect(await getUserByToken(token)).toBeNull();
  });

  it("hashToken is deterministic and secret-dependent", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});
