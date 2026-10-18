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
    <div>
      <h1 className="text-[28px] font-bold leading-tight">התחברות</h1>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="אימייל">
          {(id) => <Input id={id} type="email" autoComplete="email" inputMode="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <Field label="סיסמה">
          {(id) => <Input id={id} type="password" autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        </Field>
        {error && (
          <div role="alert" data-testid="login-error" className="rounded-lg bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger-ink">
            {error}
          </div>
        )}
        <Button type="submit" size="lg" block loading={loading} disabled={!hydrated} className="mt-2" data-testid="login-submit">
          התחברות
        </Button>
      </form>
      <p className="mt-6 text-sm text-fg-muted">
        עדיין אין חשבון?{" "}
        <Link href="/signup" className="font-semibold text-fg underline underline-offset-2">
          הרשמה
        </Link>
      </p>
    </div>
  );
}
