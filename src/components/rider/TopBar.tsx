"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { LogoMark } from "@/components/brand/Logo";
import { DemoBanner } from "@/components/ui";
import { AccountMenu } from "./AccountMenu";
import { useRiderInfo } from "./RiderContext";
import { useGreeting } from "./lib/hooks";

/**
 * Floating glass top bar over the map (mobile full width, desktop beside the
 * panel). The second line "talks": it follows the ride's state.
 */
export function TopBar({ note }: { note?: string }) {
  const { firstName, demoMode } = useRiderInfo();
  const greeting = useGreeting();
  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-3 safe-top lg:absolute lg:start-[452px] lg:end-0 lg:px-4 lg:pt-4"
    >
      <div className="glass glass-strong glass-pill pointer-events-auto flex h-16 items-center gap-3 ps-2.5 pe-2.5">
        <Link href="/ride" aria-label="HOP — דף הבית" className="shrink-0 transition-transform active:scale-95">
          <LogoMark size={42} />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[15px] font-extrabold" data-testid="greeting">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </div>
          <div className="relative h-4 overflow-hidden" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={note ?? "tagline"}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.28 }}
                className="truncate text-xs font-semibold text-fg-muted"
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
