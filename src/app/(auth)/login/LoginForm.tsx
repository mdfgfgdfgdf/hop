"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";
import { homeForRole } from "@/lib/routes";
import { Button, Field, Input } from "@/components/ui";
import { useSession } from "@/components/app/session";
import { useHydrated } from "@/lib/use-hydrated";
import { useAuthBrand } from "../AuthBrand";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();
  const hydrated = useHydrated();
  const brand = useAuthBrand();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    brand.setPhase("submitting");
    try {
      const { user } = await api.auth.login({ email, password });
      brand.setPhase("success");
      await refresh();
      const next = params.get("next");
      const home = homeForRole(user.role);
      router.replace(next && next.startsWith("/") && (next.startsWith(home) || user.role === "admin") ? next : home);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "משהו השתבש, נסו שוב");
      setLoading(false);
      brand.setPhase("idle");
    }
  }

  return (
    <div className="glass glass-strong animate-fade-up p-6 sm:p-7">
      <h1 className="display text-[30px]">ברוכים השבים</h1>
      <p className="mt-1.5 text-sm text-fg-muted">התחברו כדי להמשיך לנסיעה הבאה</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="אימייל">
          {(id) => <Input id={id} type="email" autoComplete="email" inputMode="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <Field label="סיסמה">
          {(id) => <Input id={id} type="password" autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        </Field>
        {error && (
          <div role="alert" data-testid="login-error" className="rounded-2xl border border-danger/20 bg-danger/10 px-3.5 py-2.5 text-sm font-semibold text-danger">
            {error}
          </div>
        )}
        <Button type="submit" size="lg" block loading={loading} disabled={!hydrated} className="mt-2" data-testid="login-submit">
          התחברות
        </Button>
      </form>
      <div className="divider mt-6" />
      <p className="mt-5 text-center text-sm text-fg-muted">
        עדיין אין חשבון?{" "}
        <Link href="/signup" className="font-bold text-brand hover:underline">
          הרשמה
        </Link>
      </p>
    </div>
  );
}
