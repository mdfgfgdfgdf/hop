"use client";
/**
 * Auth chrome: the living HOP wordmark above the form card. It hops on mount,
 * revs its needle while a form is submitting and hops again on success. The
 * forms drive it through `useAuthBrand()`.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatedLogo, type LogoMode } from "@/components/brand/AnimatedLogo";

type Phase = "idle" | "submitting" | "success";
type AuthBrand = { phase: Phase; setPhase: (p: Phase) => void };

const Ctx = createContext<AuthBrand>({ phase: "idle", setPhase: () => {} });

export function useAuthBrand() {
  return useContext(Ctx);
}

export function AuthBrandProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [successes, setSuccesses] = useState(0);
  const setPhase = useCallback((p: Phase) => {
    setPhaseState(p);
    if (p === "success") setSuccesses((n) => n + 1);
  }, []);
  const value = useMemo(() => ({ phase, setPhase }), [phase, setPhase]);
  const mode: LogoMode = phase === "submitting" ? "loading" : phase === "success" ? "success" : "idle";
  return (
    <Ctx.Provider value={value}>
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 pt-5 sm:pt-7">
        <Link href="/" className="btn btn-glass btn-sm ps-3" aria-label="חזרה לדף הבית של HOP">
          <ArrowRight size={16} aria-hidden />
          לדף הבית
        </Link>
        <span className="text-[11px] font-extrabold tracking-[0.28em] text-fg-muted" dir="ltr">
          MOVE WITH HOP
        </span>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pt-6 pb-10">
        <div className="mb-6 flex justify-center">
          {/* hopKey stays undefined until the first success so mount hops only once */}
          <AnimatedLogo height={58} mode={mode} hopOn="both" hopKey={successes || undefined} title="HOP" />
        </div>
        {children}
      </div>
    </Ctx.Provider>
  );
}
