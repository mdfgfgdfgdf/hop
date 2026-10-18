"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, LifeBuoy, MessageSquarePlus, Phone, Smile } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { api, type TicketDTO } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { TICKET_CATEGORY_HE } from "@/lib/labels";
import { Button, EmptyState, Skeleton, useToast } from "@/components/ui";
import { useRiderEvents } from "../ActiveRideProvider";
import { InlineError } from "../InlineError";
import { RiderPage, Section } from "../RiderPage";
import { describeError, type FriendlyError } from "../lib/errors";
import { StaggerItem, StaggerList } from "../motion";
import { TicketStatusPill } from "./TicketStatusPill";
import { TicketForm } from "./TicketForm";

const CATEGORY_PARAM = new Set(Object.keys(TICKET_CATEGORY_HE));

export function SupportView() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const rideId = params.get("rideId");
  const catParam = params.get("category");
  const initialCategory = catParam && CATEGORY_PARAM.has(catParam) ? (catParam as TicketDTO["category"]) : undefined;
  const [formOpen, setFormOpen] = useState(params.get("new") === "1" || !!rideId);
  const [tickets, setTickets] = useState<TicketDTO[] | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);

  const load = useCallback(
    () =>
      api.support.list().then(
        (res) => {
          setTickets(res.tickets);
          setError(null);
        },
        (err) => setError(describeError(err)),
      ),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useRiderEvents((e) => {
    if (e.type === "notification") void load();
  });

  const open = (tickets ?? []).filter((t) => t.status === "open" || t.status === "in_progress");
  const closed = (tickets ?? []).filter((t) => t.status === "resolved" || t.status === "closed");

  return (
    <RiderPage title="תמיכה" subtitle="אנחנו כאן — בדרך כלל עונים תוך שעה">
      <div data-testid="support">
        <div className="mb-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            className="card flex min-h-16 items-center gap-3 p-4 text-start transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(17,19,24,.45)]"
            data-testid="new-ticket"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white">
              <MessageSquarePlus size={19} aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-bold">פנייה חדשה</span>
              <span className="block text-xs text-fg-muted">תלונה, אבידה, תשלום או כל דבר אחר</span>
            </span>
          </button>
          <a href="tel:100" className="card flex min-h-16 items-center gap-3 p-4 transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(17,19,24,.45)]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger/12 text-danger">
              <Phone size={19} aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-bold">מצב חירום?</span>
              <span className="block text-xs text-fg-muted">משטרה 100 · מד״א 101</span>
            </span>
          </a>
        </div>

        <AnimatePresence initial={false}>
          {formOpen && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mb-6">
              <TicketForm
                rideId={rideId}
                initialCategory={initialCategory}
                onCancel={() => setFormOpen(false)}
                onCreated={(t) => {
                  toast.success("הפנייה נשלחה", "נעדכן אתכם כאן ברגע שתהיה תשובה.");
                  router.push(`/ride/support/${t.id}`);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {error && !tickets && <InlineError error={error} action={<Button size="sm" variant="glass" onClick={load}>ניסיון חוזר</Button>} />}
        {!tickets && !error && (
          <div className="space-y-2" aria-busy="true" aria-label="טוען פניות">
            {[0, 1].map((i) => (
              <div key={i} className="card space-y-2 p-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        )}
        {tickets && tickets.length === 0 && (
          <div className="card">
            <EmptyState icon={<Smile size={26} aria-hidden />} title="אין פניות פתוחות — וזה סימן טוב" description="אם משהו לא הסתדר בנסיעה, ספרו לנו ונטפל בזה." />
          </div>
        )}
        {open.length > 0 && (
          <Section title="פניות פתוחות">
            <TicketList tickets={open} />
          </Section>
        )}
        {closed.length > 0 && (
          <Section title="פניות שטופלו">
            <TicketList tickets={closed} />
          </Section>
        )}
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-fg-muted">
          <LifeBuoy size={14} aria-hidden /> צוות HOP זמין 24/7 לפניות בטיחות.
        </p>
      </div>
    </RiderPage>
  );
}

function TicketList({ tickets }: { tickets: TicketDTO[] }) {
  return (
    <StaggerList className="space-y-2">
      {tickets.map((t) => (
        <StaggerItem key={t.id}>
          <Link href={`/ride/support/${t.id}`} className="card flex min-h-16 items-center gap-3 p-4 transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(17,19,24,.45)]" data-testid="ticket-item">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold">{t.subject}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
                <span>{TICKET_CATEGORY_HE[t.category]}</span>
                <span aria-hidden>·</span>
                <span>עודכן {formatRelative(t.updatedAt)}</span>
                {t.messages.length > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{t.messages.length} הודעות</span>
                  </>
                )}
              </div>
            </div>
            <TicketStatusPill status={t.status} />
            <ChevronLeft size={16} className="shrink-0 text-fg-muted" aria-hidden />
          </Link>
        </StaggerItem>
      ))}
    </StaggerList>
  );
}
