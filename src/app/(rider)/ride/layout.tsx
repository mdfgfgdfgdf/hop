import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { homeFor } from "@/server/auth/redirects";
import { isDemoMode } from "@/server/env";
import { RiderShell } from "@/components/app/RiderShell";

export const dynamic = "force-dynamic";

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/ride");
  if (user.role !== "rider") redirect(homeFor(user.role));
  return (
    <RiderShell demoMode={isDemoMode()} userName={user.name}>
      {children}
    </RiderShell>
  );
}
