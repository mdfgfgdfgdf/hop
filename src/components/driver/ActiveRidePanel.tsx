"use client";
/** Active ride sheet: rider, destination + navigation, payout, step button, cancel. */
import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Banknote, CreditCard, Navigation, ShieldAlert, Star, Timer } from "lucide-react";
import { formatDistance, formatDuration, formatILS } from "@/lib/format";
import { PAYMENT_METHOD_HE } from "@/lib/labels";
import type { LatLng, RideDTO } from "@/lib/types";
import { Avatar, Button, Textarea, cn } from "@/components/ui";
import { useDriverRuntime, type StepAction } from "./DriverRuntime";
import { useNow } from "./hooks";
import { googleMapsUrl, haversineM, wazeUrl } from "./geo";
import { DRIVER_CANCEL_REASONS, PHASE_ACTION_HE, payoutOf, ridePhase, type RidePhase } from "./labels";
import { Dialog } from "./Dialog";
import { CountUp, SwapText } from "./motion";
import { firstName } from "./copy";
import { CHIP, FILL, TEXT, TILE } from "./tone";

const ACTION_FOR: Record<RidePhase, StepAction> = { to_pickup_pending: "arriving", to_pickup: "arrived", at_pickup: "start", on_trip: "complete" };
const STEPS = [
  { key: "to_pickup", label: "לאיסוף" },
  { key: "at_pickup", label: "איסוף" },
  { key: "on_trip", label: "ליעד" },
] as const;

function shortAddress(address: string) {
  return address.split(",")[0]?.trim() || address;
}

