"use client";
/**
 * Auth chrome: a plain white page with the HOP wordmark in the header. The
 * needle in the "o" revs while a form is submitting; the forms drive it
 * through `useAuthBrand()`.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { AnimatedLogo, type LogoMode } from "@/components/brand/AnimatedLogo";

type Phase = "idle" | "submitting" | "success";
type AuthBrand = { phase: Phase; setPhase: (p: Phase) => void };

const Ctx = createContext<AuthBrand>({ phase: "idle", setPhase: () => {} });

export function useAuthBrand() {
  return useContext(Ctx);
}

export function AuthBrandProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhaseState] = useState<Phase>("idle");
  const setPhase = useCallback((p: Phase) => setPhaseState(p), []);
  const value = useMemo(() => ({ phase, setPhase }), [phase, setPhase]);
  const mode: LogoMode = phase === "submitting" ? "loading" : phase === "success" ? "success" : "idle";
  return (
    <Ctx.Provider value={value}>
      <header className="mx-auto flex h-16 w-full max-w-[440px] items-center justify-between px-5">
        <Link href="/" aria-label="HOP — לדף הבית" className="-ms-1 rounded-md p-1">
          <AnimatedLogo height={24} mode={mode} hopOn="none" title="HOP" />
        </Link>
        <Link href="/" className="grid h-10 w-10 place-items-center rounded-full text-fg hover:bg-[#f3f3f5]" aria-label="סגירה וחזרה לדף הבית">
          <X size={22} aria-hidden />
        </Link>
      </header>
      <div className="mx-auto w-full max-w-[440px] flex-1 px-5 pt-4 pb-10 sm:pt-10">{children}</div>
    </Ctx.Provider>
  );
}
