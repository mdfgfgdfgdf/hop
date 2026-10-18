import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getProfile } from "@/server/driver/service";
import { DriveHome } from "@/components/driver/DriveHome";

export const dynamic = "force-dynamic";
export const metadata = { title: "נהיגה" };

export default async function DrivePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/drive");
  const profile = await getProfile(user.id).catch(() => null);
  if (!profile || profile.verificationStatus !== "approved") redirect("/drive/onboarding");
  return <DriveHome />;
}
