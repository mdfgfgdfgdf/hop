"use client";
/**
 * Bottom sheet (mobile) / side panel (desktop ≥ lg) built on liquid glass.
 * Non-modal by default so the map stays interactive behind it.
 */
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./cn";

type Props = {
  open?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Show the drag handle (mobile). */
  handle?: boolean;
  /** Desktop placement; mobile is always a bottom sheet. */
  side?: "start" | "end";
  "aria-label"?: string;
};

export function Sheet({ open = true, children, className, handle = true, side = "start", ...aria }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.section
          role="region"
          aria-label={aria["aria-label"]}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className={cn(
            "glass glass-strong pointer-events-auto z-20",
            "fixed inset-x-2 bottom-2 max-h-[82dvh] overflow-y-auto rounded-[30px] safe-bottom",
            "lg:absolute lg:inset-x-auto lg:top-4 lg:bottom-4 lg:w-[420px] lg:max-h-none",
            side === "start" ? "lg:right-4" : "lg:left-4",
            className,
          )}
        >
          {handle && <div className="grab-handle mt-3 lg:hidden" aria-hidden />}
          <div className="p-5">{children}</div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
