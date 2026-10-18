"use client";
import { ToastProvider } from "@/components/ui/Toast";
import { SessionProvider } from "@/components/app/session";
import { BrandIntroGate } from "@/components/app/BrandIntroGate";
import { GlassLight } from "@/components/app/GlassLight";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <BrandIntroGate />
        <GlassLight />
        {children}
      </ToastProvider>
    </SessionProvider>
  );
}
