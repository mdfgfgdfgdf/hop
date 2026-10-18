"use client";
/** Chrome for driver content pages (earnings, history, profile, support…). */
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { AnimatedMark } from "@/components/brand/AnimatedLogo";
import { DemoBanner, cn } from "@/components/ui";
import { useDriverRuntime } from "./DriverRuntime";
import { FIELD_ERROR_FIX, TEXT } from "./tone";

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
  const width = wide ? "max-w-5xl" : "max-w-2xl";
  return (
    <main className={cn("bg-aurora min-h-dvh", FIELD_ERROR_FIX)}>
      <motion.header
        initial={{ y: -14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="pointer-events-none sticky top-0 z-30 px-3 pt-3 safe-top"
      >
        <div className={cn("glass glass-strong glass-pill pointer-events-auto mx-auto flex h-16 items-center gap-2 ps-2 pe-2", width)}>
          {back ? (
            <Link href={back} className="btn btn-ghost btn-icon shrink-0" aria-label={backLabel}>
              <ArrowRight size={22} aria-hidden />
            </Link>
          ) : (
            <span className="w-1 shrink-0" aria-hidden />
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <h1 className="truncate text-lg font-extrabold">{title}</h1>
            {subtitle && <div className={cn("truncate text-xs font-medium", TEXT.muted)}>{subtitle}</div>}
          </div>
          {demoMode && <DemoBanner compact text="הדגמה" className="shrink-0" />}
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
          <Link href="/drive" aria-label="HOP — למסך הנהיגה" className={cn("shrink-0 rounded-[12px] transition-transform active:scale-95", actions != null && back != null && "hidden sm:block")}>
            <AnimatedMark size={42} hopOn="both" title="HOP" />
          </Link>
        </div>
      </motion.header>
      <div className={cn("mx-auto px-4 pt-5 pb-32", width, className)}>{children}</div>
    </main>
  );
}

/** Card section with a heading, used across driver content pages. */
export function Section({ title, description, action, children, className, id }: { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("card scroll-mt-24 p-4 sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-extrabold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
