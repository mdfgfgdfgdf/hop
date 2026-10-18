"use client";
/** Ride finished: what you earned, cash to collect, rate the rider, back home. */
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, Check, CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import { formatDistance, formatDuration, formatILS } from "@/lib/format";
import type { RideDTO } from "@/lib/types";
import { Button, StarRating, useToast } from "@/components/ui";
import { useDriverRuntime } from "./DriverRuntime";
import { errorCode, errorMessage } from "./errors";
import { PayoutBreakdown } from "./PayoutBreakdown";
import { commissionOf, payoutOf, riderTotalOf } from "./labels";
import { CountUp } from "./motion";
import { firstName } from "./copy";

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

  async function submitRating() {
    if (!stars) return;
    setSending(true);
    setError(null);
    try {
      const { ride: updated } = await api.rides.rate(ride.id, stars, comment);
      setRated(true);
      setCompleted(updated);
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
    <div className="grid gap-3.5" data-testid="ride-complete">
      <div className="flex items-center gap-3">
        <motion.span
          initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 16 }}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success text-white shadow-[0_10px_30px_-8px_rgba(23,163,90,0.8)]"
          aria-hidden
        >
          <Check size={24} strokeWidth={3} />
        </motion.span>
        <div className="min-w-0">
          <h1 className="display text-[1.45rem] leading-tight">נסיעה הושלמה. כל הכבוד!</h1>
          <p className="text-xs text-fg-muted">
            {ride.dropoff.address.split(",")[0]} · {formatDistance(ride.actualDistanceM || ride.estimatedDistanceM)} · {formatDuration(ride.actualDurationS || ride.estimatedDurationS)}
          </p>
        </div>
      </div>

      <div className="py-1 text-center">
        <div className="display text-[3.2rem] leading-none tabular-nums [text-shadow:0_8px_40px_rgba(36,87,255,0.5)]" data-testid="completion-payout">
          <CountUp value={payoutOf(ride)} format={(n) => formatILS(n)} duration={1.1} />
        </div>
        <div className="mt-1.5 text-sm font-semibold text-fg-muted">נוספו להכנסות שלך</div>
      </div>

      {cash ? (
        <div className="flex items-center gap-3 rounded-2xl border border-warning/45 bg-warning/14 p-3" role="status">
          <Banknote size={24} className="shrink-0 text-warning" aria-hidden />
          <div className="text-sm">
            <div className="font-extrabold">מזומן — גבו מהנוסע {formatILS(total)}</div>
            <div className="text-xs text-fg-muted">
              מתוכם {formatILS(payoutOf(ride))} שלך ו-{formatILS(commissionOf(ride))} עמלת HOP
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] p-3">
          <CreditCard size={22} className="shrink-0 text-fg-muted" aria-hidden />
          <div className="text-sm">
            <div className="font-bold">שולם בכרטיס (הדגמה)</div>
            <div className="text-xs text-fg-muted">אין צורך לגבות מהנוסע</div>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-[color-mix(in_oklab,var(--fg)_5%,transparent)] px-4 py-3 text-center">
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
                  <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                    {QUICK_COMMENTS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={comment === c}
                        onClick={() => setComment((x) => (x === c ? null : c))}
                        className={
                          "min-h-10 rounded-full border px-3 text-xs font-bold transition-colors " +
                          (comment === c ? "border-brand bg-brand/20 text-fg" : "border-line text-fg-muted hover:text-fg")
                        }
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
              <p className="mt-2 text-xs font-semibold text-[#ff8a8d]" role="alert">
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

      <div className="sticky bottom-0 -mx-5 bg-[linear-gradient(to_top,var(--glass-bg-strong)_65%,transparent)] px-5 pt-3">
        <Button size="lg" block onClick={dismissCompleted} data-testid="back-home" className="font-extrabold">
          חזרה למסך הבית
        </Button>
        {profile?.availability === "online" && <p className="mt-1.5 text-center text-xs text-fg-muted">אתם שוב זמינים — ההצעה הבאה תופיע כאן</p>}
      </div>
    </div>
  );
}
