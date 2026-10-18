"use client";
import { useMemo, useState } from "react";
import { Download, TableProperties } from "lucide-react";
import { api, type AdminReport } from "@/lib/api";
import { formatDate, formatDistance, formatILS } from "@/lib/format";
import { LEDGER_TYPE_HE } from "@/lib/labels";
import { Button, DemoBanner, EmptyState, Segmented, useToast } from "@/components/ui";
import { dateInputValue, endOfDayIso, startOfDayIso, useLoad, useQueryParams } from "../hooks";
import { DataTable, ErrorState, Kpi, Muted, Page, PageHeader, Panel } from "../ui";
import { BarChart, type BarDatum } from "../BarChart";

type Preset = "7" | "30" | "90" | "custom";
type Metric = "gross" | "commission" | "payout" | "rides";
const METRICS: { value: Metric; label: string }[] = [
  { value: "gross", label: "ברוטו" },
  { value: "commission", label: "עמלת HOP" },
  { value: "payout", label: "לנהגים" },
  { value: "rides", label: "נסיעות" },
];

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d); // YYYY-MM-DD
const dayLabel = (key: string) => {
  const [, m, d] = key.split("-").map(Number);
  return `${d}.${m}`;
};
const compactILS = (agorot: number) => `₪${new Intl.NumberFormat("he-IL", { notation: "compact", maximumFractionDigits: 1 }).format(agorot / 100)}`;

function fillDays(report: AdminReport) {
  const byKey = new Map(report.byDay.map((d) => [d.day, d]));
  const from = new Date(report.from);
  const to = new Date(report.to);
  const out: AdminReport["byDay"] = [];
  const days = Math.min(400, Math.ceil((to.getTime() - from.getTime()) / 86_400_000) + 1);
  for (let i = 0; i < days; i++) {
    const k = dayKey(new Date(from.getTime() + i * 86_400_000));
    if (out.length && out[out.length - 1].day === k) continue;
    out.push(byKey.get(k) ?? { day: k, rides: 0, grossAgorot: 0, commissionAgorot: 0, payoutAgorot: 0, distanceM: 0 });
    if (k >= dayKey(to)) break;
  }
  return out;
}

