"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, EyeOff, Hand, Route, Send, UserRound } from "lucide-react";
import { api, type TicketDTO } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { TICKET_PRIORITY_HE, TICKET_STATUS_HE } from "@/lib/labels";
import { Button, Select, Toggle, useToast, cn } from "@/components/ui";
import { useSession } from "@/components/app/session";
import { readNotification, useAdminFeed } from "../realtime";
import { errorMessage, shortId, useDebouncedCallback, useLoad, useStaffDirectory } from "../hooks";
import { DetailSkeleton, ErrorState, InlineError, KV, Ltr, Muted, Page, PageHeader, Panel } from "../ui";
import { CategoryPill, PriorityPill, TicketStatusPill } from "../pills";
import { SPRING } from "../motion";

const STATUSES: TicketDTO["status"][] = ["open", "in_progress", "resolved", "closed"];
const PRIORITIES: TicketDTO["priority"][] = ["urgent", "high", "normal", "low"];

export function TicketDetail({ id }: { id: string }) {
  const toast = useToast();
  const me = useSession().user;
  const staff = useStaffDirectory();
  const { data, error, loading, reload, mutate } = useLoad(`ticket:${id}`, () => api.admin.ticket(id));
  const debounced = useDebouncedCallback(reload, 500);
  const [saving, setSaving] = useState<string | null>(null);
  useAdminFeed((e) => {
    const n = readNotification(e);
    if ((n && n.ticketId === id) || e.type === "reconnect") debounced();
  });

  if (loading)
    return (
      <Page>
        <DetailSkeleton />
      </Page>
    );
  if (!data)
    return (
      <Page>
        <PageHeader title="פנייה" back={{ href: "/admin/tickets", label: "לכל הפניות" }} />
        <div className="card">
          <ErrorState message={error ?? "הפנייה לא נמצאה"} onRetry={reload} />
        </div>
      </Page>
    );

  const t = data.ticket;
  const authorName = (authorId: string) => (authorId === t.openedBy ? t.openerName ?? "המשתמש" : authorId === me?.id ? "אתם" : staff.get(authorId)?.name ?? "צוות HOP");
  const assigneeName = t.assignedTo ? (t.assignedTo === me?.id ? "אליכם" : staff.get(t.assignedTo)?.name ?? "איש צוות") : null;

  async function patch(field: string, input: Parameters<typeof api.admin.updateTicket>[1], ok: string) {
    setSaving(field);
    try {
      const res = await api.admin.updateTicket(id, input);
      mutate(() => res);
      toast.success(ok);
    } catch (err) {
      toast.error("העדכון נכשל", errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Page>
      <PageHeader
        back={{ href: "/admin/tickets", label: "לכל הפניות" }}
        title={t.subject}
        meta={
          <>
            <TicketStatusPill status={t.status} />
            <PriorityPill priority={t.priority} />
            <CategoryPill category={t.category} />
            <span className="text-sm text-fg-muted">
              נפתחה {formatRelative(t.createdAt)} · <Ltr>#{shortId(t.id)}</Ltr>
            </span>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2 lg:self-start" title="שיחה" description="הודעות פנימיות גלויות לצוות בלבד" flush>
          <ol className="space-y-4 px-4 py-5 sm:px-5" aria-label="הודעות">
            <Bubble author={authorName(t.openedBy)} at={t.createdAt} fromUser body={t.body} index={0} />
            {t.messages.map((m, i) => (
              <Bubble key={m.id} author={authorName(m.authorId)} at={m.createdAt} fromUser={m.authorId === t.openedBy} internal={m.internal} body={m.body} index={i + 1} />
            ))}
          </ol>
          <Composer
            ticket={t}
            onSent={(res) => {
              mutate(() => res);
            }}
          />
        </Panel>
        <div className="space-y-5">
          <Panel title="טיפול" index={1}>
            <div className="space-y-4">
              <div>
                <label htmlFor="ticket-status" className="field-label">
                  סטטוס
                </label>
                <Select id="ticket-status" className="mt-1.5 h-11" value={t.status} disabled={saving === "status"} onChange={(e) => patch("status", { status: e.target.value as TicketDTO["status"] }, "הסטטוס עודכן")}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TICKET_STATUS_HE[s]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="ticket-priority" className="field-label">
                  דחיפות
                </label>
                <Select id="ticket-priority" className="mt-1.5 h-11" value={t.priority} disabled={saving === "priority"} onChange={(e) => patch("priority", { priority: e.target.value as TicketDTO["priority"] }, "הדחיפות עודכנה")}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {TICKET_PRIORITY_HE[p]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <div className="field-label">שיוך</div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-3.5 py-2.5">
                  <span className={cn("text-sm font-semibold", !assigneeName && "text-fg-muted")}>{assigneeName ? `משויך ${assigneeName === "אליכם" ? "אליכם" : `ל${assigneeName}`}` : "לא משויך"}</span>
                  {t.assignedTo === me?.id ? (
                    <Button size="sm" variant="ghost" className="h-9" loading={saving === "assign"} onClick={() => patch("assign", { assignedTo: null }, "השיוך הוסר")}>
                      הסרת שיוך
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" className="h-9" loading={saving === "assign"} disabled={!me} onClick={() => me && patch("assign", { assignedTo: me.id }, "הפנייה שויכה אליכם")}>
                      <Hand size={15} aria-hidden />
                      שייך אליי
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Panel>
          <Panel title="פרטים" index={2}>
            <KV
              cols={1}
              items={[
                {
                  label: "נפתחה על ידי",
                  value: (
                    <Link href={`/admin/users/${t.openedBy}`} className="inline-flex items-center gap-1.5 font-semibold hover:text-brand">
                      <UserRound size={15} aria-hidden />
                      {t.openerName ?? "משתמש"}
                      <ArrowLeft size={14} aria-hidden />
                    </Link>
                  ),
                },
                {
                  label: "נסיעה מקושרת",
                  value: t.rideId ? (
                    <Link href={`/admin/rides/${t.rideId}`} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
                      <Route size={15} aria-hidden />
                      נסיעה <Ltr>#{shortId(t.rideId)}</Ltr>
                      <ArrowLeft size={14} aria-hidden />
                    </Link>
                  ) : (
                    <Muted>אין</Muted>
                  ),
                },
                { label: "נפתחה", value: formatDateTime(t.createdAt) },
                { label: "עודכנה", value: formatDateTime(t.updatedAt) },
                { label: "נפתרה", value: t.resolvedAt ? formatDateTime(t.resolvedAt) : <Muted>עדיין לא</Muted> },
              ]}
            />
          </Panel>
        </div>
      </div>
    </Page>
  );
}

function Bubble({ author, at, body, fromUser, internal, index }: { author: string; at: string; body: string; fromUser?: boolean; internal?: boolean; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: Math.min(index, 10) * 0.04 }}
      className={cn("flex", fromUser ? "justify-start" : "justify-end")}
    >
      <div
        className={cn(
          "max-w-[min(560px,88%)] rounded-[22px] px-4 py-3",
          fromUser && "rounded-ss-md bg-[color-mix(in_oklab,var(--fg)_5%,transparent)]",
          !fromUser && !internal && "rounded-se-md bg-brand-50",
          internal && "rounded-se-md border border-dashed border-[color-mix(in_oklab,var(--warning)_70%,transparent)] bg-surface",
        )}
      >
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="font-bold">{author}</span>
          {internal && (
            <span className="inline-flex items-center gap-1 font-bold text-[color-mix(in_oklab,var(--warning)_55%,var(--fg))]">
              <EyeOff size={12} aria-hidden />
              הערה פנימית
            </span>
          )}
          <span className="text-fg-muted" title={formatDateTime(at)}>
            {formatRelative(at)}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{body}</p>
      </div>
    </motion.li>
  );
}

function Composer({ ticket, onSent }: { ticket: TicketDTO; onSent: (t: { ticket: TicketDTO }) => void }) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.support.message(ticket.id, body.trim(), internal);
      onSent(res);
      setBody("");
      toast.success(internal ? "ההערה הפנימית נשמרה" : "התשובה נשלחה");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className={cn("border-t px-4 py-4 transition-colors sm:px-5", internal ? "border-[color-mix(in_oklab,var(--warning)_55%,transparent)] bg-[color-mix(in_oklab,var(--fg)_2.5%,var(--surface))]" : "border-line")}
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor="reply" className="sr-only">
        {internal ? "הערה פנימית" : "תשובה למשתמש"}
      </label>
      <textarea
        id="reply"
        className="input min-h-[96px] bg-surface"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        maxLength={3000}
        placeholder={internal ? "הערה לצוות בלבד — המשתמש לא יראה אותה" : `כתבו תשובה ל${ticket.openerName ?? "משתמש"}…`}
      />
      {error && (
        <div className="mt-2">
          <InlineError message={error} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
          <Toggle checked={internal} onChange={setInternal} label="הערה פנימית" />
          הערה פנימית
        </label>
        <Button type="submit" size="sm" className="h-11" variant={internal ? "ink" : "primary"} loading={busy} disabled={!body.trim()}>
          <Send size={16} aria-hidden />
          {internal ? "שמירת הערה" : "שליחת תשובה"}
        </Button>
      </div>
    </form>
  );
}
