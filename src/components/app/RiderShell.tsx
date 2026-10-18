"use client";
import { usePathname } from "next/navigation";
import { MotionConfig } from "motion/react";
import { ActiveRideProvider } from "@/components/rider/ActiveRideProvider";
import { ActiveRideChip } from "@/components/rider/ActiveRideChip";
import { RiderInfoContext } from "@/components/rider/RiderContext";
import "@/components/rider/rider.css";

/**
 * Rider app chrome: light theme, full-bleed content (map pages manage their
 * own layout). Shares one active-ride state + SSE connection across pages and
 * shows the "active ride" chip everywhere except the live map itself.
 * The demo label is rendered by each page header (top bar / page header).
 */
export function RiderShell({ children, demoMode, userName = null }: { children: React.ReactNode; demoMode: boolean; userName?: string | null }) {
  const pathname = usePathname();
  return (
    <MotionConfig reducedMotion="user">
      <RiderInfoContext.Provider value={{ demoMode, initialName: userName }}>
        <ActiveRideProvider>
          <div data-theme="light" data-app="rider" className="relative flex min-h-dvh flex-col bg-bg text-fg">
            {children}
            {pathname !== "/ride" && <ActiveRideChip />}
          </div>
        </ActiveRideProvider>
      </RiderInfoContext.Provider>
    </MotionConfig>
  );
}
