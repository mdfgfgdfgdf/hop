"use client";
import { useMemo, useState } from "react";
import { Car, Star } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import { VEHICLE_CLASS_HE, VERIFICATION_STATUS_HE } from "@/lib/labels";
import type { DriverProfileDTO, PublicUserDTO, VerificationStatus } from "@/lib/types";
import { EmptyState } from "@/components/ui";
import { useAdminFeed } from "../realtime";
import { useDebouncedCallback, useDebouncedValue, useLoad, useQueryParams } from "../hooks";
import { type Column, DataTable, ErrorState, FilterTabs, Ltr, Muted, Page, PageHeader, Panel, PersonCell, SearchField, Toolbar } from "../ui";
import { AvailabilityPill, VerificationPill } from "../pills";

type Row = { user: PublicUserDTO; profile: DriverProfileDTO };
type Tab = VerificationStatus | "all";
const TABS: Tab[] = ["under_review", "documents_required", "approved", "suspended", "rejected", "all"];

export function vehicleLine(p: Pick<DriverProfileDTO, "vehicleMake" | "vehicleModel" | "vehicleColor" | "vehicleYear">) {
  const parts = [p.vehicleMake, p.vehicleModel].filter(Boolean).join(" ");
  return [parts, p.vehicleColor, p.vehicleYear].filter(Boolean).join(" · ") || "—";
}

export function RatingCell({ rating, count }: { rating: number | null; count: number }) {
  if (rating == null) return <Muted>אין דירוג</Muted>;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
      <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden />
      <span className="font-semibold">{rating.toFixed(1)}</span>
      <span className="text-xs text-fg-muted">({count})</span>
    </span>
  );
}

export function acceptance(p: Pick<DriverProfileDTO, "offersAccepted" | "offersReceived">) {
  return p.offersReceived > 0 ? Math.round((p.offersAccepted / p.offersReceived) * 100) : null;
}

const columns: Column<Row>[] = [
  { key: "driver", header: "נהג", card: "title", cell: (r) => <PersonCell name={r.user.name} sub={<Ltr>{r.user.email}</Ltr>} /> },
  {
    key: "vehicle",
    header: "רכב",
    cell: (r) => (
      <div className="min-w-0">
        <div className="truncate">{vehicleLine(r.profile)}</div>
        {r.profile.vehiclePlate && <Ltr className="text-xs text-fg-muted">{r.profile.vehiclePlate}</Ltr>}
      </div>
    ),
  },
  { key: "class", header: "סוג רכב", hideBelow: "lg", cell: (r) => VEHICLE_CLASS_HE[r.profile.vehicleClass] },
  { key: "verification", header: "אימות", card: "badge", cell: (r) => <VerificationPill status={r.profile.verificationStatus} /> },
  { key: "availability", header: "זמינות", cell: (r) => <AvailabilityPill availability={r.profile.availability} /> },
  { key: "rating", header: "דירוג", cell: (r) => <RatingCell rating={r.profile.rating} count={r.profile.ratingCount} /> },
  {
    key: "offers",
    header: "הצעות שהתקבלו",
    cardLabel: "הצעות (אושרו/התקבלו)",
    hideBelow: "lg",
    cell: (r) => {
      const pct = acceptance(r.profile);
      return (
        <span className="whitespace-nowrap tabular-nums">
          {r.profile.offersAccepted}/{r.profile.offersReceived}
          {pct != null && <span className="ms-1.5 text-xs text-fg-muted">({pct}%)</span>}
        </span>
      );
    },
  },
  { key: "joined", header: "הצטרף", hideBelow: "xl", cell: (r) => <span className="whitespace-nowrap text-fg-muted" title={formatDate(r.profile.createdAt)}>{formatRelative(r.profile.createdAt)}</span> },
];

export function DriversList() {
  const [params, setParams] = useQueryParams();
  const raw = params.get("status");
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "under_review";
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q.trim(), 300);
  const { data, error, loading, refreshing, reload } = useLoad(`drivers:${dq}`, () => api.admin.drivers({ q: dq || undefined, limit: 500 }));
  const debouncedReload = useDebouncedCallback(reload, 1500);
  useAdminFeed((e) => {
    if (e.type === "admin.driver" || e.type === "reconnect") debouncedReload();
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.drivers.length ?? 0 };
    for (const d of data?.drivers ?? []) c[d.profile.verificationStatus] = (c[d.profile.verificationStatus] ?? 0) + 1;
    return c;
  }, [data]);
  const rows = useMemo(() => data?.drivers.filter((d) => tab === "all" || d.profile.verificationStatus === tab), [data, tab]);

  return (
    <Page>
      <PageHeader title="נהגים" description="אימות מסמכים, אישור נהגים חדשים ומעקב אחר זמינות ודירוג." />
      <Panel flush>
        <Toolbar>
          <FilterTabs
            label="סינון לפי סטטוס אימות"
            value={tab}
            onChange={(v) => setParams({ status: v === "under_review" ? null : v })}
            options={TABS.map((t) => ({ value: t, label: t === "all" ? "הכל" : VERIFICATION_STATUS_HE[t], count: data ? counts[t] ?? 0 : undefined, attention: t === "under_review" }))}
          />
          <SearchField value={q} onChange={setQ} label="חיפוש נהגים" placeholder="שם, אימייל או מספר רכב" className="lg:w-80" />
        </Toolbar>
        {error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <div className={refreshing ? "opacity-70 transition-opacity" : "transition-opacity"}>
            <DataTable
              rows={rows}
              loading={loading}
              columns={columns}
              rowKey={(r) => r.user.id}
              rowHref={(r) => `/admin/drivers/${r.user.id}`}
              caption="רשימת נהגים"
              empty={
                <EmptyState
                  icon={<Car size={24} />}
                  title={dq ? "לא נמצאו נהגים" : tab === "under_review" ? "אין נהגים שממתינים לבדיקה" : "אין נהגים בסטטוס הזה"}
                  description={dq ? "נסו שם, אימייל או מספר רכב אחר." : tab === "under_review" ? "כשנהג יגיש את כל המסמכים הנדרשים הוא יופיע כאן." : undefined}
                />
              }
            />
          </div>
        )}
      </Panel>
    </Page>
  );
}
