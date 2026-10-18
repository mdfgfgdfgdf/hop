"use client";
/** Support & safety: emergency numbers, quick-category new ticket, my tickets. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, MessageCircle, MessagesSquare, Phone, ShieldAlert, Siren, Wallet, X } from "lucide-react";
import { api, type TicketDTO } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { TICKET_CATEGORY_HE, TICKET_STATUS_HE } from "@/lib/labels";
import type { RideDTO } from "@/lib/types";
import { Button, Field, Input, Select, Textarea, cn, useToast } from "@/components/ui";
import { TonePill } from "./TonePill";
import { useDriverRuntime } from "./DriverRuntime";
import { DriverPage } from "./DriverPage";
import { NeedleLoader, StaggerItem, StaggerList } from "./motion";
import { Notice } from "./Notice";
import { errorMessage } from "./errors";
import { CHIP, FILL } from "./tone";

type Category = "safety" | "incident" | "payment" | "other";

const QUICK: { id: Category; title: string; text: string; icon: typeof ShieldAlert; subject: string; tone: string }[] = [
  { id: "safety", title: "דיווח על אירוע בטיחותי", text: "התנהגות מאיימת, חשש לבטיחות", icon: ShieldAlert, subject: "דיווח על אירוע בטיחותי", tone: CHIP.danger },
  { id: "incident", title: "תאונה / אירוע בנסיעה", text: "תאונה, נזק לרכב, אירוע חריג", icon: Siren, subject: "תאונה / אירוע בנסיעה", tone: CHIP.warning },
  { id: "payment", title: "תשלום", text: "סכום, מזומן, עמלה", icon: Wallet, subject: "שאלה על תשלום", tone: CHIP.brand },
  { id: "other", title: "אחר", text: "כל דבר אחר", icon: MessageCircle, subject: "", tone: CHIP.neutral },
];

const STATUS_TONE: Record<TicketDTO["status"], "brand" | "warning" | "success" | "muted"> = { open: "brand", in_progress: "warning", resolved: "success", closed: "muted" };

function isCategory(v: string | null): v is Category {
  return v === "safety" || v === "incident" || v === "payment" || v === "other";
}

export function SupportView() {
  const params = useSearchParams();
  const router = useRouter();
  const { ticketsVersion } = useDriverRuntime();
  const initialCat = params.get("new");
  const initialRide = params.get("rideId");
  const [category, setCategory] = useState<Category | null>(isCategory(initialCat) ? initialCat : null);
  const [tickets, setTickets] = useState<TicketDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.support
      .list()
      .then(({ tickets: t }) => active && setTickets(t))
      .catch((err: unknown) => active && setError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, [ticketsVersion]);

  return (
    <DriverPage title="תמיכה ובטיחות" subtitle="צוות HOP זמין לכל בעיה בדרך">
      <div className="grid gap-5">
        <div className="relative overflow-hidden rounded-[26px] bg-[color-mix(in_oklab,var(--danger)_6%,var(--surface))] p-4 shadow-[0_14px_30px_-24px_rgba(229,72,77,0.6)] ring-1 ring-danger/25 sm:p-5">
          <div className="flex items-start gap-3">
            <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", CHIP.danger)}>
              <Phone size={20} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold">במצב חירום — קודם כל מתקשרים</div>
              <p className="mt-0.5 text-sm text-fg-muted">בסכנה מיידית חייגו לגורמי החירום, ורק אחר כך דווחו לנו.</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href="tel:100" className={cn("btn btn-danger h-14 text-base", FILL.danger)}>
              משטרה · <span className="ltr-nums">100</span>
            </a>
            <a href="tel:101" className="btn btn-glass h-14 text-base">
              מד״א · <span className="ltr-nums">101</span>
            </a>
          </div>
        </div>

        <section aria-labelledby="new-ticket">
          <h2 id="new-ticket" className="mb-2 px-1 text-base font-extrabold">
            פנייה חדשה
          </h2>
          <AnimatePresence mode="wait" initial={false}>
            {category ? (
              <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ type: "spring", stiffness: 360, damping: 32 }}>
                <NewTicketForm category={category} initialRideId={initialRide} onCancel={() => setCategory(null)} onCreated={(t) => router.push(`/drive/support/${t.id}`)} onCategory={setCategory} />
              </motion.div>
            ) : (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <StaggerList className="grid grid-cols-2 gap-2">
                  {QUICK.map((q) => (
                    <StaggerItem key={q.id}>
                      <button
                        type="button"
                        onClick={() => setCategory(q.id)}
                        className="card flex h-full min-h-32 w-full flex-col items-start gap-2 p-4 text-start transition-[transform,box-shadow] hover:shadow-[0_1px_2px_rgba(17,19,24,0.04),0_18px_36px_-24px_rgba(17,19,24,0.45)] active:scale-[0.98]"
                        data-testid={`quick-${q.id}`}
                      >
                        <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", q.tone)}>
                          <q.icon size={21} aria-hidden />
                        </span>
                        <span className="text-sm font-extrabold leading-snug">{q.title}</span>
                        <span className="text-xs text-fg-muted">{q.text}</span>
                      </button>
                    </StaggerItem>
                  ))}
                </StaggerList>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section aria-labelledby="my-tickets">
          <h2 id="my-tickets" className="mb-2 px-1 text-base font-extrabold">
            הפניות שלי
          </h2>
          {error && (
            <Notice tone="danger" live>
              {error}
            </Notice>
          )}
          {!tickets && !error ? (
            <div className="grid place-items-center py-10">
              <NeedleLoader size={40} label="טוענים פניות" />
            </div>
          ) : tickets && tickets.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-10 text-center">
              <span className={cn("mb-3 grid h-14 w-14 place-items-center rounded-3xl", CHIP.brand)}>
                <MessagesSquare size={26} aria-hidden />
              </span>
              <div className="display text-lg">שקט כאן. וזה סימן טוב.</div>
              <p className="mt-1 max-w-xs text-sm text-fg-muted">אין פניות פתוחות. אם משהו לא בסדר בדרך — אנחנו כאן.</p>
            </div>
          ) : (
            <StaggerList className="card divide-y divide-line overflow-hidden p-0">
              {(tickets ?? []).map((t) => (
                <StaggerItem key={t.id}>
                  <Link href={`/drive/support/${t.id}`} className="flex min-h-[72px] items-center gap-3 px-4 py-3 transition-colors hover:bg-bg" data-testid="ticket-row">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{t.subject}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                        <TonePill tone={STATUS_TONE[t.status]} className="h-6 text-[11px]">
                          {TICKET_STATUS_HE[t.status]}
                        </TonePill>
                        <span>{TICKET_CATEGORY_HE[t.category]}</span>
                        <span>· עודכן {formatRelative(t.updatedAt)}</span>
                      </div>
                    </div>
                    <ChevronLeft size={18} className="shrink-0 text-fg-muted" aria-hidden />
                  </Link>
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </section>
      </div>
    </DriverPage>
  );
}

function NewTicketForm({ category, initialRideId, onCancel, onCreated, onCategory }: { category: Category; initialRideId: string | null; onCancel: () => void; onCreated: (t: TicketDTO) => void; onCategory: (c: Category) => void }) {
  const toast = useToast();
  const q = QUICK.find((x) => x.id === category)!;
  const [subject, setSubject] = useState(q.subject);
  const [body, setBody] = useState("");
  const [rideId, setRideId] = useState(initialRideId ?? "");
  const [rides, setRides] = useState<RideDTO[] | null>(null);
  const [errors, setErrors] = useState<{ subject?: string; body?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    api.rides
      .list({ limit: 15 })
      .then(({ rides: r }) => active && setRides(r))
      .catch(() => active && setRides([]));
    return () => {
      active = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v: typeof errors = {};
    if (subject.trim().length < 3) v.subject = "כתבו נושא קצר (לפחות 3 תווים)";
    if (body.trim().length < 5) v.body = "ספרו לנו מה קרה (לפחות 5 תווים)";
    setErrors(v);
    if (Object.keys(v).length) return;
    setSending(true);
    setError(null);
    try {
      const { ticket } = await api.support.create({ category, subject: subject.trim(), body: body.trim(), rideId: rideId || null });
      toast.success("הפנייה נשלחה", category === "safety" || category === "incident" ? "סומנה כדחופה — צוות הבטיחות יחזור אליך בהקדם" : "נחזור אליך כאן בהקדם");
      onCreated(ticket);
    } catch (err) {
      setError(errorMessage(err));
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card grid gap-4 p-4 sm:p-5" data-testid="new-ticket-form">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", q.tone)}>
          <q.icon size={21} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">{q.title}</div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK.filter((x) => x.id !== category).map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  onCategory(x.id);
                  if (!subject.trim() || QUICK.some((y) => y.subject === subject)) setSubject(x.subject);
                }}
                className="min-h-11 rounded-full bg-bg px-3 text-[11px] font-bold text-fg-muted ring-1 ring-line transition-colors hover:text-fg"
              >
                {x.title}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={onCancel} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bg text-fg-muted transition-colors hover:text-fg" aria-label="ביטול פנייה">
          <X size={20} aria-hidden />
        </button>
      </div>
      {(category === "safety" || category === "incident") && (
        <Notice tone="warning">פניות בטיחות ואירועים מסומנות כדחופות. בסכנה מיידית — חייגו 100.</Notice>
      )}
      <Field label="נסיעה קשורה (לא חובה)">
        {(id) => (
          <Select id={id} value={rideId} onChange={(e) => setRideId(e.target.value)}>
            <option value="">ללא נסיעה מסוימת</option>
            {rideId && rides && !rides.some((r) => r.id === rideId) && <option value={rideId}>הנסיעה שנבחרה</option>}
            {(rides ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {formatDateTime(r.requestedAt)} · {r.pickup.address.split(",")[0]} ← {r.dropoff.address.split(",")[0]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="נושא" error={errors.subject}>
        {(id) => <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 120))} invalid={!!errors.subject} placeholder="במשפט אחד" />}
      </Field>
      <Field label="מה קרה?" error={errors.body} hint="כמה שיותר פרטים: מתי, איפה ומה בדיוק קרה">
        {(id) => <Textarea id={id} value={body} onChange={(e) => setBody(e.target.value.slice(0, 3000))} invalid={!!errors.body} className="min-h-[130px]" data-testid="ticket-body" />}
      </Field>
      {error && (
        <Notice tone="danger" live>
          {error}
        </Notice>
      )}
      <Button type="submit" size="lg" block loading={sending} data-testid="ticket-submit">
        שליחת הפנייה
      </Button>
    </form>
  );
}
