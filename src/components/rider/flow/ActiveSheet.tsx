"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flag, Lock, Share2, ShieldAlert, XCircle } from "lucide-react";
import { formatEta, formatILS, formatTime } from "@/lib/format";
import { PAYMENT_METHOD_HE, RIDE_STATUS_HE } from "@/lib/labels";
import type { RideDTO } from "@/lib/types";
import { useToast } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import type { DriverPos } from "../ActiveRideProvider";
import { DriverCard } from "../DriverCard";
import { RouteSummary } from "../RouteSummary";
import { distanceM, etaSeconds, polylineLength, remainingRoute } from "../lib/geo";
import { useNow } from "../lib/hooks";
import { CancelRideDialog, FREE_CANCEL_SEC } from "./CancelRideDialog";
import { SafetyDialog } from "./SafetyDialog";

export function driverFirstName(ride: RideDTO) {
  return ride.driver?.name.split(/\s+/)[0] ?? "הנהג";
}

/** Headline + a short human line that follows the ride's state. */
export function activeCopy(ride: RideDTO, etaS: number | null) {
  const first = driverFirstName(ride);
  const mins = etaS != null ? Math.max(1, Math.round(etaS / 60)) : null;
  if (ride.status === "accepted") return { title: RIDE_STATUS_HE.accepted, line: `${first} בדרך אליך` };
  if (ride.status === "driver_arriving" && ride.arrivedAt) return { title: "הנהג הגיע", line: `${first} מחכה לך בנקודת האיסוף` };
  if (ride.status === "driver_arriving") return { title: `${first} בדרך אליך`, line: mins != null ? `בעוד ~${mins} דק' ${first} אצלך` : `איסוף מ־${ride.pickup.address}` };
  if (ride.status === "in_progress") return { title: RIDE_STATUS_HE.in_progress, line: `בדרך אל ${ride.dropoff.address}` };
  return { title: RIDE_STATUS_HE[ride.status], line: "" };
}

