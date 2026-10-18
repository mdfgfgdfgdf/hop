"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Car, User } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { homeForRole } from "@/lib/routes";
import { Button, Field, Input, cn } from "@/components/ui";
import { useSession } from "@/components/app/session";
import { useHydrated } from "@/lib/use-hydrated";
import { useAuthBrand } from "../AuthBrand";

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();
  const hydrated = useHydrated();
  const brand = useAuthBrand();
  const [role, setRole] = useState<"rider" | "driver">(params.get("role") === "driver" ? "driver" : "rider");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!accept) {
      setError("יש לאשר את תנאי השימוש ומדיניות הפרטיות");
      return;
    }
    setLoading(true);
    brand.setPhase("submitting");
    try {
      const { user } = await api.auth.signup({ role, ...form, acceptTerms: true });
      brand.setPhase("success");
      await refresh();
      router.replace(homeForRole(user.role));
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (Array.isArray(err.details)) {
          const fe: Record<string, string> = {};
          for (const d of err.details as { path: string; message: string }[]) fe[d.path] = d.message;
          setFieldErrors(fe);
        }
      } else setError("משהו השתבש, נסו שוב");
      setLoading(false);
      brand.setPhase("idle");
    }
  }

  return (
    <div className="glass glass-strong animate-fade-up p-6 sm:p-7">
      <h1 className="display text-[30px]">יוצרים חשבון</h1>
      <p className="mt-1.5 text-sm text-fg-muted">דקה אחת ואתם בפנים</p>

      <div className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] p-1 shadow-[inset_0_1px_2px_rgba(17,19,24,.06)]" role="radiogroup" aria-label="סוג חשבון">
        {(
          [
            { v: "rider", label: "נוסע/ת", icon: <User size={18} /> },
            { v: "driver", label: "נהג/ת", icon: <Car size={18} /> },
          ] as const
        ).map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={role === o.v}
            onClick={() => setRole(o.v)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-bold transition-[background-color,color,box-shadow]",
              role === o.v
                ? "bg-surface text-brand-700 shadow-[0_0_0_1.5px_var(--brand),0_6px_16px_-8px_rgba(36,87,255,.55)]"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <Field label="שם מלא" error={fieldErrors.name}>
          {(id) => <Input id={id} autoComplete="name" value={form.name} onChange={set("name")} required invalid={!!fieldErrors.name} />}
        </Field>
        <Field label="אימייל" error={fieldErrors.email}>
          {(id) => <Input id={id} type="email" autoComplete="email" inputMode="email" dir="ltr" value={form.email} onChange={set("email")} required invalid={!!fieldErrors.email} />}
        </Field>
        <Field label="טלפון נייד" error={fieldErrors.phone} hint="לדוגמה 050-1234567">
          {(id) => <Input id={id} type="tel" autoComplete="tel" inputMode="tel" dir="ltr" value={form.phone} onChange={set("phone")} required invalid={!!fieldErrors.phone} />}
        </Field>
        <Field label="סיסמה" error={fieldErrors.password} hint="לפחות 8 תווים, כולל ספרה">
          {(id) => <Input id={id} type="password" autoComplete="new-password" dir="ltr" value={form.password} onChange={set("password")} required minLength={8} invalid={!!fieldErrors.password} />}
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--brand)]" />
          <span>
            קראתי ואני מאשר/ת את{" "}
            <Link href="/legal/terms" target="_blank" className="font-bold text-brand">
              תנאי השימוש
            </Link>{" "}
            ואת{" "}
            <Link href="/legal/privacy" target="_blank" className="font-bold text-brand">
              מדיניות הפרטיות
            </Link>
            .
          </span>
        </label>
        {role === "driver" && (
          <p className="rounded-2xl border border-brand/15 bg-brand-50 px-3.5 py-2.5 text-xs leading-relaxed text-brand-700">
            נהגים נדרשים להעלות רישיון נהיגה, היתר להסעת נוסעים בשכר, רישיון מונית, רישיון רכב וביטוח. קבלת נסיעות מתאפשרת רק לאחר אישור.
          </p>
        )}
        {error && (
          <div role="alert" data-testid="signup-error" className="rounded-2xl border border-danger/20 bg-danger/10 px-3.5 py-2.5 text-sm font-semibold text-danger">
            {error}
          </div>
        )}
        <Button type="submit" size="lg" block loading={loading} disabled={!hydrated} data-testid="signup-submit">
          {role === "driver" ? "הרשמה כנהג/ת" : "הרשמה"}
        </Button>
      </form>
      <div className="divider mt-6" />
      <p className="mt-5 text-center text-sm text-fg-muted">
        כבר יש חשבון?{" "}
        <Link href="/login" className="font-bold text-brand hover:underline">
          התחברות
        </Link>
      </p>
    </div>
  );
}
