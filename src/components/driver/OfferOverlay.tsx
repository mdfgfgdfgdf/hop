"use client";
/**
 * Full-screen offer card. Rendered from the driver layout so an offer shows
 * up on any driver page. The HOP mark hops when a new offer lands. Counts
 * down to `offer.expiresAt`; accept / decline go through the runtime which
 * handles `offer_unavailable` and expiry.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, Clock3, CreditCard, Navigation2, Route } from "lucide-react";
import { formatDistance, formatDuration, formatEta, formatILS, percentFromBp } from "@/lib/format";
import { PAYMENT_METHOD_HE } from "@/lib/labels";
import type { RideDTO } from "@/lib/types";
import { AnimatedMark } from "@/components/brand/AnimatedLogo";
import { Button, cn } from "@/components/ui";
import { TonePill } from "./TonePill";
import { useDriverRuntime } from "./DriverRuntime";
import { useNow } from "./hooks";
import { CountdownRing } from "./CountdownRing";
import { CountUp } from "./motion";
import { AddressStack } from "./AddressStack";
import { TILE } from "./tone";

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
      className="fixed inset-0 z-[80] flex flex-col justify-end bg-ink/25 backdrop-blur-[3px] lg:items-center lg:justify-center"
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
        className="glass glass-strong relative m-2 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-[32px] p-5 safe-bottom [--glass-bg-strong:rgba(244,246,250,0.86)] lg:m-0 lg:w-[460px] lg:p-6"
      >
        <div className="flex items-center gap-3">
          <AnimatedMark size={46} mode="loading" hopOn="none" hopKey={ride.id} title="" className="shrink-0 self-start" />
          <div className="min-w-0 flex-1">
            <span className="pill bg-brand text-white shadow-[0_6px_16px_-8px_rgba(36,87,255,0.9)]">
              <span className="relative flex h-1.5 w-1.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              הצעה חדשה · {ride.serviceType.nameHe}
            </span>
            <h2 id="offer-title" className="display mt-1.5 truncate text-[1.45rem] leading-tight">
              {tripKind(ride.estimatedDurationS)}
            </h2>
            <p className="mt-0.5 text-sm font-medium text-fg-muted">האיסוף {formatEta(offer.driverEtaS)} ממך</p>
          </div>
          <CountdownRing expiresAt={expiresAt} remainingMs={Math.max(0, remaining)} totalMs={totalMs} size={86} />
        </div>

        <div className={cn(TILE, "mt-4 rounded-[24px] px-4 py-4 text-center")} id="offer-payout">
          <div className="text-xs font-bold text-fg-muted">התשלום שלך, נטו</div>
          <div className="display mt-1.5 text-[3.4rem] leading-none tabular-nums" data-testid="offer-payout">
            <CountUp value={offer.driverPayoutAgorot} format={(n) => formatILS(n)} duration={0.8} />
          </div>
          <div className="mt-2.5 text-xs text-fg-muted">
            אחרי עמלת HOP {percentFromBp(fare.commissionPercentBp)}
            {fare.bookingFeeAgorot > 0 ? " ודמי הזמנה" : ""} · הנוסע משלם <span className="font-semibold text-fg tabular-nums">{formatILS(ride.quotedTotalAgorot)}</span>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <InfoTile icon={<Navigation2 size={14} aria-hidden />} label="נסיעה לאיסוף" value={formatEta(offer.driverEtaS)} hint={formatDistance(offer.driverDistanceM)} />
          <InfoTile icon={<Route size={14} aria-hidden />} label="משך הנסיעה" value={formatDuration(ride.estimatedDurationS)} hint={formatDistance(ride.estimatedDistanceM)} />
        </div>

        <div className={cn(TILE, "mt-2.5 p-3.5")}>
          <AddressStack pickup={ride.pickup.address} dropoff={ride.dropoff.address} />
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
          <TonePill tone="ink">
            {ride.paymentMethod === "cash" ? <Banknote size={14} aria-hidden /> : <CreditCard size={14} aria-hidden />}
            {PAYMENT_METHOD_HE[ride.paymentMethod]}
          </TonePill>
          {ride.paymentMethod === "cash" && <span className="font-medium text-fg-muted">גובים מהנוסע בסיום</span>}
          {ride.isDemo && <TonePill tone="warning">נסיעת הדגמה</TonePill>}
          <span className="ms-auto inline-flex items-center gap-1 font-medium text-fg-muted">
            <Clock3 size={13} aria-hidden /> השיבו לפני שהזמן נגמר
          </span>
        </div>

        <div className="mt-4 grid gap-2">
          <Button size="lg" block className="h-16 text-xl font-extrabold" onClick={() => void acceptOffer()} loading={busy === "accept"} disabled={working || expired} data-testid="offer-accept">
            קבלת הנסיעה
          </Button>
          <Button variant="glass" block className="h-12" onClick={() => void declineOffer()} loading={busy === "decline"} disabled={working} data-testid="offer-decline">
            דחייה
          </Button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function InfoTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className={cn(TILE, "p-3")}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-fg-muted">
        <span className="text-brand">{icon}</span> {label}
      </div>
      <div className="display mt-1 text-lg tabular-nums">{value}</div>
      <div className="text-xs font-medium text-fg-muted tabular-nums">{hint}</div>
    </div>
  );
}
