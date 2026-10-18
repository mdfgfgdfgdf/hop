"use client";
/** Ride finished: what you earned, cash to collect, rate the rider, back home. */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, Check, CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import { formatDistance, formatDuration, formatILS } from "@/lib/format";
import type { RideDTO } from "@/lib/types";
import { AnimatedLogo } from "@/components/brand/AnimatedLogo";
import { Button, StarRating, cn, useToast } from "@/components/ui";
import { useDriverRuntime } from "./DriverRuntime";
import { errorCode, errorMessage } from "./errors";
import { PayoutBreakdown } from "./PayoutBreakdown";
import { commissionOf, payoutOf, riderTotalOf } from "./labels";
import { CountUp } from "./motion";
import { firstName } from "./copy";
import { TEXT, TILE } from "./tone";

const QUICK_COMMENTS = ["אדיב/ה", "היה/תה בזמן", "נקודת איסוף ברורה", "בעייתי/ת"];

export function CompletionPanel({ ride }: { ride: RideDTO }) {
  const { dismissCompleted, setCompleted, profile } = useDriverRuntime();
  const toast = useToast();
  const [stars, setStars] = useState(ride.driverRating ?? 0);
  const [comment, setComment] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [rated, setRated] = useState(ride.driverRating != null);
  const [error, setError] = useState<string | null>(null);
  const total = riderTotalOf(ride);
  const cash = ride.paymentMethod === "cash";
  // "Back home" may be tapped while the rating is still in flight: once this
  // panel is gone, a late response must not bring the summary back.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function submitRating() {
    if (!stars) return;
    setSending(true);
    setError(null);
    try {
      const { ride: updated } = await api.rides.rate(ride.id, stars, comment);
      setRated(true);
      if (mounted.current) setCompleted(updated);
      toast.success("תודה! הדירוג נשמר");
    } catch (err) {
      if (errorCode(err) === "already_rated") setRated(true);
      else setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const name = firstName(ride.rider?.name) || "הנוסע";
  return (
    <div className="grid gap-3" data-testid="ride-complete">
      {/* brand moment: the wordmark hops and the needle snaps to full */}
      <div className="grid justify-items-center text-center">
        <AnimatedLogo height={26} mode="success" hopOn="hover" title="HOP" />
        <div className="mt-2.5 flex items-center gap-2">
          <motion.span
            initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.25 }}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-success text-white shadow-[0_6px_14px_-6px_rgba(23,163,90,0.8)]"
            aria-hidden
          >
            <Check size={16} strokeWidth={3.2} />
          </motion.span>
          <h1 className="display text-[1.45rem] leading-tight">נסיעה הושלמה. כל הכבוד!</h1>
        </div>
        <p className="mt-1 text-xs font-medium text-fg-muted">
          {ride.dropoff.address.split(",")[0]} · {formatDistance(ride.actualDistanceM || ride.estimatedDistanceM)} · {formatDuration(ride.actualDurationS || ride.estimatedDurationS)}
        </p>
        <div className="display mt-3 text-[3.1rem] leading-none tabular-nums" data-testid="completion-payout">
          <CountUp value={payoutOf(ride)} format={(n) => formatILS(n)} duration={1.1} />
        </div>
        <div className="mt-1.5 text-sm font-semibold text-fg-muted">נוספו להכנסות שלך</div>
      </div>

      {cash ? (
        <div className="flex items-center gap-3 rounded-2xl bg-[color-mix(in_oklab,var(--warning)_12%,var(--surface))] p-3.5 ring-1 ring-warning/40" role="status">
          <Banknote size={24} className={cn("shrink-0", TEXT.warning)} aria-hidden />
          <div className="text-sm">
            <div className="font-extrabold">מזומן — גבו מהנוסע {formatILS(total)}</div>
            <div className="text-xs text-fg-muted">
              מתוכם {formatILS(payoutOf(ride))} שלך ו-{formatILS(commissionOf(ride))} עמלת HOP
            </div>
          </div>
        </div>
      ) : (
        <div className={cn(TILE, "flex items-center gap-3 p-3.5")}>
          <CreditCard size={22} className="shrink-0 text-brand" aria-hidden />
          <div className="text-sm">
            <div className="font-bold">שולם בכרטיס (הדגמה)</div>
            <div className="text-xs text-fg-muted">אין צורך לגבות מהנוסע</div>
          </div>
        </div>
      )}

      <div className={cn(TILE, "rounded-[24px] px-4 py-3 text-center")}>
        {rated ? (
          <div role="status" className="flex items-center justify-center gap-3">
            <span className="text-sm font-bold">דירגתם את {name}</span>
            <StarRating value={ride.driverRating ?? stars} readOnly size={22} />
          </div>
        ) : (
          <>
            <div className="text-sm font-bold">איך הייתה הנסיעה עם {name}?</div>
            <div className="mt-1.5 flex justify-center">
              <StarRating value={stars} onChange={setStars} size={38} />
            </div>
            <AnimatePresence initial={false}>
              {stars > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                    {QUICK_COMMENTS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={comment === c}
                        onClick={() => setComment((x) => (x === c ? null : c))}
                        className={cn(
                          "min-h-11 rounded-full px-3.5 text-xs font-bold transition-[background-color,box-shadow,color]",
                          comment === c ? "bg-brand-100 text-brand-700 ring-2 ring-brand/40" : "bg-surface text-fg-muted ring-1 ring-line hover:text-fg",
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <Button className="mt-2.5" variant="glass" size="sm" loading={sending} onClick={() => void submitRating()} data-testid="rate-submit">
                    שליחת דירוג
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            {error && (
              <p className={cn("mt-2 text-xs font-semibold", TEXT.danger)} role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      <details className="group rounded-2xl">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-2xl px-1 text-sm font-bold text-fg-muted hover:text-fg">
          פירוט התשלום
          <span className="transition-transform group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <PayoutBreakdown ride={ride} className="mt-1" />
      </details>

      {/* sticky action: frosts whatever scrolls underneath it */}
      <div className="sticky bottom-0 isolate -mx-5 px-5 pt-2 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[var(--glass-bg-strong)] before:backdrop-blur-xl before:[mask-image:linear-gradient(to_bottom,transparent,#000_18px)]">
        {profile?.availability === "online" && <p className="mb-2 text-center text-xs font-medium text-fg-muted">אתם שוב זמינים — ההצעה הבאה תופיע כאן</p>}
        <Button size="lg" block onClick={dismissCompleted} data-testid="back-home" className="font-extrabold">
          חזרה למסך הבית
        </Button>
      </div>
    </div>
  );
}
