import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { homeFor } from "@/server/auth/redirects";
import { isDemoMode } from "@/server/env";
import { AdminShell } from "@/components/app/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin" && user.role !== "support") redirect(homeFor(user.role));
  return (
    <AdminShell demoMode={isDemoMode()} role={user.role} name={user.name}>
      {children}
    </AdminShell>
  );
}