export function ActiveSheet({ ride, driverPos, onCancelled }: { ride: RideDTO; driverPos: DriverPos | null; onCancelled: (ride: RideDTO) => void }) {
  const toast = useToast();
  const now = useNow(5000);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const inProgress = ride.status === "in_progress";
  const arrived = ride.status === "driver_arriving" && !!ride.arrivedAt;
  const feeLikely = !!ride.acceptedAt && (now - Date.parse(ride.acceptedAt)) / 1000 > FREE_CANCEL_SEC;

  // Rider-facing estimates (≈8 m/s), always labelled "משוער".
  let etaS: number | null = null;
  if (driverPos && !arrived) {
    etaS = inProgress ? etaSeconds(polylineLength(remainingRoute(ride.polyline, driverPos))) : etaSeconds(distanceM(driverPos, ride.pickup));
  }
  const arrivalClock = inProgress && etaS != null ? formatTime(new Date(now + etaS * 1000).toISOString()) : null;
  const copy = activeCopy(ride, etaS);

  async function share() {
    const d = ride.driver;
    const pos = driverPos ?? ride.pickup;
    const mapUrl = `https://www.openstreetmap.org/?mlat=${pos.lat.toFixed(5)}&mlon=${pos.lng.toFixed(5)}#map=16/${pos.lat.toFixed(5)}/${pos.lng.toFixed(5)}`;
    const lines = [
      "אני בנסיעה עם HOP",
      `מ־${ride.pickup.address} אל ${ride.dropoff.address}`,
      d ? `נהג: ${d.name}${d.vehicle?.plate ? ` · רכב ${[d.vehicle.make, d.vehicle.model].filter(Boolean).join(" ")} · ${d.vehicle.plate}` : ""}` : null,
      arrivalClock ? `הגעה משוערת: ${arrivalClock}` : null,
      `מיקום נוכחי: ${mapUrl}`,
    ].filter(Boolean);
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: "הנסיעה שלי ב־HOP", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("פרטי הנסיעה הועתקו", "הדביקו ושלחו למי שתרצו.");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      toast.error("לא הצלחנו לשתף", "נסו שוב או צלמו את המסך.");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div role="status" aria-live="polite" className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={copy.title}
              className={cn("display", arrived ? "text-[30px] text-brand" : "text-[26px]")}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              data-testid="ride-headline"
            >
              {copy.title}
            </motion.h2>
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={copy.line} className="mt-1 truncate text-sm text-fg-muted" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              {copy.line}
            </motion.p>
          </AnimatePresence>
        </div>
        {etaS != null && (
          <motion.div
            layout
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="shrink-0 rounded-2xl bg-brand px-3 py-2 text-center text-white shadow-[0_12px_24px_-12px_rgba(36,87,255,.8)]"
            data-testid="eta"
          >
            <div className="text-xl leading-none font-extrabold tabular-nums">~{formatEta(etaS)}</div>
            <div className="mt-1 text-[10px] font-bold text-white/85">{inProgress ? "ליעד · משוער" : "הגעה · משוער"}</div>
          </motion.div>
        )}
      </div>

      {ride.driver && (
        <div className="mt-4 rounded-[22px] border border-line bg-surface/80 p-3">
          <DriverCard driver={ride.driver} />
        </div>
      )}

      {inProgress ? (
        <div className="mt-3 rounded-[22px] border border-line bg-surface/70 p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/15 text-success">
              <Lock size={18} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-success">המחיר נעול — בלי הפתעות</div>
              <div className="display text-2xl ltr-nums" data-testid="locked-price">{formatILS(ride.quotedTotalAgorot)}</div>
            </div>
            {arrivalClock && (
              <div className="text-end">
                <div className="text-xs font-bold text-fg-muted">הגעה משוערת</div>
                <div className="text-lg font-extrabold tabular-nums">{arrivalClock}</div>
              </div>
            )}
          </div>
          <div className="divider my-2.5 [@media(max-height:720px)]:hidden" />
          <div className="flex items-center gap-2 text-sm [@media(max-height:720px)]:hidden">
            <Flag size={16} className="shrink-0 text-fg-muted" aria-hidden />
            <span className="truncate font-semibold">{ride.dropoff.address}</span>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-[22px] border border-line bg-surface/70 px-3 py-2 [@media(max-height:720px)]:hidden">
          <RouteSummary compact pickup={{ address: ride.pickup.address }} dropoff={{ address: ride.dropoff.address }} />
          <div className="divider my-1.5" />
          <div className="flex items-center justify-between gap-3 py-1 text-sm">
            <span className="font-bold">{ride.serviceType.nameHe}</span>
            <span className="flex items-center gap-2 text-fg-muted">
              {PAYMENT_METHOD_HE[ride.paymentMethod]}
              <span className="font-extrabold text-fg ltr-nums">{formatILS(ride.quotedTotalAgorot)}</span>
            </span>
          </div>
        </div>
      )}

      <div className={cn("mt-3 grid gap-2", inProgress ? "grid-cols-2" : "grid-cols-3")}>
        <ActionTile icon={<Share2 size={18} aria-hidden />} label={inProgress ? "שיתוף הנסיעה" : "שיתוף"} onClick={share} />
        <ActionTile icon={<ShieldAlert size={18} aria-hidden />} label="בטיחות" onClick={() => setSafetyOpen(true)} tone="brand" />
        {!inProgress && <ActionTile icon={<XCircle size={18} aria-hidden />} label="ביטול" onClick={() => setCancelOpen(true)} tone="danger" testId="cancel-ride" />}
      </div>
      {inProgress ? (
        <p className="mt-2.5 px-1 text-xs text-fg-muted">נסיעה שהחלה אינה ניתנת לביטול. צריכים עזרה? מרכז הבטיחות כאן.</p>
      ) : feeLikely ? (
        <p className="mt-2.5 px-1 text-xs font-semibold text-amber-800">שימו לב: ביטול עכשיו עלול לגרור דמי ביטול.</p>
      ) : (
        <p className="mt-2.5 px-1 text-xs text-fg-muted">ביטול חינם עד 2 דקות מאישור הנהג.</p>
      )}

      <CancelRideDialog ride={ride} open={cancelOpen} onClose={() => setCancelOpen(false)} onCancelled={onCancelled} feeLikely={feeLikely} />
      <SafetyDialog rideId={ride.id} open={safetyOpen} onClose={() => setSafetyOpen(false)} />
    </div>
  );
}

function ActionTile({ icon, label, onClick, tone, testId }: { icon: React.ReactNode; label: string; onClick: () => void; tone?: "brand" | "danger"; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface/70 px-3 text-[13px] font-bold transition-colors hover:bg-surface active:scale-[.97]",
        tone === "danger" && "text-danger",
        tone === "brand" && "text-brand",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
