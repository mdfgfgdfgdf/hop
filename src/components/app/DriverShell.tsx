"use client";
import { DemoBanner } from "@/components/ui/DemoBanner";

/** Driver app chrome: dark theme (night-friendly), full-bleed content. */
export function DriverShell({ children, demoMode }: { children: React.ReactNode; demoMode: boolean }) {
  return (
    <div data-theme="dark" data-app="driver" className="relative flex min-h-dvh flex-col bg-bg text-fg">
      {demoMode && (
        <div className="pointer-events-none fixed top-2 left-1/2 z-50 -translate-x-1/2 safe-top">
          <DemoBanner compact />
        </div>
      )}
      {children}
    </div>
  );
}