function stepIndex(phase: RidePhase) {
  return phase === "on_trip" ? 2 : phase === "at_pickup" ? 1 : 0;
}

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function ActiveRidePanel({ ride, me }: { ride: RideDTO; me: LatLng | null }) {
  const { advance, cancelRide, busy } = useDriverRuntime();
  const phase = ridePhase(ride);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const now = useNow(1000, phase === "at_pickup");
  if (!phase) return null;

  const toPickup = phase !== "on_trip";
  const target = toPickup ? ride.pickup : ride.dropoff;
  const distToTarget = me ? haversineM(me, target) : null;
  const payout = payoutOf(ride);
  const action = ACTION_FOR[phase];
  const canCancel = ride.status === "accepted" || ride.status === "driver_arriving";
  const rider = ride.rider;
  const stepI = stepIndex(phase);
  const name = firstName(rider?.name) || "הנוסע";

  const onPrimary = () => {
    if (action === "complete") setConfirmComplete(true);
    else void advance(action);
  };

  return (
    <div className="grid gap-3.5" data-testid="active-ride" data-phase={phase}>
      {/* progress + safety */}
      <div className="flex items-center gap-3">
        <ol className="grid flex-1 grid-cols-3 gap-1.5" aria-label="שלבי הנסיעה">
          {STEPS.map((s, i) => (
            <li key={s.key} className="grid gap-1" aria-current={i === stepI ? "step" : undefined}>
              <span className="relative h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--fg)_10%,transparent)]">
                {i <= stepI && <motion.span className="absolute inset-0 rounded-full bg-brand" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ originX: 1 }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />}
              </span>
              <span className={cn("text-[11px] font-bold", i === stepI ? "text-fg" : "text-fg-muted")}>{s.label}</span>
            </li>
          ))}
        </ol>
        <Link
          href={`/drive/support?new=safety&rideId=${ride.id}`}
          className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-danger/15", CHIP.danger)}
          aria-label="דיווח על אירוע בטיחותי"
        >
          <ShieldAlert size={19} aria-hidden />
        </Link>
      </div>

      <motion.div key={phase} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 32 }} aria-live="polite">
        <h1 className="display text-[1.65rem] leading-tight" data-testid="ride-phase-title">
          {phase === "to_pickup_pending" ? "יוצאים לאיסוף" : phase === "to_pickup" ? `בדרך ל${name}` : phase === "at_pickup" ? "הגעתם לנקודת האיסוף" : "בדרך ליעד"}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-medium text-fg-muted" data-testid="ride-phase-line">
          {phase === "at_pickup" && ride.arrivedAt ? (
            <>
              <Timer size={15} aria-hidden /> ממתינים ל{name} <span className="font-bold text-fg tabular-nums ltr-nums">{now ? mmss(now - new Date(ride.arrivedAt).getTime()) : "00:00"}</span>
            </>
          ) : phase === "on_trip" ? (
            <>{distToTarget != null && distToTarget > 150 ? `נסיעה נעימה — נותרו כ-${formatDistance(distToTarget)}` : `נסיעה נעימה · ${formatDistance(ride.estimatedDistanceM)} · ${formatDuration(ride.estimatedDurationS)}`}</>
          ) : phase === "to_pickup_pending" ? (
            <>
              {name} מחכה לך ב{shortAddress(ride.pickup.address)}
            </>
          ) : (
            <>{distToTarget != null && distToTarget > 30 ? `נקודת האיסוף במרחק ${formatDistance(distToTarget)} ממך` : `ממש קרוב — ${shortAddress(ride.pickup.address)}`}</>
          )}
        </p>
      </motion.div>

      {/* rider + money */}
      <div className={cn(TILE, "flex items-center gap-3 rounded-[22px] p-3")}>
        {rider && <Avatar name={rider.name} size={46} />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-extrabold">{rider?.name ?? "נוסע"}</div>
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            {rider?.rating != null && (
              <span className="inline-flex items-center gap-1 font-bold text-fg">
                <Star size={12} className="fill-amber-400 text-amber-400" aria-hidden />
                <span className="tabular-nums">{rider.rating.toFixed(1)}</span>
              </span>
            )}
            {rider?.phoneMasked && <span className="ltr-nums">{rider.phoneMasked}</span>}
          </div>
        </div>
        <div className="text-end">
          <div className={cn("display text-[1.6rem] leading-none tabular-nums", TEXT.brand)}>
            <CountUp value={payout} format={(n) => formatILS(n)} duration={0.6} from={payout} />
          </div>
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-fg-muted">
            {ride.paymentMethod === "cash" ? <Banknote size={13} aria-hidden /> : <CreditCard size={13} aria-hidden />}
            {ride.paymentMethod === "cash" ? `מזומן · לגבות ${formatILS(ride.quotedTotalAgorot)}` : PAYMENT_METHOD_HE[ride.paymentMethod]}
          </div>
        </div>
      </div>

      {/* destination + navigation */}
      <div className={cn(TILE, "rounded-[22px] p-3.5")}>
        <div className="flex items-start gap-3">
          <span aria-hidden className={cn("mt-1 h-4 w-4 shrink-0 border-[3px] border-white", toPickup ? "rounded-full bg-brand shadow-[0_0_0_3px_rgba(36,87,255,0.18),0_3px_8px_-2px_rgba(36,87,255,0.6)]" : "rounded-[5px] bg-ink shadow-[0_0_0_1px_rgba(17,19,24,0.1),0_3px_8px_-2px_rgba(17,19,24,0.5)]")} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-fg-muted">{toPickup ? "נקודת איסוף" : "יעד"}</div>
            <div className="truncate text-base font-extrabold leading-snug" data-testid="ride-target-address">
              {target.address}
            </div>
            {toPickup && <div className="mt-0.5 truncate text-xs font-medium text-fg-muted">ואז ליעד: {ride.dropoff.address}</div>}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={wazeUrl(target)} target="_blank" rel="noopener noreferrer" className="btn btn-glass h-12 gap-2 text-sm" aria-label={`ניווט ב-Waze אל ${target.address}`}>
            <Navigation size={17} className="text-brand" aria-hidden /> ניווט ב-Waze
          </a>
          <a href={googleMapsUrl(target)} target="_blank" rel="noopener noreferrer" className="btn btn-glass h-12 gap-2 text-sm" aria-label={`ניווט ב-Google Maps אל ${target.address}`}>
            <Navigation size={17} className="text-brand" aria-hidden /> Google Maps
          </a>
        </div>
      </div>

      <Button
        size="lg"
        block
        variant={action === "complete" ? "success" : "primary"}
        className={cn("h-16 text-xl font-extrabold", action === "complete" && FILL.success)}
        onClick={onPrimary}
        loading={busy === action}
        disabled={busy != null}
        data-testid="ride-step"
      >
        <SwapText k={phase}>{PHASE_ACTION_HE[phase]}</SwapText>
      </Button>
      {canCancel && (
        <button type="button" onClick={() => setCancelOpen(true)} className={cn("mx-auto -my-1 min-h-11 rounded-full px-4 text-sm font-bold underline-offset-4 hover:underline", TEXT.danger)} data-testid="ride-cancel">
          ביטול הנסיעה
        </button>
      )}

      <Dialog
        open={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        role="alertdialog"
        title="לסיים את הנסיעה?"
        description="סיימו רק אחרי שהנוסע הגיע ליעד וירד מהרכב."
      >
        {ride.paymentMethod === "cash" ? (
          <div className="flex items-start gap-3 rounded-2xl bg-[color-mix(in_oklab,var(--warning)_12%,var(--surface))] p-3.5 text-sm ring-1 ring-warning/40">
            <Banknote size={22} className={cn("mt-0.5 shrink-0", TEXT.warning)} aria-hidden />
            <div>
            <div className="font-bold">תשלום במזומן</div>
            <div className="mt-0.5 text-fg-muted">
              גבו מהנוסע <span className="font-extrabold text-fg tabular-nums">{formatILS(ride.quotedTotalAgorot)}</span>
            </div>
            </div>
          </div>
        ) : (
          <div className={cn(TILE, "flex items-center gap-3 p-3.5 text-sm font-medium text-fg-muted")}>
            <CreditCard size={20} className="shrink-0 text-brand" aria-hidden />
            החיוב יתבצע בכרטיס (הדגמה) — אין צורך לגבות.
          </div>
        )}
        <div className="mt-4 grid gap-2">
          <Button
            variant="success"
            size="lg"
            block
            className={FILL.success}
            loading={busy === "complete"}
            data-testid="confirm-complete"
            onClick={async () => {
              const ok = await advance("complete");
              if (ok) setConfirmComplete(false);
            }}
          >
            כן, סיום נסיעה
          </Button>
          <Button variant="glass" block onClick={() => setConfirmComplete(false)}>
            עדיין לא
          </Button>
        </div>
      </Dialog>

      <CancelDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        loading={busy === "cancel"}
        onConfirm={async (reason) => {
          const ok = await cancelRide(reason);
          if (ok) setCancelOpen(false);
        }}
      />
    </div>
  );
}

