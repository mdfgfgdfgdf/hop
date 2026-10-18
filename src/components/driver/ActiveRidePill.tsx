"use client";
/** Floating "back to your ride" pill on driver pages other than the home map. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Car } from "lucide-react";
import { useDriverRuntime } from "./DriverRuntime";
import { PHASE_SHORT_HE, ridePhase } from "./labels";

export function ActiveRidePill() {
  const { activeRide, completed } = useDriverRuntime();
  const pathname = usePathname();
  const phase = activeRide ? ridePhase(activeRide) : null;
  const show = pathname !== "/drive" && (phase != null || completed != null);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 safe-bottom"
        >
          <Link href="/drive" className="glass glass-brand glass-pill flex min-h-14 items-center gap-3 px-5 py-2 font-bold">
            <Car size={20} aria-hidden />
            <span>{phase ? PHASE_SHORT_HE[phase] : "סיכום הנסיעה האחרונה"}</span>
            <span className="text-sm font-semibold opacity-80">חזרה לנסיעה</span>
            <ArrowLeft size={18} aria-hidden />
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
