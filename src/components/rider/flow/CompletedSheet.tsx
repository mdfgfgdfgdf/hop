"use client";
import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { AnimatedLogo } from "@/components/brand/AnimatedLogo";
import { formatDateTime, formatILS, formatTime } from "@/lib/format";
import type { RideDTO } from "@/lib/types";
import { DriverCard } from "../DriverCard";
import { RateRide } from "../RateRide";
import { Receipt, rideTotal } from "../Receipt";
import { RouteSummary } from "../RouteSummary";
import { CountUp, GlowButton } from "../motion";
import { SheetFooter } from "./SheetLayout";

export function CompletedSheet({ ride, onDone }: { ride: RideDTO; onDone: () => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-1 flex-col">
      <div role="status" className="relative">
        {/* The arrival moment: the wordmark's letters hop and the needle snaps to full. */}
        <div className="flex items-center justify-between gap-3">
          <AnimatedLogo height={34} mode="success" hopOn="both" title="HOP" />
          <motion.span
            className="pill pill-success"
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 20, delay: 0.35 }}
          >
            <Check size={14} strokeWidth={3} aria-hidden />
            הנסיעה הסתיימה
          </motion.span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <motion.h2
              className="display text-[34px]"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 24, delay: 0.2 }}
            >
              הגעתם.
            </motion.h2>
            <p className="text-sm text-fg-muted">תודה שנסעתם עם HOP · {formatTime(ride.completedAt)}</p>
          </div>
          <div className="shrink-0 text-end">
            <div className="text-xs font-bold text-fg-muted">סה״כ</div>
            <CountUp className="display block text-[30px] leading-tight ltr-nums" value={rideTotal(ride)} format={(n) => formatILS(n)} duration={0.9} />
            <span className="sr-only" data-testid="receipt-total">
              {formatILS(rideTotal(ride))}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <RateRide ride={ride} />
      </div>

      <div className="tile mt-4 rounded-[22px] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm font-extrabold">קבלה</span>
          <span className="text-xs font-semibold text-fg-muted tabular-nums">{formatDateTime(ride.completedAt ?? ride.requestedAt)}</span>
        </div>
        <RouteSummary dense className="mb-3" pickup={{ address: ride.pickup.address }} dropoff={{ address: ride.dropoff.address }} />
        <Receipt ride={ride} />
      </div>

      {ride.driver && (
        <div className="tile mt-3 rounded-[22px] p-3">
          <DriverCard driver={ride.driver} compact />
        </div>
      )}

      <SheetFooter>
        <GlowButton onClick={onDone} glow={false} data-testid="back-home">
          חזרה לדף הבית
        </GlowButton>
      </SheetFooter>
    </div>
  );
}
