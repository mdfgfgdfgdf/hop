import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { homeFor } from "@/server/auth/redirects";
import { isDemoMode } from "@/server/env";
import { getProfile } from "@/server/driver/service";
import { serializeDriverProfile } from "@/server/dispatch/serialize";
import { DriverShell } from "@/components/app/DriverShell";

export const dynamic = "force-dynamic";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/drive");
  if (user.role !== "driver") redirect(homeFor(user.role));
  const profile = await getProfile(user.id)
    .then(serializeDriverProfile)
    .catch(() => null);
  return (
    <DriverShell demoMode={isDemoMode()} initialProfile={profile}>
      {children}
    </DriverShell>
  );
}