function CancelDialog({ open, onClose, onConfirm, loading }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void; loading: boolean }) {
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const reason = DRIVER_CANCEL_REASONS.find((r) => r.id === reasonId);
  const text = reason ? (reason.id === "other" ? details.trim() || reason.label : details.trim() ? `${reason.label} — ${details.trim()}` : reason.label) : "";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      role="alertdialog"
      title="ביטול הנסיעה"
      description="הנסיעה תחזור לתור ותוצע לנהג אחר. ביטולים אחרי אישור פוגעים בנוסעים ועלולים להשפיע על החשבון."
    >
      <fieldset>
        <legend className="mb-2 text-sm font-bold">מה הסיבה?</legend>
        <div className="grid gap-1.5" role="radiogroup">
          {DRIVER_CANCEL_REASONS.map((r) => (
            <label
              key={r.id}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-1.5 text-sm font-semibold transition-[background-color,box-shadow]",
                reasonId === r.id ? "bg-[color-mix(in_oklab,var(--danger)_7%,var(--surface))] ring-2 ring-danger/45" : "bg-surface/70 ring-1 ring-line hover:bg-surface",
              )}
            >
              <input type="radio" name="cancel-reason" value={r.id} checked={reasonId === r.id} onChange={() => setReasonId(r.id)} className="h-4 w-4 accent-[var(--danger)]" />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      {reasonId && (
        <Textarea className="mt-3 min-h-[80px]" placeholder={reasonId === "other" ? "ספרו לנו בקצרה מה קרה" : "פרטים נוספים (לא חובה)"} value={details} onChange={(e) => setDetails(e.target.value.slice(0, 250))} aria-label="פרטים נוספים" />
      )}
      {reasonId === "safety" && (
        <p className="mt-2 text-xs text-fg-muted">
          בסכנה מיידית חייגו <a className="font-bold text-fg underline underline-offset-4" href="tel:100">100</a> (משטרה). אחרי הביטול אפשר לדווח לצוות הבטיחות במסך התמיכה.
        </p>
      )}
      <div className="mt-4 grid gap-2">
        <Button variant="danger" size="lg" block className={FILL.danger} disabled={!reason || (reasonId === "other" && !details.trim())} loading={loading} onClick={() => onConfirm(text)} data-testid="confirm-cancel">
          ביטול הנסיעה
        </Button>
        <Button variant="glass" block onClick={onClose}>
          חזרה לנסיעה
        </Button>
      </div>
    </Dialog>
  );
}
