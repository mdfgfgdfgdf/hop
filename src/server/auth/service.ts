import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { consents, driverProfiles, users, type User } from "../db/schema";
import { badRequest, conflict, unauthorized } from "../errors";
import { audit } from "../audit";
import { hashPassword, validatePasswordStrength, verifyPassword } from "./password";
import { createSession } from "./session";

export const TERMS_VERSION = "2026-10-pilot-v1";

const phoneRe = /^0(5\d|[2-4]|[7-9]\d?)\d{7}$|^\+972\d{8,9}$/;

export const signupSchema = z.object({
  role: z.enum(["rider", "driver"]),
  name: z.string().trim().min(2, "נא להזין שם מלא").max(80),
  email: z.string().trim().email("כתובת אימייל אינה תקינה").max(120),
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .refine((s) => phoneRe.test(s), "מספר טלפון ישראלי אינו תקין"),
  password: z.string().min(8).max(128),
  acceptTerms: z.literal(true, { error: "יש לאשר את תנאי השימוש ומדיניות הפרטיות" }),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function signup(input: SignupInput, meta: { ip?: string | null; userAgent?: string | null }) {
  const weak = validatePasswordStrength(input.password);
  if (weak) throw badRequest("weak_password", weak);
  const db = await getDb();
  const email = input.email.toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  if (existing.length) throw conflict("email_taken", "כתובת האימייל כבר רשומה במערכת");

  const user = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ role: input.role, name: input.name, email, phone: input.phone, passwordHash: await hashPassword(input.password) })
      .returning();
    await tx.insert(consents).values([
      { userId: u.id, type: "terms", version: TERMS_VERSION, ip: meta.ip ?? null },
      { userId: u.id, type: "privacy", version: TERMS_VERSION, ip: meta.ip ?? null },
    ]);
    if (input.role === "driver") {
      await tx.insert(driverProfiles).values({ userId: u.id, verificationStatus: "documents_required" });
    }
    return u;
  });
  await audit({ actorId: user.id, actorRole: user.role, action: "auth.signup", targetType: "user", targetId: user.id, ip: meta.ip });
  const session = await createSession(user.id, meta);
  return { user, session };
}

export async function login(input: z.infer<typeof loginSchema>, meta: { ip?: string | null; userAgent?: string | null }) {
  const db = await getDb();
  const email = input.email.toLowerCase();
  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  const okPassword = user ? await verifyPassword(user.passwordHash, input.password) : false;
  if (!user || !okPassword) {
    await audit({ action: "auth.login_failed", data: { email }, ip: meta.ip });
    throw unauthorized("אימייל או סיסמה שגויים");
  }
  if (user.status === "suspended") throw unauthorized("החשבון הושעה. פנו לתמיכה.");
  const session = await createSession(user.id, meta);
  await audit({ actorId: user.id, actorRole: user.role, action: "auth.login", targetType: "user", targetId: user.id, ip: meta.ip });
  return { user: user as User, session };
}
