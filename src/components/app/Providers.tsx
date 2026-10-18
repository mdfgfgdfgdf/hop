"use client";
import { ToastProvider } from "@/components/ui/Toast";
import { SessionProvider } from "@/components/app/session";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
