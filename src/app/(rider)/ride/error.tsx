"use client";
import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";

/** Friendly fallback for unexpected errors anywhere in the rider app. */
export default function RiderError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="bg-aurora flex min-h-dvh items-center justify-center px-5">
      <div className="glass glass-strong w-full max-w-sm p-6 text-center" role="alert">
        <LogoMark size={52} className="mx-auto" />
        <h1 className="display mt-4 text-2xl">אופס, משהו השתבש</h1>
        <p className="mt-2 text-sm text-fg-muted">זה לא אתם, זה אנחנו. אם יש לכם נסיעה פעילה — היא ממשיכה כרגיל, ואפשר לחזור אליה מיד.</p>
        <div className="mt-6 grid gap-2">
          <button type="button" onClick={() => retry()} className="btn btn-primary btn-block">
            <RotateCcw size={18} aria-hidden /> ניסיון נוסף
          </button>
          <Link href="/ride" className="btn btn-ghost btn-block">
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    </main>
  );
}
