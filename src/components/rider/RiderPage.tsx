"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DemoBanner } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { AccountMenu } from "./AccountMenu";
import { useRiderInfo } from "./RiderContext";

/** Shell for the non-map rider pages (history, settings, support). */
export function RiderPage({
  title,
  subtitle,
  back = "/ride",
  backLabel = "חזרה",
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  back?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const { demoMode } = useRiderInfo();
  return (
    <div className="bg-aurora min-h-dvh">
      <header className="sticky top-0 z-30 px-3 pt-3 safe-top">
        <div className="glass glass-strong glass-pill mx-auto flex h-16 max-w-2xl items-center gap-2 ps-2 pe-2.5">
          <Link href={back} aria-label={backLabel} className="btn btn-ghost btn-icon shrink-0">
            <ArrowRight size={22} aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold leading-tight">{title}</h1>
            {subtitle && <div className="truncate text-xs text-fg-muted">{subtitle}</div>}
          </div>
          {demoMode && <DemoBanner compact text="הדגמה" className="shrink-0" />}
          <AccountMenu />
        </div>
      </header>
      <main className={cn("mx-auto w-full max-w-2xl px-4 pt-5 pb-32", className)}>
        {actions && <div className="mb-4 flex flex-wrap items-center gap-2">{actions}</div>}
        {children}
      </main>
    </div>
  );
}

/** Titled group inside a page. */
export function Section({ title, description, children, className, action }: { title: string; description?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("mb-6", className)}>
      <div className="mb-2 flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-sm font-extrabold">{title}</h2>
          {description && <p className="text-xs text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
