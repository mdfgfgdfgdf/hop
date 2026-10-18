"use client";
import { useState } from "react";
import Link from "next/link";
import { Banknote, Check, ChevronLeft, CreditCard, FileText, LogOut, MapPin, ShieldCheck, Trash2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { api } from "@/lib/api";
import { Avatar, Button, Field, Input, useToast } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useSession } from "@/components/app/session";
import { Dialog } from "../Dialog";
import { InlineError } from "../InlineError";
import { useRiderInfo } from "../RiderContext";
import { RiderPage, Section } from "../RiderPage";
import { describeError, type FriendlyError } from "../lib/errors";
import { clearRecents, setPaymentPreference, usePaymentPreference, useRecents, type PaymentMethod } from "../lib/storage";

export function SettingsView() {
  return (
    <RiderPage title="הגדרות" subtitle="פרופיל, תשלום ופרטיות">
      <div data-testid="settings">
        <ProfileSection />
        <PaymentSection />
        <PrivacySection />
        <AccountSection />
        <div className="mt-10 flex flex-col items-center gap-1 text-xs text-fg-muted">
          <Logo height={22} />
          <span>העיר שלך. הופ אחד. · MOVE WITH HOP</span>
        </div>
      </div>
    </RiderPage>
  );
}

function ProfileSection() {
  const { user, refresh } = useSession();
  const { name: fallbackName } = useRiderInfo();
  const toast = useToast();
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [fieldErr, setFieldErr] = useState<{ name?: string; phone?: string }>({});
  const nameValue = name ?? user?.name ?? fallbackName;
  const phoneValue = phone ?? user?.phone ?? "";
  const dirty = (name != null && name !== user?.name) || (phone != null && phone !== (user?.phone ?? ""));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: { name?: string; phone?: string } = {};
    if (nameValue.trim().length < 2) errs.name = "שם צריך להכיל לפחות 2 תווים";
    const digits = phoneValue.replace(/\D/g, "");
    if (phoneValue && (digits.length < 9 || digits.length > 13)) errs.phone = "מספר טלפון לא תקין (לדוגמה 050-1234567)";
    setFieldErr(errs);
    if (errs.name || errs.phone) return;
    setBusy(true);
    setError(null);
    try {
      await api.auth.updateProfile({ name: nameValue.trim(), ...(phoneValue ? { phone: phoneValue.trim() } : {}) });
      await refresh();
      setName(null);
      setPhone(null);
      toast.success("הפרטים נשמרו");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="פרופיל">
      <form className="card p-4" onSubmit={save} noValidate>
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={nameValue || "HOP"} size={52} />
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold">{nameValue}</div>
            <div className="truncate text-sm text-fg-muted" dir="ltr">
              {user?.email ?? ""}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="שם מלא" error={fieldErr.name}>
            {(id) => <Input id={id} value={nameValue} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} invalid={!!fieldErr.name} />}
          </Field>
          <Field label="טלפון" error={fieldErr.phone} hint="הנהג רואה רק את 4 הספרות האחרונות">
            {(id) => <Input id={id} value={phoneValue} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" dir="ltr" className="text-start" maxLength={16} invalid={!!fieldErr.phone} />}
          </Field>
        </div>
        {error && <InlineError error={error} className="mt-3" />}
        <div className="mt-4 flex justify-end">
          <Button type="submit" loading={busy} disabled={!dirty}>
            שמירת שינויים
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PaymentSection() {
  const pref = usePaymentPreference();
  const toast = useToast();
  const options: { value: PaymentMethod; title: string; text: string; icon: React.ReactNode }[] = [
    { value: "cash", title: "מזומן", text: "משלמים לנהג בסוף הנסיעה. ברירת המחדל.", icon: <Banknote size={20} aria-hidden /> },
    { value: "card_demo", title: "כרטיס (הדגמה)", text: "הדגמה בלבד, ללא חיוב — לא נשמרים פרטי כרטיס.", icon: <CreditCard size={20} aria-hidden /> },
  ];
  return (
    <Section title="אמצעי תשלום" description="נבחר אוטומטית בכל הזמנה — אפשר לשנות לפני שמזמינים.">
      <div className="card divide-y divide-[var(--line)] p-1" role="radiogroup" aria-label="אמצעי תשלום מועדף">
        {options.map((o) => {
          const selected = pref === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setPaymentPreference(o.value);
                toast.success("אמצעי התשלום עודכן", o.title);
              }}
              className="flex min-h-16 w-full items-center gap-3 rounded-[20px] px-3 py-3 text-start hover:bg-[color-mix(in_oklab,var(--fg)_4%,transparent)]"
            >
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", selected ? "bg-brand text-white" : "bg-[color-mix(in_oklab,var(--fg)_7%,transparent)] text-fg-muted")}>{o.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{o.title}</span>
                <span className="block text-xs text-fg-muted">{o.text}</span>
              </span>
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2", selected ? "border-brand bg-brand text-white" : "border-mist")} aria-hidden>
                {selected && <Check size={14} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function PrivacySection() {
  const toast = useToast();
  const recents = useRecents();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  async function requestDeletion() {
    setBusy(true);
    setError(null);
    try {
      await api.support.create({
        category: "other",
        subject: "בקשת מחיקת נתונים",
        body: "אבקש למחוק את החשבון שלי ואת הנתונים האישיים הקשורים אליו בהתאם למדיניות הפרטיות של HOP.",
      });
      setConfirm(false);
      toast.success("הבקשה נשלחה", "צוות HOP יטפל בה ויעדכן אתכם בפנייה במסך התמיכה.");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="פרטיות">
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-brand">
            <MapPin size={19} aria-hidden />
          </span>
          <div className="text-sm">
            <div className="font-bold">איך אנחנו משתמשים במיקום שלכם</div>
            <p className="mt-1 text-fg-muted">
              המיקום משמש רק כדי להציע נקודת איסוף ולחשב מחיר וזמן הגעה. בזמן נסיעה הנהג רואה את נקודת האיסוף והיעד בלבד, ומסלול הנסיעה נשמר לצורכי בטיחות, קבלה וטיפול בפניות. אפשר תמיד לבחור נקודת איסוף ידנית על המפה.
            </p>
          </div>
        </div>
        <div className="divider my-4" />
        <nav className="space-y-1" aria-label="מסמכים משפטיים">
          <LegalLink href="/legal/privacy" icon={<ShieldCheck size={18} aria-hidden />} label="מדיניות פרטיות" />
          <LegalLink href="/legal/terms" icon={<FileText size={18} aria-hidden />} label="תנאי שימוש" />
        </nav>
        <div className="divider my-4" />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="glass"
            size="sm"
            disabled={recents.length === 0}
            onClick={() => {
              clearRecents();
              toast.success("היעדים האחרונים נמחקו מהמכשיר");
            }}
          >
            ניקוי יעדים אחרונים
          </Button>
          <Button variant="ghost" size="sm" className="text-danger!" onClick={() => setConfirm(true)} data-testid="delete-data">
            <Trash2 size={16} aria-hidden /> בקשת מחיקת נתונים
          </Button>
        </div>
      </div>
      <Dialog open={confirm} onClose={() => !busy && setConfirm(false)} title="לבקש מחיקת נתונים?" description="נפתח עבורכם פנייה לצוות HOP. לאחר אימות נמחק את החשבון והנתונים האישיים, למעט מה שהחוק מחייב לשמור (למשל קבלות)." icon={<Trash2 size={20} aria-hidden />}>
        {error && <InlineError error={error} className="mb-3" />}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="glass" onClick={() => setConfirm(false)} disabled={busy} data-autofocus>
            ביטול
          </Button>
          <Button variant="danger" onClick={requestDeletion} loading={busy}>
            שליחת בקשה
          </Button>
        </div>
      </Dialog>
    </Section>
  );
}

function LegalLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm font-semibold hover:bg-[color-mix(in_oklab,var(--fg)_5%,transparent)]">
      <span className="text-fg-muted">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronLeft size={16} className="text-fg-muted" aria-hidden />
    </Link>
  );
}

function AccountSection() {
  const { logout } = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Section title="חשבון">
      <div className="card p-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await logout();
            } catch {
              toast.error("ההתנתקות נכשלה", "בדקו את החיבור ונסו שוב.");
              setBusy(false);
            }
          }}
          className="flex min-h-12 w-full items-center gap-3 rounded-[18px] px-3 text-start text-sm font-bold text-danger! hover:bg-danger/10 disabled:opacity-60"
        >
          <LogOut size={18} aria-hidden />
          {busy ? "מתנתקים…" : "התנתקות"}
        </button>
      </div>
    </Section>
  );
}
