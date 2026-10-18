"use client";
import { useState } from "react";
import { Users as UsersIcon } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import type { PublicUserDTO, UserRole } from "@/lib/types";
import { EmptyState, Pill } from "@/components/ui";
import { useDebouncedValue, useLoad, useQueryParams } from "../hooks";
import { type Column, DataTable, ErrorState, FilterTabs, Ltr, Muted, Page, PageHeader, Panel, PersonCell, SearchField, Toolbar } from "../ui";
import { RolePill, UserStatusPill } from "../pills";

type RoleTab = UserRole | "all";
type StatusTab = "all" | "active" | "suspended";
const ROLE_TABS: { value: RoleTab; label: string }[] = [
  { value: "all", label: "כל המשתמשים" },
  { value: "rider", label: "נוסעים" },
  { value: "driver", label: "נהגים" },
  { value: "support", label: "תמיכה" },
  { value: "admin", label: "מנהלים" },
];

const columns: Column<PublicUserDTO>[] = [
  { key: "user", header: "משתמש", card: "title", cell: (u) => <PersonCell name={u.name} sub={<Ltr>{u.email}</Ltr>} /> },
  { key: "phone", header: "טלפון", cell: (u) => (u.phone ? <Ltr>{u.phone}</Ltr> : <Muted>—</Muted>) },
  { key: "role", header: "תפקיד", cell: (u) => <RolePill role={u.role} /> },
  {
    key: "status",
    header: "סטטוס",
    card: "badge",
    cell: (u) => (
      <span className="inline-flex items-center gap-1.5">
        <UserStatusPill status={u.status} />
        {u.isDemo && <Pill tone="warning">הדגמה</Pill>}
      </span>
    ),
  },
  { key: "created", header: "נרשם", cell: (u) => <span className="whitespace-nowrap text-fg-muted" title={formatDate(u.createdAt)}>{formatRelative(u.createdAt)}</span> },
];

export function UsersList() {
  const [params, setParams] = useQueryParams();
  const roleRaw = params.get("role") as RoleTab | null;
  const role: RoleTab = ROLE_TABS.some((r) => r.value === roleRaw) ? (roleRaw as RoleTab) : "all";
  const statusRaw = params.get("status");
  const status: StatusTab = statusRaw === "active" || statusRaw === "suspended" ? statusRaw : "all";
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q.trim(), 300);
  const { data, error, loading, refreshing, reload } = useLoad(`users:${role}:${status}:${dq}`, () =>
    api.admin.users({ role: role === "all" ? undefined : role, status: status === "all" ? undefined : status, q: dq || undefined, limit: 300 }),
  );

  return (
    <Page>
      <PageHeader title="משתמשים" description="נוסעים, נהגים וצוות. השעיה מנתקת את המשתמש מכל המכשירים." />
      <Panel flush>
        <Toolbar>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <FilterTabs label="סינון לפי תפקיד" value={role} onChange={(v) => setParams({ role: v === "all" ? null : v })} options={ROLE_TABS} />
            <div className="flex items-center gap-2">
              <label htmlFor="user-status" className="text-sm font-semibold text-fg-muted">
                סטטוס
              </label>
              <select id="user-status" className="input h-10 w-auto bg-surface py-0 pe-9 text-sm" value={status} onChange={(e) => setParams({ status: e.target.value === "all" ? null : e.target.value })}>
                <option value="all">הכל</option>
                <option value="active">פעילים</option>
                <option value="suspended">מושעים</option>
              </select>
            </div>
          </div>
          <SearchField value={q} onChange={setQ} label="חיפוש משתמשים" placeholder="שם, אימייל או טלפון" className="lg:w-72" />
        </Toolbar>
        {error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <div className={refreshing ? "opacity-70 transition-opacity" : "transition-opacity"}>
            <DataTable
              rows={data?.users}
              loading={loading}
              columns={columns}
              rowKey={(u) => u.id}
              rowHref={(u) => `/admin/users/${u.id}`}
              caption="רשימת משתמשים"
              empty={<EmptyState icon={<UsersIcon size={24} />} title="לא נמצאו משתמשים" description="נסו לשנות את הסינון או את החיפוש." />}
            />
            {data && data.users.length > 0 && <div className="border-t border-line px-5 py-3 text-xs text-fg-muted tabular-nums">מוצגים {data.users.length} משתמשים</div>}
          </div>
        )}
      </Panel>
    </Page>
  );
}
