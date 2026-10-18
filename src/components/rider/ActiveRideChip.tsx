"use client";
import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { RIDE_STATUS_SHORT_HE } from "@/lib/labels";
import { isLive, useActiveRide } from "./ActiveRideProvider";

/** Persistent "active ride" chip on every rider page except the live map. */
export function ActiveRideChip() {
  const { ride, endedRide } = useActiveRide();
  const live = isLive(ride);
  const show = live || endedRide?.status === "completed";
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 safe-bottom"
        >
          <Link
            href="/ride"
            className="glass glass-brand glass-pill pointer-events-auto flex min-h-12 items-center gap-3 px-5 py-2.5 text-sm font-bold"
            data-testid="active-ride-chip"
          >
            {live ? (
              <>
                <span className="relative flex h-2.5 w-2.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                </span>
                <span>נסיעה פעילה</span>
                <span className="font-semibold text-white/80">· {RIDE_STATUS_SHORT_HE[ride!.status]}</span>
              </>
            ) : (
              <>
                <Receipt size={18} aria-hidden />
                <span>הנסיעה הסתיימה · לקבלה ולדירוג</span>
              </>
            )}
            <ArrowLeft size={18} aria-hidden />
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
