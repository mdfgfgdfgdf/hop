import type { UserRole } from "../db/schema";

/** Where each role lands after login. */
export function homeFor(role: UserRole) {
  switch (role) {
    case "driver":
      return "/drive";
    case "admin":
    case "support":
      return "/admin";
    default:
      return "/ride";
  }
}
