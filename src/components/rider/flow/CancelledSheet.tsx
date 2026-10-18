"use client";
import { RotateCcw, XCircle } from "lucide-react";
import { formatILS, formatTime } from "@/lib/format";
import { CANCELLED_BY_HE, CANCEL_REASONS_HE } from "@/lib/labels";
import type { RideDTO } from "@/lib/types";
import { Button } from "@/components/ui";
import { GlowButton } from "../motion";
import { RouteSummary } from "../RouteSummary";
import { SheetFooter } from "./SheetLayout";

export function cancelReasonText(ride: RideDTO) {
  if (!ride.cancelReason) return null;
  return CANCEL_REASONS_HE[ride.cancelReason] ?? ride.cancelReason;
}

export function CancelledSheet({ ride, onRetry, onDone }: { ride: RideDTO; onRetry: () => void; onDone: () => void }) {
  const reason = cancelReasonText(ride);
  const noDrivers = ride.cancelReason === "no_drivers_available";
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3" role="status">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-danger/12 text-danger">
          <XCircle size={26} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="display text-[26px]">{noDrivers ? "לא מצאנו נהג פנוי" : "הנסיעה בוטלה"}</h2>
          <p className="text-sm text-fg-muted">
            {ride.cancelledBy ? `בוטלה על ידי ${CANCELLED_BY_HE[ride.cancelledBy]}` : "הנסיעה בוטלה"}
            {ride.cancelledAt ? ` · ${formatTime(ride.cancelledAt)}` : ""}
          </p>
        </div>
      </div>

      {reason && (
        <div className="mt-4 rounded-2xl bg-[color-mix(in_oklab,var(--fg)_5%,transparent)] px-4 py-3 text-sm">
          <span className="font-bold">סיבה: </span>
          {reason}
          {noDrivers && <div className="mt-1 text-fg-muted">כל הנהגים בסביבה היו עסוקים הפעם. לא חויבתם — ננסה שוב יחד?</div>}
        </div>
      )}

      <div className="mt-4 rounded-[22px] border border-line bg-surface/70 p-3">
        <RouteSummary dense pickup={{ address: ride.pickup.address }} dropoff={{ address: ride.dropoff.address }} />
        <div className="divider my-2" />
        <div className="flex items-center justify-between px-1 text-sm">
          <span className="text-fg-muted">{ride.cancellationFeeAgorot > 0 ? "דמי ביטול" : "חיוב"}</span>
          <span className="font-extrabold ltr-nums">{ride.cancellationFeeAgorot > 0 ? formatILS(ride.cancellationFeeAgorot) : "ללא חיוב"}</span>
        </div>
      </div>

      <SheetFooter className="space-y-2">
        <GlowButton onClick={onRetry} data-testid="retry-ride">
          <RotateCcw size={18} aria-hidden />
          ניסיון נוסף
        </GlowButton>
        <Button block variant="ghost" onClick={onDone}>
          חזרה לדף הבית
        </Button>
      </SheetFooter>
    </div>
  );
}
