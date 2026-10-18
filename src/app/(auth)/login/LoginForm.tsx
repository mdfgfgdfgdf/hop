"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";
import { homeForRole } from "@/lib/routes";
import { Button, Field, Input } from "@/components/ui";
import { useSession } from "@/components/app/session";
import { useHydrated } from "@/lib/use-hydrated";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await api.auth.login({ email, password });
      await refresh();
      const next = params.get("next");
      const home = homeForRole(user.role);
      router.replace(next && next.startsWith("/") && (next.startsWith(home) || user.role === "admin") ? next : home);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "משהו השתבש, נסו שוב");
      setLoading(false);
    }
  }

  return (
    <div className="glass glass-strong p-6 animate-fade-up">
      <h1 className="display text-3xl">ברוכים השבים</h1>
      <p className="mt-1 text-sm text-fg-muted">התחברו כדי להמשיך</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="אימייל">
          {(id) => <Input id={id} type="email" autoComplete="email" inputMode="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <Field label="סיסמה">
          {(id) => <Input id={id} type="password" autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        </Field>
        {error && (
          <div role="alert" data-testid="login-error" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
            {error}
          </div>
        )}
        <Button type="submit" block loading={loading} disabled={!hydrated} data-testid="login-submit">
          התחברות
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-fg-muted">
        עדיין אין חשבון?{" "}
        <Link href="/signup" className="font-bold text-brand">
          הרשמה
        </Link>
      </p>
    </div>
  );
}
