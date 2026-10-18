"use client";
import { DemoBanner } from "@/components/ui/DemoBanner";

/** Rider app chrome: light theme, full-bleed content (map pages manage their own layout). */
export function RiderShell({ children, demoMode }: { children: React.ReactNode; demoMode: boolean }) {
  return (
    <div data-theme="light" data-app="rider" className="relative flex min-h-dvh flex-col bg-bg text-fg">
      {demoMode && (
        <div className="pointer-events-none fixed top-2 left-1/2 z-50 -translate-x-1/2 safe-top">
          <DemoBanner compact />
        </div>
      )}
      {children}
    </div>
  );
}
