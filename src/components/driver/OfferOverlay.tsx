"use client";
/**
 * Full-screen offer card. Rendered from the driver layout so an offer shows
 * up on any driver page. Counts down to `offer.expiresAt`; accept / decline go
 * through the runtime which handles `offer_unavailable` and expiry.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, Clock3, CreditCard, Navigation2, Route } from "lucide-react";
import { formatDistance, formatDuration, formatEta, formatILS, percentFromBp } from "@/lib/format";
import { PAYMENT_METHOD_HE } from "@/lib/labels";
import type { RideDTO } from "@/lib/types";
import { Button, Pill } from "@/components/ui";
import { useDriverRuntime } from "./DriverRuntime";
import { useNow } from "./hooks";
import { CountdownRing } from "./CountdownRing";
import { CountUp } from "./motion";
import { AddressStack } from "./AddressStack";

function tripKind(durationS: number) {
  const min = durationS / 60;
  if (min < 10) return "נסיעה קצרה בעיר";
  if (min < 25) return "נסיעה בינונית";
  return "נסיעה ארוכה";
}

export function OfferOverlay() {
  const { offer } = useDriverRuntime();
  return <AnimatePresence>{offer && offer.offer && <OfferCard key={offer.id} ride={offer} />}</AnimatePresence>;
}

function OfferCard({ ride }: { ride: RideDTO }) {
  const { acceptOffer, declineOffer, expireOffer, busy } = useDriverRuntime();
  const offer = ride.offer!;
  const expiresAt = new Date(offer.expiresAt).getTime();
  const now = useNow(250);
  const [totalMs] = useState(() => Math.max(20_000, Math.min(60_000, expiresAt - Date.now())));
  const remaining = now ? expiresAt - now : totalMs;
  const expired = now > 0 && remaining <= 0;
  const fare = ride.quotedFare;

  useEffect(() => {
    if (expired && busy !== "accept") expireOffer(ride.id);
  }, [expired, busy, expireOffer, ride.id]);

  const working = busy === "accept" || busy === "decline";

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col justify-end bg-[rgba(5,7,12,0.62)] backdrop-blur-[3px] lg:items-center lg:justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.section
        role="alertdialog"
        aria-modal="true"
        aria-label={`הצעה חדשה — ${formatILS(offer.driverPayoutAgorot)} נטו`}
        aria-describedby="offer-payout"
        data-testid="offer-card"
        initial={{ y: 60, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="glass glass-strong relative m-2 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-[32px] p-5 safe-bottom lg:m-0 lg:w-[440px] lg:pb-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="pt-1">
            <span className="mb-2 inline-flex h-8 items-center gap-2 rounded-full bg-brand px-3 text-xs font-extrabold text-white shadow-[0_8px_24px_-8px_rgba(36,87,255,0.9)]">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              הצעה חדשה · {ride.serviceType.nameHe}
            </span>
            <h2 id="offer-title" className="display text-2xl">
              {tripKind(ride.estimatedDurationS)}
            </h2>
            <p className="mt-0.5 text-sm text-fg-muted">האיסוף {formatEta(offer.driverEtaS)} ממך</p>
          </div>
          <CountdownRing expiresAt={expiresAt} remainingMs={Math.max(0, remaining)} totalMs={totalMs} />
        </div>

        <div className="mt-4 text-center" id="offer-payout">
          <div className="text-xs font-bold text-fg-muted">התשלום שלך, נטו</div>
          <div className="display mt-1 text-[3.6rem] leading-none tabular-nums [text-shadow:0_8px_40px_rgba(36,87,255,0.55)]" data-testid="offer-payout">
            <CountUp value={offer.driverPayoutAgorot} format={(n) => formatILS(n)} duration={0.8} />
          </div>
          <div className="mt-2 text-xs text-fg-muted">
            אחרי עמלת HOP {percentFromBp(fare.commissionPercentBp)}
            {fare.bookingFeeAgorot > 0 ? " ודמי הזמנה" : ""} · הנוסע משלם {formatILS(ride.quotedTotalAgorot)}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-fg-muted">
              <Navigation2 size={14} aria-hidden /> נסיעה לאיסוף
            </div>
            <div className="mt-1 text-lg font-extrabold tabular-nums">{formatEta(offer.driverEtaS)}</div>
            <div className="text-xs text-fg-muted tabular-nums">{formatDistance(offer.driverDistanceM)}</div>
          </div>
          <div className="rounded-2xl bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-fg-muted">
              <Route size={14} aria-hidden /> משך הנסיעה
            </div>
            <div className="mt-1 text-lg font-extrabold tabular-nums">{formatDuration(ride.estimatedDurationS)}</div>
            <div className="text-xs text-fg-muted tabular-nums">{formatDistance(ride.estimatedDistanceM)}</div>
          </div>
        </div>

        <AddressStack className="mt-4" pickup={ride.pickup.address} dropoff={ride.dropoff.address} />

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <Pill tone="ink">
            {ride.paymentMethod === "cash" ? <Banknote size={14} aria-hidden /> : <CreditCard size={14} aria-hidden />}
            {PAYMENT_METHOD_HE[ride.paymentMethod]}
          </Pill>
          {ride.paymentMethod === "cash" && <span className="text-fg-muted">גובים מהנוסע בסיום</span>}
          {ride.isDemo && <Pill tone="warning">נסיעת הדגמה</Pill>}
          <span className="ms-auto inline-flex items-center gap-1 text-fg-muted">
            <Clock3 size={13} aria-hidden /> השיבו לפני שהזמן נגמר
          </span>
        </div>

        <div className="mt-5 grid gap-2">
          <Button variant="success" size="lg" block className="h-16 text-xl font-extrabold" onClick={() => void acceptOffer()} loading={busy === "accept"} disabled={working || expired} data-testid="offer-accept">
            קבלת הנסיעה
          </Button>
          <Button variant="ghost" block onClick={() => void declineOffer()} loading={busy === "decline"} disabled={working} data-testid="offer-decline">
            דחייה
          </Button>
        </div>
      </motion.section>
    </motion.div>
  );
}
