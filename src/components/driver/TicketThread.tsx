"use client";
/** A support ticket conversation with reply box. */
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Send } from "lucide-react";
import { api, type TicketDTO } from "@/lib/api";
import { formatDateTime, formatTime } from "@/lib/format";
import { TICKET_CATEGORY_HE, TICKET_STATUS_HE } from "@/lib/labels";
import { Button, Pill, Textarea, cn } from "@/components/ui";
import { LogoMark } from "@/components/brand/Logo";
import { useSession } from "@/components/app/session";
import { useDriverRuntime } from "./DriverRuntime";
import { DriverPage } from "./DriverPage";
import { NeedleLoader } from "./motion";
import { Notice } from "./Notice";
import { errorMessage } from "./errors";

export function TicketThread({ id }: { id: string }) {
  const { user } = useSession();
  const { ticketsVersion } = useDriverRuntime();
  const [ticket, setTicket] = useState<TicketDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    api.support
      .get(id)
      .then(({ ticket: t }) => active && setTicket(t))
      .catch((err: unknown) => active && setError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, [id, ticketsVersion]);

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
      const { ticket: t } = await api.support.message(id, reply.trim());
      setTicket(t);
      setReply("");
    } catch (err) {
      setSendError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const closed = ticket?.status === "closed";
  const thread = ticket ? [{ id: "opening", authorId: ticket.openedBy, body: ticket.body, createdAt: ticket.createdAt, internal: false }, ...ticket.messages] : [];

  return (
    <DriverPage title={ticket?.subject ?? "פנייה"} subtitle={ticket ? `${TICKET_CATEGORY_HE[ticket.category]} · נפתחה ${formatDateTime(ticket.createdAt)}` : undefined} back="/drive/support" backLabel="חזרה לתמיכה">
      {error ? (
        <Notice tone="danger" live title="לא ניתן להציג את הפנייה">
          {error}
        </Notice>
      ) : !ticket ? (
        <div className="grid place-items-center py-16">
          <NeedleLoader size={44} label="טוענים את הפנייה" />
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={ticket.status === "resolved" ? "success" : ticket.status === "in_progress" ? "warning" : ticket.status === "closed" ? "muted" : "brand"} className={ticket.status === "open" ? "bg-brand/20! text-[#b8caff]!" : undefined}>{TICKET_STATUS_HE[ticket.status]}</Pill>
            {(ticket.priority === "urgent" || ticket.priority === "high") && <Pill tone="danger">דחוף</Pill>}
            <span className="text-xs text-fg-muted">{ticket.status === "open" ? "קיבלנו את הפנייה — נחזור אליך כאן" : ticket.status === "in_progress" ? "הפנייה בטיפול צוות HOP" : ""}</span>
          </div>
          <ol className="grid gap-3" aria-label="הודעות">
            {thread.map((m, i) => {
              const mine = m.authorId === user?.id;
              return (
                <motion.li
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 6) * 0.04, type: "spring", stiffness: 380, damping: 32 }}
                  className={cn("flex items-end gap-2", mine ? "flex-row-reverse" : "")}
                >
                  {!mine && <LogoMark size={30} />}
                  <div className={cn("max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-relaxed", mine ? "rounded-ee-md bg-brand text-white" : "rounded-es-md border border-line bg-surface")}>
                    {!mine && <div className="mb-0.5 text-[11px] font-extrabold text-[#8fb0ff]">צוות HOP</div>}
                    <div className="whitespace-pre-wrap">{m.body}</div>
                    <div className={cn("mt-1 text-[10px] tabular-nums", mine ? "text-white/70" : "text-fg-muted")}>{formatTime(m.createdAt)}</div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
          <div ref={endRef} />
          {closed ? (
            <Notice tone="info">הפנייה נסגרה. לבעיה חדשה פתחו פנייה חדשה ממסך התמיכה.</Notice>
          ) : (
            <form onSubmit={send} className="sticky bottom-3 z-10 glass glass-md flex items-end gap-2 p-2">
              <Textarea value={reply} onChange={(e) => setReply(e.target.value.slice(0, 3000))} placeholder="כתבו תגובה…" aria-label="תגובה" className="min-h-12 flex-1 resize-none border-0 bg-transparent py-3 shadow-none" rows={1} data-testid="reply-input" />
              <Button type="submit" size="icon" loading={sending} disabled={!reply.trim()} aria-label="שליחה" className="h-12 w-12 shrink-0">
                {!sending && <Send size={18} className="-scale-x-100" aria-hidden />}
              </Button>
            </form>
          )}
          {sendError && (
            <Notice tone="danger" live>
              {sendError}
            </Notice>
          )}
        </div>
      )}
    </DriverPage>
  );
}
