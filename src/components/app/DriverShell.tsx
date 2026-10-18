"use client";
import { MotionConfig } from "motion/react";
import type { DriverProfileDTO } from "@/lib/types";
import { DriverRuntimeProvider } from "@/components/driver/DriverRuntime";
import { OfferOverlay } from "@/components/driver/OfferOverlay";
import { ActiveRidePill } from "@/components/driver/ActiveRidePill";

/**
 * Driver app chrome: the same blue-and-white liquid-glass theme as the rider
 * app, full-bleed content, and the driver runtime (location reporting,
 * offers, active ride) that must keep running across every /drive page.
 * The demo label lives in each page's glass top bar (as in the rider app).
 */
export function DriverShell({ children, demoMode, initialProfile = null }: { children: React.ReactNode; demoMode: boolean; initialProfile?: DriverProfileDTO | null }) {
  return (
    <div data-theme="light" data-app="driver" className="relative flex min-h-dvh flex-col bg-bg text-fg">
      <MotionConfig reducedMotion="user">
        <DriverRuntimeProvider initialProfile={initialProfile} demoMode={demoMode}>
          {children}
          <ActiveRidePill />
          <OfferOverlay />
        </DriverRuntimeProvider>
      </MotionConfig>
    </div>
  );
}
