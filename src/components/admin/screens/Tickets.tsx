"use client";
import { useMemo } from "react";
import { LifeBuoy, Link2 } from "lucide-react";
import { api, type TicketDTO } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { useAdminFeed } from "../realtime";
import { useDebouncedCallback, useLoad, useQueryParams, useStaffDirectory } from "../hooks";
import { type Column, DataTable, ErrorState, FilterTabs, Muted, Page, PageHeader, Panel, Toolbar } from "../ui";
import { CategoryPill, PriorityPill, TicketStatusPill } from "../pills";
import { useSession } from "@/components/app/session";

type Tab = "active" | TicketDTO["status"] | "all";
const TABS: { value: Tab; label: string }[] = [
  { value: "active", label: "דורשות טיפול" },
  { value: "open", label: "פתוחות" },
  { value: "in_progress", label: "בטיפול" },
  { value: "resolved", label: "נפתרו" },
  { value: "closed", label: "סגורות" },
  { value: "all", label: "הכל" },
];
const PRIORITY_RANK: Record<TicketDTO["priority"], number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const matches = (t: TicketDTO, tab: Tab) => (tab === "all" ? true : tab === "active" ? t.status === "open" || t.status === "in_progress" : t.status === tab);

export function TicketsList() {
  const [params, setParams] = useQueryParams();
  const raw = params.get("status") as Tab | null;
  const tab: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : "active";
  const { data, error, loading, refreshing, reload } = useLoad("tickets", () => api.admin.tickets({ limit: 500 }));
  const staff = useStaffDirectory();
  const me = useSession().user;
  const debounced = useDebouncedCallback(reload, 1000);
  useAdminFeed((e) => {
    if (e.type === "notification" || e.type === "reconnect") debounced();
  });

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.value, (data?.tickets ?? []).filter((x) => matches(x, t.value)).length])), [data]);
  const rows = useMemo(
    () =>
      data?.tickets
        .filter((t) => matches(t, tab))
        .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.updatedAt.localeCompare(a.updatedAt)),
    [data, tab],
  );

  const columns: Column<TicketDTO>[] = [
    {
      key: "subject",
      header: "פנייה",
      card: "title",
      cell: (t) => (
        <div className="min-w-0 max-w-[420px]">
          <div className="truncate font-semibold">{t.subject}</div>
          <div className="truncate text-xs text-fg-muted">
            {t.openerName ?? "משתמש"} · {t.messages.length ? `${t.messages.length} הודעות` : "ללא מענה עדיין"}
          </div>
        </div>
      ),
    },
    { key: "priority", header: "דחיפות", card: "badge", cell: (t) => <PriorityPill priority={t.priority} /> },
    { key: "category", header: "קטגוריה", cell: (t) => <CategoryPill category={t.category} /> },
    { key: "status", header: "סטטוס", cell: (t) => <TicketStatusPill status={t.status} /> },
    {
      key: "assignee",
      header: "משויך ל",
      hideBelow: "lg",
      cell: (t) => (t.assignedTo ? <span className="whitespace-nowrap">{t.assignedTo === me?.id ? "אליי" : staff.get(t.assignedTo)?.name ?? "איש צוות"}</span> : <Muted>לא משויך</Muted>),
    },
    {
      key: "ride",
      header: "נסיעה",
      hideBelow: "xl",
      cell: (t) =>
        t.rideId ? (
          <span className="inline-flex items-center gap-1 text-fg-muted">
            <Link2 size={14} aria-hidden />
            מקושרת
          </span>
        ) : (
          <Muted>—</Muted>
        ),
    },
    { key: "updated", header: "עדכון אחרון", cell: (t) => <span className="whitespace-nowrap text-fg-muted" title={formatDateTime(t.updatedAt)}>{formatRelative(t.updatedAt)}</span> },
  ];

  const urgent = (data?.tickets ?? []).filter((t) => t.priority === "urgent" && (t.status === "open" || t.status === "in_progress")).length;

  return (
    <Page>
      <PageHeader
        title="פניות"
        busy={refreshing}
        description={urgent ? `${urgent === 1 ? "פנייה דחופה אחת ממתינה" : `${urgent} פניות דחופות ממתינות`} — דחופות מוצגות ראשונות.` : "פניות של נוסעים ונהגים. דחופות מוצגות ראשונות."}
      />
      <Panel flush>
        <Toolbar>
          <FilterTabs label="סינון לפי סטטוס" value={tab} onChange={(v) => setParams({ status: v === "active" ? null : v })} options={TABS.map((t) => ({ ...t, count: data ? counts[t.value] : undefined, attention: t.value === "active" }))} />
        </Toolbar>
        {error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <DataTable
            rows={rows}
            loading={loading}
            columns={columns}
            rowKey={(t) => t.id}
            rowHref={(t) => `/admin/tickets/${t.id}`}
            caption="רשימת פניות"
            empty={
              <EmptyState
                icon={<LifeBuoy size={24} />}
                title={tab === "active" ? "הכל שקט — אין פניות פתוחות" : "אין פניות בסטטוס הזה"}
                description={tab === "active" ? "פניות חדשות מנוסעים ונהגים יופיעו כאן מיד." : undefined}
              />
            }
          />
        )}
      </Panel>
    </Page>
  );
}
