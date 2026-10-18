"use client";
import { useState } from "react";
import { Route } from "lucide-react";
import { api } from "@/lib/api";
import { RIDE_STATUS_SHORT_HE } from "@/lib/labels";
import type { RideStatus } from "@/lib/types";
import { EmptyState, Toggle } from "@/components/ui";
import { useAdminFeed } from "../realtime";
import { endOfDayIso, startOfDayIso, useDebouncedCallback, useDebouncedValue, useLoad, useQueryParams } from "../hooks";
import { DataTable, ErrorState, Page, PageHeader, Panel, SearchField } from "../ui";
import { rideColumns } from "../rides";

const STATUSES: RideStatus[] = ["requested", "searching", "offered", "accepted", "driver_arriving", "in_progress", "completed", "cancelled"];
const columns = rideColumns({ flags: true, service: true });

export function RidesList() {
  const [params, setParams] = useQueryParams();
  const statusRaw = params.get("status") ?? "";
  const status = statusRaw === "active" || STATUSES.includes(statusRaw as RideStatus) ? statusRaw : "";
  const flagged = params.get("flagged") === "1";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q.trim(), 300);
  const key = `rides:${status}:${flagged}:${from}:${to}:${dq}`;
  const { data, error, loading, refreshing, reload } = useLoad(key, () =>
    api.admin.rides({ status: status || undefined, flagged, q: dq || undefined, from: from ? startOfDayIso(from) : undefined, to: to ? endOfDayIso(to) : undefined, limit: 200 }),
  );
  const debounced = useDebouncedCallback(reload, 1500);
  useAdminFeed((e) => {
    if (e.type === "admin.ride" || e.type === "reconnect") debounced();
  });
  const hasFilters = !!(status || flagged || from || to || dq);

  return (
    <Page>
      <PageHeader title="נסיעות" description="כל הנסיעות בפלטפורמה. לחצו על נסיעה לצפייה במסלול, בציר הזמן ובפירוט הכספי." />
      <Panel flush>
        <div className="grid gap-3 border-b border-line px-4 py-3.5 sm:grid-cols-2 sm:px-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label className="field-label" htmlFor="ride-search">
              חיפוש
            </label>
            <SearchField id="ride-search" value={q} onChange={setQ} label="חיפוש נסיעות" placeholder="כתובת איסוף / יעד או מזהה נסיעה" className="mt-1.5" />
          </div>
          <div>
            <label className="field-label" htmlFor="ride-status">
              סטטוס
            </label>
            <select id="ride-status" className="input mt-1.5 h-11 bg-surface py-0 text-sm" value={status} onChange={(e) => setParams({ status: e.target.value || null })}>
              <option value="">כל הסטטוסים</option>
              <option value="active">פעילות (בכל שלב)</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RIDE_STATUS_SHORT_HE[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="ride-from">
              מתאריך
            </label>
            <input id="ride-from" type="date" className="input mt-1.5 h-11 bg-surface text-sm" value={from} max={to || undefined} onChange={(e) => setParams({ from: e.target.value || null })} />
          </div>
          <div>
            <label className="field-label" htmlFor="ride-to">
              עד תאריך
            </label>
            <input id="ride-to" type="date" className="input mt-1.5 h-11 bg-surface text-sm" value={to} min={from || undefined} onChange={(e) => setParams({ to: e.target.value || null })} />
          </div>
          <div className="flex h-11 items-center gap-3 sm:col-span-2 lg:col-span-1">
            <Toggle checked={flagged} onChange={(v) => setParams({ flagged: v ? "1" : null })} label="מסומנות בלבד" />
            <span className="whitespace-nowrap text-sm font-semibold">מסומנות בלבד</span>
          </div>
        </div>
        {hasFilters && (
          <div className="flex items-center justify-between border-b border-line bg-brand-50/60 px-5 py-2 text-xs">
            <span className="font-semibold text-fg-muted tabular-nums">{data ? `${data.rides.length} נסיעות תואמות` : "מסנן…"}</span>
            <button
              type="button"
              className="h-8 rounded-full px-3 font-bold text-brand hover:bg-brand-100"
              onClick={() => {
                setQ("");
                setParams({ status: null, flagged: null, from: null, to: null });
              }}
            >
              ניקוי סינון
            </button>
          </div>
        )}
        {error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <div className={refreshing ? "opacity-70 transition-opacity" : "transition-opacity"}>
            <DataTable
              rows={data?.rides}
              loading={loading}
              columns={columns}
              rowKey={(r) => r.id}
              rowHref={(r) => `/admin/rides/${r.id}`}
              caption="רשימת נסיעות"
              empty={<EmptyState icon={<Route size={24} />} title={hasFilters ? "אין נסיעות שתואמות לסינון" : "עדיין אין נסיעות"} description={hasFilters ? "נסו להרחיב את טווח התאריכים או לנקות את הסינון." : undefined} />}
            />
          </div>
        )}
      </Panel>
    </Page>
  );
}
