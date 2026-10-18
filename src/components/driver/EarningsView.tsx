"use client";
/** Earnings: net (yours) vs gross vs HOP commission, per day. Completed rides only. */
import { useEffect, useState } from "react";
import { Info, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { formatILS } from "@/lib/format";
import type { EarningsDTO } from "@/lib/types";
import { DemoBanner, Segmented, Skeleton } from "@/components/ui";
import { DriverPage } from "./DriverPage";
import { CountUp, NeedleLoader, StaggerItem, StaggerList } from "./motion";
import { Notice } from "./Notice";
import { errorMessage } from "./errors";

type Range = "today" | "week" | "month" | "all";
const RANGES: { value: Range; label: string; long: string }[] = [
  { value: "today", label: "היום", long: "מאז חצות" },
  { value: "week", label: "שבוע", long: "7 הימים האחרונים" },
  { value: "month", label: "חודש", long: "30 הימים האחרונים" },
  { value: "all", label: "הכל", long: "מאז ההצטרפות" },
];

function dayLabel(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "Asia/Jerusalem" }).format(d),
    date: new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", timeZone: "Asia/Jerusalem" }).format(d),
  };
}

export function EarningsView() {
  const [range, setRange] = useState<Range>("today");
  const [data, setData] = useState<Partial<Record<Range, EarningsDTO>>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.driver
      .earnings(range)
      .then(({ earnings }) => {
        if (!active) return;
        setError(null);
        setData((d) => ({ ...d, [range]: earnings }));
      })
      .catch((err: unknown) => active && setError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, [range]);

  const e = data[range];
  const meta = RANGES.find((r) => r.value === range)!;
  const max = e ? Math.max(1, ...e.byDay.map((d) => d.netAgorot)) : 1;
  const avg = e && e.ridesCompleted > 0 ? Math.round(e.netAgorot / e.ridesCompleted) : null;

  return (
    <DriverPage title="הכנסות" subtitle="מבוסס על נסיעות שהושלמו בלבד">
      <div className="grid gap-4">
        <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} className="w-full justify-between [&>button]:min-h-11 [&>button]:flex-1 [&>button[aria-selected=true]]:bg-brand! [&>button[aria-selected=true]]:text-white! [&>button[aria-selected=true]]:shadow-[0_8px_24px_-10px_rgba(36,87,255,0.9)]!" />

        {error && (
          <Notice tone="danger" live title="לא הצלחנו לטעון את ההכנסות">
            {error}
          </Notice>
        )}

        <div className="glass glass-brand relative overflow-hidden p-5" data-testid="earnings-net">
          <span aria-hidden className="pointer-events-none absolute -end-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-white/80">נטו — שלך · {meta.long}</div>
              <div className="display mt-2 text-[3.1rem] leading-none tabular-nums">
                {e ? <CountUp key={range} value={e.netAgorot} format={(n) => formatILS(n)} /> : <Skeleton className="h-12 w-40 bg-white/20" />}
              </div>
              <div className="mt-3 text-sm text-white/85">
                {e ? (
                  <>
                    {e.ridesCompleted} נסיעות שהושלמו{avg != null && <> · ממוצע {formatILS(avg)} לנסיעה</>}
                  </>
                ) : (
                  "טוענים…"
                )}
              </div>
            </div>
            <TrendingUp size={28} className="shrink-0 text-white/70" aria-hidden />
          </div>
          {e?.isDemoTariff && <DemoBanner className="relative mt-4 border-white/30 bg-white/15 text-white!" text="תעריף הדגמה — הסכומים אינם אמיתיים" />}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MoneyStat label="ברוטו" hint="מה ששילמו הנוסעים" value={e?.grossAgorot} />
          <MoneyStat label="עמלת HOP" hint="כולל דמי הזמנה" value={e?.commissionAgorot} negative />
          <MoneyStat label="נטו (שלך)" hint="התשלום לנהג" value={e?.netAgorot} strong />
          <MoneyStat label="דמי ביטול" hint="מנוסעים שביטלו אחרי אישור" value={e?.cancellationFeesAgorot} />
        </div>

        <section className="card p-4" aria-labelledby="by-day">
          <h2 id="by-day" className="mb-3 text-base font-extrabold">
            לפי ימים
          </h2>
          {!e ? (
            <div className="flex items-center gap-3 py-4">
              <NeedleLoader size={32} />
              <span className="text-sm text-fg-muted">סוכמים את הנסיעות…</span>
            </div>
          ) : e.byDay.length === 0 ? (
            <div className="py-8 text-center">
              <div className="display text-lg">{range === "today" ? "היום עוד לא התחיל" : "שקט בתקופה הזו"}</div>
              <p className="mt-1 text-sm text-fg-muted">{range === "today" ? "ההכנסה הראשונה של היום תופיע כאן ברגע שתסיימו נסיעה." : "אין נסיעות שהושלמו בטווח הזה. נסו טווח רחב יותר."}</p>
            </div>
          ) : (
            <StaggerList key={range} className="grid gap-1">
              {e.byDay.map((d) => {
                const l = dayLabel(d.date);
                return (
                  <StaggerItem key={d.date} className="rounded-2xl px-2 py-2.5 hover:bg-[color-mix(in_oklab,var(--fg)_4%,transparent)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold">
                          {l.weekday} <span className="font-semibold text-fg-muted">· {l.date}</span>
                        </div>
                        <div className="text-xs text-fg-muted">
                          {d.rides} נסיעות · ברוטו {formatILS(d.grossAgorot)}
                        </div>
                      </div>
                      <div className="text-end text-base font-extrabold tabular-nums">{formatILS(d.netAgorot)}</div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--fg)_8%,transparent)]" aria-hidden>
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (d.netAgorot / max) * 100)}%` }} />
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          )}
        </section>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-muted">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          מבוסס על נסיעות שהושלמו בלבד, ללא תחזיות. כל הסכומים מחושבים בשרת לפי התעריף שאושר לנוסע לפני ההזמנה.
        </p>
      </div>
    </DriverPage>
  );
}

function MoneyStat({ label, hint, value, negative, strong }: { label: string; hint: string; value: number | undefined; negative?: boolean; strong?: boolean }) {
  return (
    <div className={"card p-4 " + (strong ? "border-brand/40 bg-brand/10" : "")}>
      <div className="text-xs font-bold text-fg-muted">{label}</div>
      <div className={"mt-1 text-xl font-extrabold tabular-nums tracking-tight " + (strong ? "text-[#a9c0ff]" : "")}>
        {value == null ? <Skeleton className="h-6 w-20" /> : negative && value > 0 ? formatILS(-value) : formatILS(value)}
      </div>
      <div className="mt-0.5 text-[11px] text-fg-muted">{hint}</div>
    </div>
  );
}