function csvEscape(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(report: AdminReport, serviceName: (id: string) => string) {
  const ils = (a: number) => (a / 100).toFixed(2);
  const rows: (string | number)[][] = [
    ["דוח HOP", `${formatDate(report.from)} – ${formatDate(report.to)}`, report.isDemoTariff ? "תעריף הדגמה — הנתונים אינם אמיתיים" : ""],
    [],
    ["סיכום", "ערך"],
    ["נסיעות שהושלמו", report.totals.rides],
    ["הכנסה ברוטו (₪)", ils(report.totals.gross)],
    ["עמלת HOP (₪)", ils(report.totals.commission)],
    ["תשלומים לנהגים (₪)", ils(report.totals.payout)],
    ["ביטולים", report.totals.cancelled],
    ["דמי ביטול (₪)", ils(report.totals.cancellationFeesAgorot)],
    ["החזרים (₪)", ils(report.totals.refundsAgorot)],
    ["עמלה נטו (₪)", ils(report.totals.netCommissionAgorot)],
    [],
    ["תאריך", "נסיעות", "ברוטו (₪)", "עמלת HOP (₪)", "תשלום לנהגים (₪)", "מרחק (ק״מ)"],
    ...fillDays(report).map((d) => [d.day, d.rides, ils(d.grossAgorot), ils(d.commissionAgorot), ils(d.payoutAgorot), (d.distanceM / 1000).toFixed(1)]),
    [],
    ["סוג שירות", "נסיעות", "ברוטו (₪)"],
    ...report.byService.map((s) => [serviceName(s.serviceTypeId), s.rides, ils(s.grossAgorot)]),
    [],
    ["סוג תנועה", "תנועות", "סכום (₪)"],
    ...report.ledger.map((l) => [LEDGER_TYPE_HE[l.type as keyof typeof LEDGER_TYPE_HE] ?? l.type, l.entries, ils(l.totalAgorot)]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `hop-report-${report.from.slice(0, 10)}_${report.to.slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Reports() {
  const toast = useToast();
  const [params, setParams] = useQueryParams();
  const presetRaw = params.get("range") as Preset | null;
  const preset: Preset = presetRaw === "7" || presetRaw === "90" || presetRaw === "custom" ? presetRaw : "30";
  const [today] = useState(() => dateInputValue(new Date()));
  const customFrom = params.get("from") ?? "";
  const customTo = params.get("to") ?? today;
  const range = useMemo(() => {
    if (preset === "custom") return customFrom ? { from: startOfDayIso(customFrom), to: endOfDayIso(customTo) } : null;
    const days = Number(preset);
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [preset, customFrom, customTo]);
  const [metric, setMetric] = useState<Metric>("gross");
  const { data, error, loading, refreshing, reload } = useLoad(range ? `report:${preset}:${preset === "custom" ? `${range.from}:${range.to}` : ""}` : null, () => api.admin.reports(range ?? {}));
  const services = useLoad("service-types-admin", () => api.admin.serviceTypes());
  const serviceName = (id: string) => services.data?.serviceTypes.find((s) => s.id === id)?.nameHe ?? id;

  const days = useMemo(() => (data ? fillDays(data) : []), [data]);
  const chartData: BarDatum[] = days.map((d) => {
    const value = metric === "gross" ? d.grossAgorot : metric === "commission" ? d.commissionAgorot : metric === "payout" ? d.payoutAgorot : d.rides;
    return { key: d.day, label: dayLabel(d.day), value, detail: metric === "rides" ? formatILS(d.grossAgorot) + " ברוטו" : `${d.rides} נסיעות` };
  });
  const isMoney = metric !== "rides";
  const t = data?.totals;
  const awaitingCustom = preset === "custom" && !customFrom;

  return (
    <Page>
      <PageHeader
        title="דוחות"
        busy={refreshing}
        description="סיכום כספי ותפעולי לפי טווח תאריכים. ברוטו הוא מה שהנוסעים שילמו; הוא מתחלק לעמלת HOP ולתשלום לנהגים."
        meta={data?.isDemoTariff && <DemoBanner text="תעריף הדגמה — הסכומים אינם אמיתיים" />}
        actions={
          <Button
            variant="glass"
            size="sm"
            disabled={!data}
            onClick={() => {
              if (!data) return;
              exportCsv(data, serviceName);
              toast.success("קובץ CSV ירד למחשב");
            }}
          >
            <Download size={16} aria-hidden />
            ייצוא CSV
          </Button>
        }
      />

      <div className="card mb-5 flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:p-4">
        <Segmented<Preset>
          value={preset}
          onChange={(v) => setParams({ range: v === "30" ? null : v, from: v === "custom" ? customFrom || dateInputValue(new Date(Date.now() - 14 * 86_400_000)) : null, to: v === "custom" ? customTo : null })}
          options={[
            { value: "7", label: "7 ימים" },
            { value: "30", label: "30 ימים" },
            { value: "90", label: "90 ימים" },
            { value: "custom", label: "טווח מותאם" },
          ]}
        />
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="rep-from">
              מתאריך
            </label>
            <input id="rep-from" type="date" className="input h-10 w-auto bg-surface text-sm" value={customFrom} max={customTo} onChange={(e) => setParams({ from: e.target.value || null })} />
            <span className="text-fg-muted">עד</span>
            <label className="sr-only" htmlFor="rep-to">
              עד תאריך
            </label>
            <input id="rep-to" type="date" className="input h-10 w-auto bg-surface text-sm" value={customTo} min={customFrom} max={today} onChange={(e) => setParams({ to: e.target.value || null })} />
          </div>
        )}
        {data && (
          <span className="text-sm text-fg-muted sm:ms-auto">
            {formatDate(data.from)} – {formatDate(data.to)}
          </span>
        )}
      </div>

      {awaitingCustom ? (
        <div className="card">
          <EmptyState title="בחרו טווח תאריכים" description="בחרו תאריך התחלה כדי להפיק את הדוח." />
        </div>
      ) : error && !data ? (
        <div className="card">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : (
        <>
          <section aria-label="סיכומים" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Kpi index={0} loading={loading} label="נסיעות שהושלמו" value={t?.rides ?? 0} hint={t ? `${formatDistance(t.distanceM)} בסך הכל` : undefined} />
            <Kpi index={1} loading={loading} label="הכנסה ברוטו (נוסעים שילמו)" value={t?.gross ?? 0} kind="ils" />
            <Kpi index={2} loading={loading} label="עמלת HOP" value={t?.commission ?? 0} kind="ils" hint={t?.gross ? `${((t.commission / t.gross) * 100).toFixed(1)}% מהברוטו` : undefined} />
            <Kpi index={3} loading={loading} label="תשלומים לנהגים" value={t?.payout ?? 0} kind="ils" />
            <Kpi index={4} loading={loading} label="ביטולים" value={t?.cancelled ?? 0} />
            <Kpi index={5} loading={loading} label="דמי ביטול" value={t?.cancellationFeesAgorot ?? 0} kind="ils" />
            <Kpi index={6} loading={loading} label="החזרים לנוסעים" value={t?.refundsAgorot ?? 0} kind="ils" hint="מופחתים מהעמלה נטו" />
            <Kpi index={7} loading={loading} label="עמלה נטו" value={t?.netCommissionAgorot ?? 0} kind="ils" hint="עמלה + דמי ביטול − החזרים" />
          </section>

          <Panel
            className="mt-5"
            index={1}
            title="לפי יום"
            description={METRICS.find((m) => m.value === metric)?.label === "ברוטו" ? "הכנסה ברוטו ליום (נסיעות שהושלמו)" : `${METRICS.find((m) => m.value === metric)?.label} ליום`}
            actions={<Segmented<Metric> size="sm" value={metric} onChange={setMetric} options={METRICS} />}
          >
            {loading ? (
              <div className="skeleton h-[260px] w-full" aria-hidden />
            ) : days.every((d) => d.rides === 0) ? (
              <EmptyState title="אין נסיעות בטווח הזה" description="נסו טווח תאריכים רחב יותר." />
            ) : (
              <>
                <BarChart
                  data={chartData}
                  ariaLabel={`תרשים עמודות: ${METRICS.find((m) => m.value === metric)?.label} לפי יום, ${days.length} ימים`}
                  formatValue={(v) => (isMoney ? formatILS(v) : `${v} נסיעות`)}
                  formatTick={(v) => (isMoney ? compactILS(v) : String(v))}
                />
                <details className="group mt-3">
                  <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-full px-2 text-sm font-bold text-brand hover:bg-brand-50 [&::-webkit-details-marker]:hidden">
                    <TableProperties size={15} aria-hidden />
                    הצגת הנתונים כטבלה
                  </summary>
                  <div className="mt-2 max-h-80 overflow-auto rounded-2xl border border-line">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-surface">
                        <tr className="border-b border-line text-xs text-fg-muted">
                          <th className="px-3 py-2 text-start font-semibold">תאריך</th>
                          <th className="px-3 py-2 text-end font-semibold">נסיעות</th>
                          <th className="px-3 py-2 text-end font-semibold">ברוטו</th>
                          <th className="px-3 py-2 text-end font-semibold">עמלת HOP</th>
                          <th className="px-3 py-2 text-end font-semibold">לנהגים</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line tabular-nums">
                        {days
                          .filter((d) => d.rides > 0)
                          .map((d) => (
                            <tr key={d.day}>
                              <td className="px-3 py-1.5">{formatDate(d.day + "T12:00:00Z")}</td>
                              <td className="px-3 py-1.5 text-end">{d.rides}</td>
                              <td className="px-3 py-1.5 text-end">{formatILS(d.grossAgorot)}</td>
                              <td className="px-3 py-1.5 text-end">{formatILS(d.commissionAgorot)}</td>
                              <td className="px-3 py-1.5 text-end">{formatILS(d.payoutAgorot)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
          </Panel>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Panel title="לפי סוג שירות" flush index={2}>
              <DataTable
                rows={data?.byService}
                loading={loading}
                rowKey={(s) => s.serviceTypeId}
                empty={<EmptyState title="אין נתונים" />}
                columns={[
                  { key: "name", header: "סוג שירות", card: "title", cell: (s) => <span className="font-semibold">{serviceName(s.serviceTypeId)}</span> },
                  { key: "rides", header: "נסיעות", align: "end", cell: (s) => <span className="tabular-nums">{s.rides}</span> },
                  { key: "gross", header: "ברוטו", align: "end", cell: (s) => <span className="tabular-nums">{formatILS(s.grossAgorot)}</span> },
                  {
                    key: "share",
                    header: "חלק מהברוטו",
                    align: "end",
                    cell: (s) => {
                      const share = t?.gross ? (s.grossAgorot / t.gross) * 100 : 0;
                      return (
                        <span className="inline-flex items-center justify-end gap-2">
                          <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--fg)_8%,transparent)] sm:block" aria-hidden>
                            <span className="block h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                          </span>
                          <span className="tabular-nums">{share.toFixed(0)}%</span>
                        </span>
                      );
                    },
                  },
                ]}
              />
            </Panel>
            <Panel title="סיכום ספר החשבונות" description="סכום התנועות לפי סוג בטווח" flush index={3}>
              <DataTable
                rows={data?.ledger}
                loading={loading}
                rowKey={(l) => l.type}
                empty={<EmptyState title="אין תנועות בטווח" />}
                columns={[
                  { key: "type", header: "סוג תנועה", card: "title", cell: (l) => <span className="font-semibold">{LEDGER_TYPE_HE[l.type as keyof typeof LEDGER_TYPE_HE] ?? l.type}</span> },
                  { key: "entries", header: "תנועות", align: "end", cell: (l) => <span className="tabular-nums">{l.entries}</span> },
                  { key: "total", header: "סכום", align: "end", cell: (l) => <span className={l.totalAgorot < 0 ? "font-semibold tabular-nums text-danger" : "font-semibold tabular-nums"}>{formatILS(l.totalAgorot)}</span> },
                ]}
              />
              {data && data.ledger.length > 0 && <p className="border-t border-line px-5 py-3 text-xs text-fg-muted">החזרים רשומים כסכום שלילי. <Muted>כל סוג תנועה מוצג בנפרד — אין לסכם ביניהם.</Muted></p>}
            </Panel>
          </div>
        </>
      )}
    </Page>
  );
}
