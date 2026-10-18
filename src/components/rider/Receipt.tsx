import { Banknote, CreditCard } from "lucide-react";
import { DemoBanner } from "@/components/ui";
import { formatDistance, formatDuration, formatILS } from "@/lib/format";
import { PAYMENT_METHOD_HE, PAYMENT_STATUS_HE } from "@/lib/labels";
import type { RideDTO } from "@/lib/types";
import { FareLines } from "./FareLines";

export function rideTotal(ride: RideDTO) {
  if (ride.status === "cancelled") return ride.cancellationFeeAgorot;
  return ride.finalTotalAgorot ?? ride.quotedTotalAgorot;
}

/** Receipt: fare lines, payment, actual vs estimated trip. */
export function Receipt({ ride }: { ride: RideDTO }) {
  const fare = ride.finalFare ?? ride.quotedFare;
  const cancelled = ride.status === "cancelled";
  const PayIcon = ride.paymentMethod === "cash" ? Banknote : CreditCard;
  return (
    <div className="space-y-4">
      {cancelled ? (
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-fg-muted">דמי ביטול</span>
          <span className="text-base font-extrabold ltr-nums">{formatILS(ride.cancellationFeeAgorot)}</span>
        </div>
      ) : (
        <FareLines fare={fare} total={ride.finalTotalAgorot ?? ride.quotedTotalAgorot} />
      )}
      {ride.refundedAgorot > 0 && (
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-fg-muted">הוחזר לכם</span>
          <span className="font-bold text-success ltr-nums">{formatILS(ride.refundedAgorot)}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/70 px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <PayIcon size={18} className="text-fg-muted" aria-hidden />
          {PAYMENT_METHOD_HE[ride.paymentMethod]}
        </span>
        <span className="text-fg-muted">{PAYMENT_STATUS_HE[ride.paymentStatus]}</span>
      </div>
      {!cancelled && (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <TripStat label="מרחק" actual={ride.actualDistanceM} estimated={ride.estimatedDistanceM} format={formatDistance} />
          <TripStat label="משך" actual={ride.actualDurationS} estimated={ride.estimatedDurationS} format={formatDuration} />
        </dl>
      )}
      {(fare.isDemoTariff || ride.isDemo) && <DemoBanner compact text={fare.isDemoTariff ? "תעריף הדגמה — לא בוצע חיוב אמיתי" : "נסיעת הדגמה"} />}
    </div>
  );
}

function TripStat({ label, actual, estimated, format }: { label: string; actual: number | null; estimated: number; format: (n: number) => string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/70 px-3 py-2.5">
      <dt className="text-xs font-semibold text-fg-muted">{label}</dt>
      <dd className="mt-0.5 font-extrabold tabular-nums">{actual != null ? format(actual) : "—"}</dd>
      <dd className="text-xs text-fg-muted">משוער: {format(estimated)}</dd>
    </div>
  );
}
