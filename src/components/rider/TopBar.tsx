"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AnimatedMark, type LogoMode } from "@/components/brand/AnimatedLogo";
import { DemoBanner } from "@/components/ui";
import { AccountMenu } from "./AccountMenu";
import { useRiderInfo } from "./RiderContext";
import { useGreeting } from "./lib/hooks";

/** Hops the mark once whenever the ride moves to a new phase (not on first render). */
function usePhaseHop(phase: string) {
  const [hop, setHop] = useState({ phase, n: 0 });
  if (hop.phase !== phase) setHop({ phase, n: hop.n + 1 });
  return hop.n || undefined;
}

/**
 * Floating glass top bar over the map (mobile full width, desktop beside the
 * panel). The HOP mark lives with the ride (idle · searching · moving ·
 * arrived) and the second line "talks": it follows the ride's state.
 */
export function TopBar({ note, mode = "idle" }: { note?: string; mode?: LogoMode }) {
  const { firstName, demoMode } = useRiderInfo();
  const greeting = useGreeting();
  const hopKey = usePhaseHop(mode);
  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-3 safe-top lg:absolute lg:start-[452px] lg:end-0 lg:px-4 lg:pt-4"
    >
      <div className="glass glass-strong glass-pill pointer-events-auto flex h-16 items-center gap-3 ps-2 pe-2.5">
        <Link href="/ride" aria-label="HOP — דף הבית" className="shrink-0 rounded-[14px] transition-transform active:scale-95" data-mark-mode={mode}>
          <AnimatedMark size={46} mode={mode} hopOn="both" hopKey={hopKey} title="HOP" className="drop-shadow-[0_6px_12px_rgba(36,87,255,.35)]" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[15px] font-extrabold" data-testid="greeting">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </div>
          <div className="relative h-[18px] overflow-hidden" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={note ?? "tagline"}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.28 }}
                className="truncate text-[13px] font-semibold text-fg-muted"
              >
                {note ?? "העיר שלך. הופ אחד."}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        {demoMode && <DemoBanner compact text="הדגמה" className="shrink-0" />}
        <AccountMenu />
      </div>
    </motion.header>
  );
}
