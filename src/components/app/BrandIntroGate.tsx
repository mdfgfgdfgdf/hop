"use client";
/** Shows the animated HOP intro once per session on first entry to an app route. */
import { usePathname } from "next/navigation";
import { BrandIntro } from "@/components/brand/BrandIntro";

export function BrandIntroGate() {
  const pathname = usePathname();
  const isRider = pathname.startsWith("/ride");
  const isDriver = pathname.startsWith("/drive");
  if (!isRider && !isDriver) return null;
  return <BrandIntro theme={isDriver ? "dark" : "light"} />;
}
