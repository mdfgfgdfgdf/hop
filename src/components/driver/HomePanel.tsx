"use client";
/** Idle home panel: availability card (white offline → blue glass online), live status, today's stats. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { LocateOff, Star, WifiOff } from "lucide-react";
import { formatILS } from "@/lib/format";
import { VERIFICATION_STATUS_HE } from "@/lib/labels";
import type { EarningsDTO } from "@/lib/types";
import { Button, Skeleton, cn } from "@/components/ui";
import { useDriverRuntime } from "./DriverRuntime";
import { Notice } from "./Notice";
import { DRIVER_NAV } from "./DriverMenu";
import { BigSwitch, CountUp } from "./motion";
import { OFFLINE_LINES, WAITING_LINES } from "./copy";
import { BRAND_GLASS, CHIP, TEXT, TILE } from "./tone";

function useRotatingLine(lines: string[], ms = 5200) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % lines.length), ms);
    return () => clearInterval(id);
  }, [lines.length, ms]);
  return lines[i % lines.length];
}

export function HomePanel({ earnings, earningsError, showNav }: { earnings: EarningsDTO | null; earningsError: boolean; showNav: boolean }) {
  const { profile, approved, geo, busy, availabilityError, clearAvailabilityError, setOnline, reportingFailing, realtimeConnected } = useDriverRuntime();
  const online = profile?.availability != null && profile.availability !== "offline";
  const line = useRotatingLine(online ? WAITING_LINES : OFFLINE_LINES);

  if (!profile) {
    return (
      <div className="grid gap-3" aria-busy>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!approved) {
    return (
      <div className="grid gap-4">
        <h2 className="display text-2xl">החשבון אינו פעיל לנסיעות</h2>
        <Notice tone={profile.verificationStatus === "suspended" || profile.verificationStatus === "rejected" ? "danger" : "warning"} title={`סטטוס: ${VERIFICATION_STATUS_HE[profile.verificationStatus]}`}>
          ניתן לקבל נסיעות רק לאחר שהחשבון והמסמכים אושרו על ידי צוות HOP.
        </Notice>
        <Link href="/drive/onboarding" className="btn btn-primary btn-lg btn-block">
          למסך ההצטרפות והמסמכים
        </Link>
      </div>
    );
  }

  const toggling = busy === "online" || busy === "offline";
  const acceptance = profile.offersReceived > 0 ? Math.round((profile.offersAccepted / profile.offersReceived) * 100) : null;

  return (
    <div className="grid gap-3.5">
      {/* availability: a white cell offline, blue liquid glass online */}
      <div className={cn("relative isolate overflow-hidden rounded-[26px] p-4 transition-colors duration-500", online ? "text-white" : cn(TILE, "rounded-[26px]"))}>
        <AnimatePresence initial={false}>
          {online && (
            <motion.span
              key="brand"
              aria-hidden
              className={cn(BRAND_GLASS, "absolute inset-0 -z-10 rounded-[inherit]")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            />
          )}
        </AnimatePresence>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1" aria-live="polite">
            <div className={cn("flex items-center gap-1.5 text-[13px] font-bold", online ? "text-white" : "text-fg-muted")}>
              <span aria-hidden className={cn("relative inline-flex h-2 w-2 rounded-full", online ? "bg-white" : "bg-mist")}>
                {online && <span className="absolute inset-0 animate-ping rounded-full bg-white/70 [animation-duration:2.2s]" />}
              </span>
              {online ? "זמינים לנסיעות" : "לא זמינים כרגע"}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={online ? "on" : "off"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="display mt-1.5 text-[1.55rem] leading-tight"
                data-testid="availability-title"
              >
                {online ? "ממתינים להזמנות" : "מוכנים לצאת?"}
              </motion.h2>
            </AnimatePresence>
            <div className={cn("mt-1 h-10 overflow-hidden text-sm leading-5", online ? "font-medium text-white" : "text-fg-muted")}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p key={line} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28 }}>
                  {line}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <div className="grid shrink-0 place-items-center">
            <BigSwitch checked={online} onBrand={online} onChange={(v) => void setOnline(v)} disabled={toggling} busy={toggling} label={online ? "זמין לנסיעות — לחצו למעבר למצב לא זמין" : "לא זמין — לחצו כדי להתחיל לקבל נסיעות"} />
            <span className={cn("mt-1.5 text-[11px] font-bold", online ? "text-white" : "text-fg-muted")}>{online ? "זמין" : "לא זמין"}</span>
          </div>
        </div>
      </div>

      {availabilityError && (
        <Notice tone="danger" live title="לא הצלחנו לעדכן זמינות" action={<button type="button" className="min-h-11 text-xs font-bold text-fg underline underline-offset-4" onClick={clearAvailabilityError}>הבנתי</button>}>
          {availabilityError}
        </Notice>
      )}
      {!availabilityError && geo.status === "denied" && (
        <Notice
          tone="warning"
          live
          title="אין הרשאת מיקום"
          action={
            <Button size="sm" variant="glass" onClick={geo.retry}>
              <LocateOff size={16} aria-hidden /> ניסיון נוסף
            </Button>
          }
        >
          כדי לקבל הצעות נסיעה HOP צריכה את המיקום שלכם. אפשרו גישה למיקום בהגדרות הדפדפן ונסו שוב.
        </Notice>
      )}
      {!availabilityError && (geo.status === "unavailable" || geo.status === "unsupported") && (
        <Notice tone="warning" live title="לא מצליחים לאתר מיקום">
          ודאו שה-GPS פעיל ושיש קליטה. בלי מיקום עדכני לא תקבלו הצעות.
        </Notice>
      )}
      {online && reportingFailing && (
        <Notice tone="warning" live title="המיקום לא מתעדכן בשרת">
          נמשיך לנסות. בדקו את חיבור האינטרנט.
        </Notice>
      )}
      {online && !realtimeConnected && !reportingFailing && (
        <div className="flex items-center gap-2 px-1 text-xs text-fg-muted" role="status">
          <WifiOff size={14} aria-hidden /> החיבור החי מתחדש — ממשיכים לבדוק הצעות כל כמה שניות
        </div>
      )}

      <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-2" aria-label="נתוני היום">
        <StatTile
          href="/drive/earnings"
          label="נטו היום"
          loading={!earnings && !earningsError}
          value={earnings ? <CountUp value={earnings.netAgorot} format={(n) => formatILS(n)} /> : "—"}
          accent
        />
        <StatTile href="/drive/earnings" label="נסיעות" loading={!earnings && !earningsError} value={earnings ? <CountUp value={earnings.ridesCompleted} format={String} duration={0.6} /> : "—"} />
        <StatTile
          label="דירוג"
          value={
            profile.rating != null ? (
              <span className="inline-flex items-center gap-1">
                {profile.rating.toFixed(1)}
                <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden />
              </span>
            ) : (
              "חדש"
            )
          }
        />
        <StatTile label="קבלה" value={acceptance != null ? <CountUp value={acceptance} format={(n) => `${n}%`} duration={0.7} /> : "—"} />
      </div>

      {showNav && (
        <ul className="grid grid-cols-2 gap-2">
          {DRIVER_NAV.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className={cn(TILE, "flex min-h-14 items-center gap-2.5 px-2.5 text-sm font-bold transition-colors hover:bg-surface")}>
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", CHIP.brand)}>
                  <Icon size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 leading-tight">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatTile({ label, value, href, loading, accent }: { label: string; value: React.ReactNode; href?: string; loading?: boolean; accent?: boolean }) {
  const body = (
    <>
      <div className="truncate text-[11px] font-bold text-fg-muted">{label}</div>
      {loading ? <Skeleton className="mt-1.5 h-5 w-12" /> : <div className={cn("display mt-1 truncate text-[1.08rem] tabular-nums", accent && TEXT.brand)}>{value}</div>}
    </>
  );
  const cls = cn(TILE, "block min-h-[66px] min-w-0 px-2.5 py-2.5");
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-surface")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
