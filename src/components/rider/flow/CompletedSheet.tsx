"use client";
import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { formatILS, formatTime } from "@/lib/format";
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
      <div className="flex items-center gap-3" role="status">
        <motion.span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-success text-white shadow-[0_12px_26px_-10px_rgba(23,163,90,.7)]"
          initial={reduce ? false : { scale: 0.4, rotate: -30, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.1 }}
        >
          <Check size={26} strokeWidth={3} aria-hidden />
        </motion.span>
        <div className="min-w-0 flex-1">
          <h2 className="display text-[28px]">הגעתם.</h2>
          <p className="text-sm text-fg-muted">תודה שנסעתם עם HOP · {formatTime(ride.completedAt)}</p>
        </div>
        <div className="text-end">
          <div className="text-xs font-bold text-fg-muted">סה״כ</div>
          <CountUp className="display block text-[28px] ltr-nums" value={rideTotal(ride)} format={(n) => formatILS(n)} duration={0.9} />
          <span className="sr-only" data-testid="receipt-total">{formatILS(rideTotal(ride))}</span>
        </div>
      </div>

      <div className="mt-4">
        <RateRide ride={ride} />
      </div>

      <div className="mt-4 rounded-[22px] border border-line bg-surface/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-extrabold">קבלה</span>
          <Logo height={18} title="HOP" />
        </div>
        <RouteSummary dense className="mb-3" pickup={{ address: ride.pickup.address }} dropoff={{ address: ride.dropoff.address }} />
        <Receipt ride={ride} />
      </div>

      {ride.driver && (
        <div className="mt-3 rounded-[22px] border border-line bg-surface/70 p-3">
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
