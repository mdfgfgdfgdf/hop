"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ScrollText } from "lucide-react";
import { api, type AuditLogDTO } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { EmptyState, Select, cn } from "@/components/ui";
import { useSession } from "@/components/app/session";
import { shortId, useLoad, useQueryParams, useStaffDirectory } from "../hooks";
import { ErrorState, Ltr, Muted, Page, PageHeader, Panel, TableSkeleton } from "../ui";
import { RolePill } from "../pills";
import { SPRING } from "../motion";
import type { UserRole } from "@/lib/types";

const PREFIXES: { value: string; label: string }[] = [
  { value: "", label: "כל הפעולות" },
  { value: "auth.", label: "התחברויות והרשמות" },
  { value: "driver.", label: "נהגים" },
  { value: "document.", label: "מסמכי נהגים" },
  { value: "user.", label: "משתמשים" },
  { value: "ride.", label: "נסיעות" },
  { value: "pricing.", label: "תמחור" },
  { value: "service_type.", label: "סוגי שירות" },
  { value: "settings.", label: "הגדרות" },
  { value: "ticket.", label: "פניות" },
];

export const ACTION_HE: Record<string, string> = {
  "auth.login": "התחברות",
  "auth.login_failed": "ניסיון התחברות כושל",
  "auth.signup": "הרשמה",
  "driver.approve": "אישור נהג",
  "driver.reject": "דחיית נהג",
  "driver.suspend": "השעיית נהג",
  "driver.reinstate": "החזרת נהג לבדיקה",
  "driver.document_uploaded": "העלאת מסמך",
  "driver.vehicle_changed_requires_review": "שינוי רכב — נדרשת בדיקה",
  "document.approved": "אישור מסמך",
  "document.rejected": "דחיית מסמך",
  "user.suspended": "השעיית משתמש",
  "user.active": "הפעלת משתמש",
  "user.role_changed": "שינוי תפקיד",
  "user.update_profile": "עדכון פרופיל",
  "ride.cancel": "ביטול נסיעה",
  "ride.adjust": "התאמה / החזר",
  "pricing.update": "עדכון תעריף",
  "service_type.update": "עדכון סוג שירות",
  "settings.update": "עדכון הגדרות",
  "ticket.create": "פתיחת פנייה",
  "ticket.update": "עדכון פנייה",
};

const TARGET_HE: Record<string, string> = { user: "משתמש", driver: "נהג", driver_document: "מסמך", ride: "נסיעה", ticket: "פנייה", pricing_config: "תעריף", service_type: "סוג שירות" };

function targetHref(l: AuditLogDTO): string | null {
  if (!l.targetId) return null;
  switch (l.targetType) {
    case "user":
      return `/admin/users/${l.targetId}`;
    case "driver":
      return `/admin/drivers/${l.targetId}`;
    case "ride":
      return `/admin/rides/${l.targetId}`;
    case "ticket":
      return `/admin/tickets/${l.targetId}`;
    case "driver_document":
      return typeof l.data.driverId === "string" ? `/admin/drivers/${l.data.driverId}` : null;
    case "pricing_config":
      return "/admin/pricing";
    case "service_type":
      return "/admin/pricing";
    default:
      return null;
  }
}

const tone = (action: string) => (/(suspend|reject|cancel|failed)/.test(action) ? "text-danger" : /(approve|active|reinstate)/.test(action) ? "text-success" : "text-fg");

