import type { User, UserRole } from "../db/schema";
import { forbidden, unauthorized } from "../errors";
import { getCurrentUser } from "./session";

export type Principal = User;

/**
 * Resolves the current user and enforces roles. Admins never implicitly gain
 * rider/driver privileges — a role list is always explicit.
 */
export async function requireUser(roles?: UserRole[]): Promise<Principal> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (roles && roles.length > 0 && !roles.includes(user.role)) throw forbidden();
  return user;
}

export const requireRider = () => requireUser(["rider"]);
export const requireDriver = () => requireUser(["driver"]);
/** Operators: admins and support staff. */
export const requireStaff = () => requireUser(["admin", "support"]);
export const requireAdmin = () => requireUser(["admin"]);

export const isStaff = (u: Pick<User, "role">) => u.role === "admin" || u.role === "support";

export function publicUser(u: User) {
  return {
    id: u.id,
    role: u.role,
    status: u.status,
    name: u.name,
    email: u.email,
    phone: u.phone,
    locale: u.locale,
    isDemo: u.isDemo,
    createdAt: u.createdAt.toISOString(),
  };
}
export type PublicUser = ReturnType<typeof publicUser>;
