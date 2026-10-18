/** Server-computed money for one ride, from the driver's point of view. */
import { formatILS, percentFromBp } from "@/lib/format";
import { PAYMENT_METHOD_HE } from "@/lib/labels";
import type { RideDTO } from "@/lib/types";
import { cn } from "@/components/ui";
import { commissionOf, payoutOf, riderTotalOf } from "./labels";

export function PayoutBreakdown({ ride, className, showLines = true }: { ride: RideDTO; className?: string; showLines?: boolean }) {
  const fare = ride.finalFare ?? ride.quotedFare;
  const cancelled = ride.status === "cancelled";
  if (cancelled) {
    return (
      <div className={cn("rounded-2xl bg-[color-mix(in_oklab,var(--fg)_5%,transparent)] p-4 text-sm", className)}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-fg-muted">הנסיעה בוטלה — לא בוצע חיוב נסיעה</span>
          <span className="font-bold tabular-nums">{formatILS(0)}</span>
        </div>
        {ride.cancellationFeeAgorot > 0 && (
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-fg-muted">דמי ביטול שנגבו מהנוסע</span>
            <span className="font-bold tabular-nums">{formatILS(ride.cancellationFeeAgorot)}</span>
          </div>
        )}
      </div>
    );
  }
  const total = riderTotalOf(ride);
  const commission = commissionOf(ride);
  const payout = payoutOf(ride);
  const commissionLabel = `עמלת HOP (${percentFromBp(fare.commissionPercentBp)}${fare.bookingFeeAgorot > 0 ? " + דמי הזמנה" : ""})`;
  return (
    <div className={cn("rounded-2xl bg-[color-mix(in_oklab,var(--fg)_5%,transparent)] p-4", className)}>
      <dl className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-fg-muted">{ride.status === "completed" ? "הנוסע שילם" : "מחיר לנוסע"}</dt>
          <dd className="font-semibold tabular-nums">{formatILS(total)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-fg-muted">{commissionLabel}</dt>
          <dd className="font-semibold tabular-nums">{formatILS(-commission)}</dd>
        </div>
        <div className="divider my-1" />
        <div className="flex items-center justify-between gap-3">
          <dt className="font-bold">התשלום שלך</dt>
          <dd className="text-lg font-extrabold text-success tabular-nums">{formatILS(payout)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs">
          <dt className="text-fg-muted">אמצעי תשלום</dt>
          <dd className="font-semibold">{PAYMENT_METHOD_HE[ride.paymentMethod]}</dd>
        </div>
      </dl>
      {showLines && fare.lines.length > 0 && (
        <details className="group mt-3 text-xs">
          <summary className="cursor-pointer list-none font-bold text-fg-muted hover:text-fg">
            פירוט המחיר לנוסע <span className="inline-block transition-transform group-open:rotate-180">▾</span>
          </summary>
          <ul className="mt-2 grid gap-1">
            {fare.lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-3 text-fg-muted">
                <span>{l.label}</span>
                <span className="tabular-nums">{formatILS(l.amountAgorot)}</span>
              </li>
            ))}
          </ul>
          {fare.isDemoTariff && <p className="mt-2 text-[11px] font-semibold text-amber-300">תעריף הדגמה — הסכומים אינם אמיתיים</p>}
        </details>
      )}
    </div>
  );
}
