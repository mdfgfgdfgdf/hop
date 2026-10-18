/** Client-safe copy of role → home mapping. */
export function homeForRole(role: "rider" | "driver" | "admin" | "support") {
  return role === "driver" ? "/drive" : role === "admin" || role === "support" ? "/admin" : "/ride";
}
