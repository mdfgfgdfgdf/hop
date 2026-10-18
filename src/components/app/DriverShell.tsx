"use client";
import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import type { DriverProfileDTO } from "@/lib/types";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { DriverRuntimeProvider } from "@/components/driver/DriverRuntime";
import { OfferOverlay } from "@/components/driver/OfferOverlay";
import { ActiveRidePill } from "@/components/driver/ActiveRidePill";

/**
 * Driver app chrome: dark theme (night-friendly), full-bleed content, and the
 * driver runtime (location reporting, offers, active ride) that must keep
 * running across every /drive page.
 */
export function DriverShell({ children, demoMode, initialProfile = null }: { children: React.ReactNode; demoMode: boolean; initialProfile?: DriverProfileDTO | null }) {
  // Toasts and other root-level portals live outside this subtree; put the
  // whole document in the night theme while the driver app is mounted.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.dataset.theme;
    root.dataset.theme = "dark";
    return () => {
      if (prev) root.dataset.theme = prev;
      else delete root.dataset.theme;
    };
  }, []);
  return (
    <div data-theme="dark" data-app="driver" className="relative flex min-h-dvh flex-col bg-bg text-fg">
      <MotionConfig reducedMotion="user">
        {demoMode && (
          <div className="pointer-events-none fixed top-2 left-1/2 z-50 -translate-x-1/2 safe-top">
            {/* DemoBanner's own text colour keys off prefers-color-scheme; force the dark-theme colour. */}
            <DemoBanner compact className="whitespace-nowrap text-amber-200! backdrop-blur-md" />
          </div>
        )}
        <DriverRuntimeProvider initialProfile={initialProfile} demoMode={demoMode}>
          {children}
          <ActiveRidePill />
          <OfferOverlay />
        </DriverRuntimeProvider>
      </MotionConfig>
    </div>
  );
}
