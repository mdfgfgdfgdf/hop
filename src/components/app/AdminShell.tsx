"use client";
import { DemoBanner } from "@/components/ui/DemoBanner";

/** Operator dashboard chrome. The admin subagent replaces the inner navigation. */
export function AdminShell({ children, demoMode, role, name }: { children: React.ReactNode; demoMode: boolean; role: "admin" | "support"; name: string }) {
  return (
    <div data-theme="light" data-app="admin" data-role={role} data-user={name} className="flex min-h-dvh flex-col bg-bg text-fg">
      {demoMode && (
        <div className="fixed top-2 left-1/2 z-50 -translate-x-1/2">
          <DemoBanner compact />
        </div>
      )}
      {children}
    </div>
  );
}
