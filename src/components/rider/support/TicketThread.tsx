"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CarTaxiFront, Send } from "lucide-react";
import { motion } from "motion/react";
import { AnimatedMark } from "@/components/brand/AnimatedLogo";
import { api, type TicketDTO } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { TICKET_CATEGORY_HE } from "@/lib/labels";
import { Avatar, Button, EmptyState, Skeleton, Textarea } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useRiderEvents } from "../ActiveRideProvider";
import { InlineError } from "../InlineError";
import { useRiderInfo } from "../RiderContext";
import { RiderPage } from "../RiderPage";
import { describeError, type FriendlyError } from "../lib/errors";
import { TicketStatusPill } from "./TicketStatusPill";

type Bubble = { id: string; mine: boolean; body: string; at: string };

export function TicketThread({ id }: { id: string }) {
  const { name } = useRiderInfo();
  const [ticket, setTicket] = useState<TicketDTO | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<FriendlyError | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    () =>
      api.support.get(id).then(
        (res) => {
          setTicket(res.ticket);
          setError(null);
        },
        (err) => setError(describeError(err)),
      ),
    [id],
  );

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  useRiderEvents((e) => {
    const d = e.data as { ticketId?: string } | null;
    if (e.type === "notification" && d?.ticketId === id) void load();
  });

  const count = ticket?.messages.length ?? 0;
  useEffect(() => {
    if (count) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await api.support.message(id, reply.trim());
      setTicket(res.ticket);
      setReply("");
    } catch (err) {
      setSendError(describeError(err));
    } finally {
      setSending(false);
    }
  }

  const bubbles: Bubble[] = ticket
    ? [{ id: "opening", mine: true, body: ticket.body, at: ticket.createdAt }, ...ticket.messages.map((m) => ({ id: m.id, mine: m.authorId === ticket.openedBy, body: m.body, at: m.createdAt }))]
    : [];
  const resolved = ticket?.status === "resolved" || ticket?.status === "closed";

  return (
    <RiderPage title={ticket?.subject ?? "פנייה"} subtitle={ticket ? `${TICKET_CATEGORY_HE[ticket.category]} · נפתחה ${formatRelative(ticket.createdAt)}` : undefined} back="/ride/support" backLabel="חזרה לתמיכה">
      {error && !ticket && (
        error.code === "not_found" || error.code === "forbidden" ? (
          <div className="card">
            <EmptyState title="לא מצאנו את הפנייה" description="ייתכן שהקישור שגוי." action={<Link href="/ride/support" className="btn btn-glass">לכל הפניות</Link>} />
          </div>
        ) : (
          <InlineError error={error} action={<Button size="sm" variant="glass" onClick={load}>ניסיון חוזר</Button>} />
        )
      )}
      {!ticket && !error && (
        <div className="space-y-3" aria-busy="true" aria-label="טוען פנייה">
          <Skeleton className="h-16 w-3/4 rounded-3xl" />
          <Skeleton className="ms-auto h-12 w-2/3 rounded-3xl" />
        </div>
      )}
      {ticket && (
        <div data-testid="ticket-thread">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <TicketStatusPill status={ticket.status} />
            {ticket.priority === "urgent" && <span className="pill pill-danger">דחוף</span>}
            {ticket.rideId && (
              <Link href={`/ride/history/${ticket.rideId}`} className="pill pill-ink hover:opacity-80">
                <CarTaxiFront size={14} aria-hidden /> לנסיעה המקושרת
              </Link>
            )}
          </div>
          <ol className="space-y-3" aria-label="שיחה">
            {bubbles.map((b, i) => (
              <motion.li
                key={b.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.04 }}
                className={cn("flex items-end gap-2", b.mine ? "flex-row" : "flex-row-reverse")}
              >
                {b.mine ? <Avatar name={name || "אני"} size={30} /> : <AnimatedMark size={30} hopOn="hover" title="צוות HOP" />}
                <div className={cn("max-w-[80%] rounded-[22px] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap", b.mine ? "chip-brand rounded-ee-md" : "rounded-es-md border border-line bg-surface shadow-[0_1px_2px_rgba(17,19,24,.04)]")}>
                  {!b.mine && <div className="mb-0.5 text-xs font-bold text-brand">צוות HOP</div>}
                  {b.body}
                  <div className={cn("mt-1 text-[10px] tabular-nums", b.mine ? "text-white/75" : "text-fg-muted")}>{formatDateTime(b.at)}</div>
                </div>
              </motion.li>
            ))}
          </ol>
          {ticket.messages.length === 0 && <p className="mt-4 text-center text-xs text-fg-muted">קיבלנו את הפנייה. נציג יחזור אליכם כאן בהקדם.</p>}
          <div ref={endRef} />
          <form onSubmit={send} className="sticky bottom-3 mt-6 rounded-[26px] glass glass-strong p-2" noValidate>
            {resolved && <p className="px-2 pt-1 pb-2 text-xs text-fg-muted">הפנייה סומנה כטופלה. כתבו כאן כדי לפתוח אותה מחדש.</p>}
            <div className="flex items-end gap-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="כתבו הודעה…"
                aria-label="תגובה"
                rows={1}
                maxLength={3000}
                className="min-h-12! flex-1 resize-none py-3"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(e);
                }}
              />
              <Button type="submit" size="icon" loading={sending} disabled={!reply.trim()} aria-label="שליחה" className="h-12 w-12 shrink-0">
                {!sending && <Send size={18} aria-hidden />}
              </Button>
            </div>
            {sendError && <InlineError error={sendError} className="mt-2" />}
          </form>
        </div>
      )}
    </RiderPage>
  );
}
