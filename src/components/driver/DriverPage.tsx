"use client";
/** Chrome for driver content pages (earnings, history, profile, support…). */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/components/ui";
import { useDriverRuntime } from "./DriverRuntime";

export function DriverPage({
  title,
  subtitle,
  back = "/drive",
  backLabel = "חזרה",
  actions,
  children,
  wide,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  back?: string | null;
  backLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const { demoMode } = useDriverRuntime();
  return (
    <main className="bg-aurora min-h-dvh">
      <header className={cn("sticky top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--bg)_78%,transparent)] backdrop-blur-xl", demoMode ? "pt-[calc(var(--safe-top)+2rem)]" : "safe-top")}>
        <div className={cn("mx-auto flex min-h-16 items-center gap-2 px-3 py-2", wide ? "max-w-5xl" : "max-w-2xl")}>
          {back && (
            <Link href={back} className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-[color-mix(in_oklab,var(--fg)_8%,transparent)]" aria-label={backLabel}>
              <ArrowRight size={22} aria-hidden />
            </Link>
          )}
          <div className={cn("min-w-0 flex-1", !back && "ps-2")}>
            <h1 className="display truncate text-xl">{title}</h1>
            {subtitle && <div className="truncate text-xs text-fg-muted">{subtitle}</div>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          <Link href="/drive" aria-label="HOP — למסך הנהיגה" className="shrink-0 rounded-[10px]">
            <LogoMark size={34} />
          </Link>
        </div>
      </header>
      <div className={cn("mx-auto px-4 pt-5 pb-32", wide ? "max-w-5xl" : "max-w-2xl", className)}>{children}</div>
    </main>
  );
}

/** Card section with a heading, used across driver content pages. */
export function Section({ title, description, action, children, className, id }: { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("card p-4 sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-extrabold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
