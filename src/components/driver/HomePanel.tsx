"use client";
/** Idle home panel: greeting, spring availability switch, live status, today's stats. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, LocateOff, Star, WifiOff } from "lucide-react";
import { formatILS } from "@/lib/format";
import { VERIFICATION_STATUS_HE } from "@/lib/labels";
import type { EarningsDTO } from "@/lib/types";
import { Button, Skeleton, cn } from "@/components/ui";
import { useSession } from "@/components/app/session";
import { useDriverRuntime } from "./DriverRuntime";
import { Notice } from "./Notice";
import { DRIVER_NAV } from "./DriverMenu";
import { BigSwitch, CountUp } from "./motion";
import { OFFLINE_LINES, WAITING_LINES, useGreeting } from "./copy";

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
  const { user } = useSession();
  const greeting = useGreeting(user?.name);
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
    <div className="grid gap-4">
      <div
        className={cn(
          "relative overflow-hidden rounded-[26px] border p-4 transition-[background-color,border-color,box-shadow] duration-500",
          online
            ? "border-brand/45 bg-brand/14 shadow-[0_0_60px_-18px_rgba(36,87,255,0.95),inset_0_1px_0_rgba(255,255,255,0.12)]"
            : "border-line bg-[color-mix(in_oklab,var(--fg)_5%,transparent)]",
        )}
      >
        {/* soft brand aurora when online */}
        <AnimatePresence>
          {online && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute -inset-x-10 -top-16 h-32 rounded-full bg-brand/30 blur-3xl"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            />
          )}
        </AnimatePresence>
        <div className="relative flex items-center gap-4">
          <div className="min-w-0 flex-1" aria-live="polite">
            <div className="text-xs font-bold text-fg-muted" data-testid="greeting">
              {greeting}
              {online && <span className="text-[#8fb0ff]"> · זמינים לנסיעות</span>}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={online ? "on" : "off"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="display mt-1 text-[1.5rem] leading-tight"
                data-testid="availability-title"
              >
                {online ? "ממתינים להזמנות" : "מוכנים לצאת?"}
              </motion.h2>
            </AnimatePresence>
            <div className="mt-1 h-10 overflow-hidden text-sm leading-5 text-fg-muted">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p key={line} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28 }}>
                  {line}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <div className="relative grid place-items-center">
            <AnimatePresence>
              {online && (
                <motion.span
                  key="ripple"
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full border-2 border-brand"
                  initial={{ scale: 0.9, opacity: 0.8 }}
                  animate={{ scale: 1.9, opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>
            <BigSwitch checked={online} onChange={(v) => void setOnline(v)} disabled={toggling} busy={toggling} label={online ? "זמין לנסיעות — לחצו למעבר למצב לא זמין" : "לא זמין — לחצו כדי להתחיל לקבל נסיעות"} />
            <span className="mt-1.5 text-[11px] font-bold text-fg-muted">{online ? "זמין" : "לא זמין"}</span>
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
        <div className="flex items-center gap-2 text-xs text-fg-muted" role="status">
          <WifiOff size={14} aria-hidden /> החיבור החי מתחדש — ממשיכים לבדוק הצעות כל כמה שניות
        </div>
      )}

      <div className="grid grid-cols-[1.45fr_1fr_1fr_1fr] gap-2" aria-label="נתוני היום">
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
              <Link href={href} className="flex min-h-14 items-center gap-2.5 rounded-2xl bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] px-3 text-sm font-bold transition-colors hover:bg-[color-mix(in_oklab,var(--fg)_10%,transparent)]">
                <Icon size={18} aria-hidden className="text-fg-muted" />
                <span className="flex-1">{label}</span>
                <ChevronLeft size={16} className="text-fg-muted" aria-hidden />
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
      {loading ? <Skeleton className="mt-1.5 h-5 w-12" /> : <div className={cn("mt-1 truncate text-base font-extrabold tabular-nums", accent && "text-fg")}>{value}</div>}
    </>
  );
  const cls = "block min-h-16 min-w-0 rounded-2xl bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] px-2.5 py-2.5";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-[color-mix(in_oklab,var(--fg)_10%,transparent)]")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
