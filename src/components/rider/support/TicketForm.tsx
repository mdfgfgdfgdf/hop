"use client";
import { useState } from "react";
import { Link2, Send } from "lucide-react";
import { api, type TicketDTO } from "@/lib/api";
import { TICKET_CATEGORY_HE } from "@/lib/labels";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { InlineError } from "../InlineError";
import { describeError, type FriendlyError } from "../lib/errors";

type Category = TicketDTO["category"];
const CATEGORIES = Object.keys(TICKET_CATEGORY_HE) as Category[];
const SUBJECT_HINT: Record<Category, string> = {
  complaint: "למשל: הנהג לא הגיע לנקודת האיסוף",
  safety: "למשל: נהיגה מסוכנת",
  lost_item: "למשל: שכחתי תיק ברכב",
  payment: "למשל: חויבתי פעמיים",
  incident: "למשל: תאונה קלה בזמן הנסיעה",
  other: "במה נוכל לעזור?",
};

export function TicketForm({ rideId, initialCategory, onCreated, onCancel }: { rideId?: string | null; initialCategory?: Category; onCreated: (t: TicketDTO) => void; onCancel?: () => void }) {
  const [category, setCategory] = useState<Category>(initialCategory ?? (rideId ? "complaint" : "other"));
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [fieldErr, setFieldErr] = useState<{ subject?: string; body?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: { subject?: string; body?: string } = {};
    if (subject.trim().length < 3) errs.subject = "כתבו נושא קצר (לפחות 3 תווים)";
    if (body.trim().length < 5) errs.body = "ספרו לנו קצת יותר (לפחות 5 תווים)";
    setFieldErr(errs);
    if (errs.subject || errs.body) return;
    setBusy(true);
    setError(null);
    try {
      const { ticket } = await api.support.create({ rideId: rideId ?? null, category, subject: subject.trim(), body: body.trim() });
      onCreated(ticket);
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-4" noValidate data-testid="ticket-form">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold">פנייה חדשה</h2>
        {rideId && (
          <span className="pill pill-brand">
            <Link2 size={14} aria-hidden /> מצורף לנסיעה
          </span>
        )}
      </div>
      <Field label="נושא הפנייה">
        {(id) => (
          <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TICKET_CATEGORY_HE[c]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="כותרת" error={fieldErr.subject}>
        {(id) => <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={SUBJECT_HINT[category]} maxLength={120} invalid={!!fieldErr.subject} />}
      </Field>
      <Field label="מה קרה?" error={fieldErr.body} hint={category === "safety" ? "פניות בטיחות מטופלות בעדיפות דחופה. במצב חירום חייגו 100." : "כמה שיותר פרטים יעזרו לנו לעזור לכם מהר."}>
        {(id) => <Textarea id={id} value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={3000} invalid={!!fieldErr.body} />}
      </Field>
      {error && <InlineError error={error} />}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            ביטול
          </Button>
        )}
        <Button type="submit" loading={busy} data-testid="ticket-submit">
          <Send size={17} aria-hidden /> שליחת פנייה
        </Button>
      </div>
    </form>
  );
}
