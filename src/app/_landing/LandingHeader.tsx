"use client";
/** Landing header: white and quiet; a hairline and soft shadow appear once the page scrolls. */
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnimatedLogo } from "@/components/brand/AnimatedLogo";
import { cn } from "@/components/ui/cn";

function subscribeScroll(cb: () => void) {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
}
const useScrolled = () => useSyncExternalStore(subscribeScroll, () => window.scrollY > 8, () => false);

const NAV = [
  { href: "#options", label: "נסיעות" },
  { href: "#safety", label: "בטיחות" },
  { href: "#price", label: "מחיר" },
  { href: "#drive", label: "נהגים" },
  { href: "#faq", label: "שאלות" },
] as const;

export function LandingHeader({ appHref }: { appHref: string | null }) {
  const scrolled = useScrolled();
  return (
    <header className={cn("lp-header", scrolled && "is-scrolled")}>
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="HOP — דף הבית" className="lp-logo-link flex items-center rounded-xl">
            <AnimatedLogo height={26} hopOn="hover" title="HOP" />
          </Link>
          <nav aria-label="בעמוד הזה" className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="lp-nav-link">
                {n.label}
              </a>
            ))}
          </nav>
        </div>
        <nav aria-label="חשבון" className="flex items-center gap-1.5 sm:gap-2">
          {appHref ? (
            <Link href={appHref} className="btn btn-ink btn-sm">
              המשך לאפליקציה
              <ArrowLeft size={16} aria-hidden />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                התחברות
              </Link>
              <Link href="/signup" className="btn btn-ink btn-sm">
                הרשמה
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