export function Audit() {
  const [params, setParams] = useQueryParams();
  const action = params.get("action") ?? "";
  const actorId = params.get("actor") ?? "";
  const staff = useStaffDirectory();
  const me = useSession().user;
  const { data, error, loading, refreshing, reload } = useLoad(`audit:${action}:${actorId}`, () => api.admin.audit({ action: action || undefined, actorId: actorId || undefined, limit: 300 }));
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const staffList = [...staff.values()].sort((a, b) => a.name.localeCompare(b.name, "he"));

  return (
    <Page>
      <PageHeader title="יומן ביקורת" busy={refreshing} description="כל פעולה רגישה נרשמת כאן — מי, מה, מתי ועל מה. היומן לקריאה בלבד." />
      <Panel flush>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-end sm:px-5">
          <div className="sm:w-64">
            <label htmlFor="audit-action" className="field-label">
              סוג פעולה
            </label>
            <Select id="audit-action" className="mt-1.5 h-11 bg-surface text-sm" value={action} onChange={(e) => setParams({ action: e.target.value || null })}>
              {PREFIXES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:w-64">
            <label htmlFor="audit-actor" className="field-label">
              מבצע
            </label>
            <Select id="audit-actor" className="mt-1.5 h-11 bg-surface text-sm" value={actorId} onChange={(e) => setParams({ actor: e.target.value || null })}>
              <option value="">כל המבצעים</option>
              {me && <option value={me.id}>אני ({me.name})</option>}
              {staffList
                .filter((s) => s.id !== me?.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </div>
          {data && <div className="text-xs text-fg-muted tabular-nums sm:ms-auto sm:pb-3">{data.logs.length} רשומות אחרונות</div>}
        </div>
        {error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading || !data ? (
          <TableSkeleton rows={8} />
        ) : data.logs.length === 0 ? (
          <EmptyState icon={<ScrollText size={24} />} title="אין רשומות תואמות" description="נסו סוג פעולה או מבצע אחר." />
        ) : (
          <>
            <div className="hidden grid-cols-[150px_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)_110px_40px] gap-4 border-b border-line bg-[color-mix(in_oklab,var(--fg)_2.5%,transparent)] px-5 py-2.5 text-xs font-semibold text-fg-muted md:grid">
              <span>זמן</span>
              <span>מבצע</span>
              <span>פעולה</span>
              <span>יעד</span>
              <span>IP</span>
              <span className="sr-only">פרטים</span>
            </div>
            <ul className="divide-y divide-line">
              {data.logs.map((l, i) => {
                const isOpen = open.has(l.id);
                const href = targetHref(l);
                return (
                  <motion.li key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: Math.min(i, 14) * 0.02 }}>
                    <button
                      type="button"
                      onClick={() => toggle(l.id)}
                      aria-expanded={isOpen}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 px-4 py-3 text-start text-sm transition-colors hover:bg-brand-50 md:grid-cols-[150px_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)_110px_40px] md:items-center md:px-5"
                    >
                      <span className="order-3 col-span-2 text-xs text-fg-muted md:order-none md:col-span-1 md:text-sm" title={formatDateTime(l.createdAt)}>
                        <span className="md:block">{formatRelative(l.createdAt)}</span>
                        <span className="tabular-nums md:block md:text-xs"> · {formatDateTime(l.createdAt)}</span>
                      </span>
                      <span className="order-2 col-span-2 flex min-w-0 items-center gap-2 md:order-none md:col-span-1">
                        <span className="truncate font-semibold">{l.actorName ?? (l.actorId ? "משתמש" : "מערכת")}</span>
                        {l.actorRole && <RolePill role={l.actorRole as UserRole} />}
                      </span>
                      <span className="order-1 min-w-0 md:order-none">
                        <span className={cn("block truncate font-bold", tone(l.action))}>{ACTION_HE[l.action] ?? l.action}</span>
                        <Ltr className="block truncate font-mono text-[11px] text-fg-muted">{l.action}</Ltr>
                      </span>
                      <span className="order-4 col-span-2 min-w-0 text-xs md:order-none md:col-span-1 md:text-sm">
                        {l.targetType ? (
                          <>
                            {TARGET_HE[l.targetType] ?? l.targetType}
                            {l.targetId && (
                              <>
                                {" "}
                                {href ? (
                                  <Link href={href} onClick={(e) => e.stopPropagation()} className="font-semibold text-brand hover:underline">
                                    <Ltr>#{shortId(l.targetId)}</Ltr>
                                  </Link>
                                ) : (
                                  <Ltr className="text-fg-muted">#{shortId(l.targetId)}</Ltr>
                                )}
                              </>
                            )}
                          </>
                        ) : (
                          <Muted>—</Muted>
                        )}
                      </span>
                      <span className="order-5 hidden text-xs text-fg-muted md:order-none md:block">{l.ip ? <Ltr>{l.ip}</Ltr> : "—"}</span>
                      <span className="order-1 grid h-8 w-8 place-items-center self-start rounded-full text-fg-muted md:order-none md:self-center">
                        <ChevronDown size={17} className={cn("transition-transform", isOpen && "rotate-180")} aria-hidden />
                        <span className="sr-only">{isOpen ? "הסתרת פרטים" : "הצגת פרטים"}</span>
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} className="overflow-hidden">
                          <div className="px-4 pb-4 md:px-5">
                            <pre dir="ltr" className="max-h-72 overflow-auto rounded-2xl bg-ink p-4 text-start font-mono text-xs leading-relaxed text-[#e8eaf0]">
                              {JSON.stringify({ action: l.action, actor: { id: l.actorId, role: l.actorRole }, target: { type: l.targetType, id: l.targetId }, ip: l.ip, data: l.data }, null, 2)}
                            </pre>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>
    </Page>
  );
}
