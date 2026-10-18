"use client";
import { useState } from "react";
import { Ambulance, Send, ShieldAlert, Siren } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Field, Textarea, useToast } from "@/components/ui";
import { describeError, type FriendlyError } from "../lib/errors";
import { Dialog } from "../Dialog";
import { InlineError } from "../InlineError";

/** Safety centre: emergency numbers + an urgent report to HOP's safety team. */
export function SafetyDialog({ rideId, open, onClose }: { rideId: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const tooShort = body.trim().length < 5;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tooShort) {
      setError({ code: "validation", title: "ספרו לנו מה קרה", message: "כתבו לפחות כמה מילים כדי שנוכל לעזור." });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.support.create({ rideId, category: "safety", subject: "דיווח בטיחות במהלך נסיעה", body: body.trim() });
      toast.success("הדיווח נשלח לצוות הבטיחות", "נציג יחזור אליכם בהקדם. במקרה חירום חייגו 100.");
      setBody("");
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} title="מרכז הבטיחות" description="אנחנו כאן בשבילכם. במצב חירום — פנו קודם לגורמי ההצלה." icon={<ShieldAlert size={22} aria-hidden />}>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <a href="tel:100" className="btn btn-danger" aria-label="חיוג למשטרה 100">
          <Siren size={18} aria-hidden /> משטרה 100
        </a>
        <a href="tel:101" className="btn btn-glass" aria-label='חיוג למד"א 101'>
          <Ambulance size={18} aria-hidden /> מד״א 101
        </a>
      </div>
      <form onSubmit={submit} noValidate>
        <Field label="דיווח לצוות הבטיחות של HOP" hint="הדיווח מצורף לנסיעה הנוכחית ומטופל בעדיפות דחופה.">
          {(id) => <Textarea id={id} value={body} onChange={(e) => setBody(e.target.value)} placeholder="מה קרה? למשל: נהיגה מסוכנת, התנהגות לא נאותה…" maxLength={3000} rows={3} />}
        </Field>
        {error && <InlineError error={error} className="mt-3" />}
        <Button type="submit" block className="mt-4" loading={busy} data-testid="safety-submit">
          <Send size={18} aria-hidden /> שליחת דיווח דחוף
        </Button>
      </form>
    </Dialog>
  );
}
