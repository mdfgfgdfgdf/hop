"use client";
/**
 * Admin building blocks on top of @/components/ui: page header, panels,
 * KPI cards, responsive data table (table ≥ md, cards below), filter tabs,
 * search field, key/value lists and loading/error states.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { AlertTriangle, ArrowRight, RotateCw, Search, X } from "lucide-react";
import { Button, EmptyState, cn } from "@/components/ui";
import { AnimatedNumber, NeedleLoader, SPRING } from "./motion";

// ───────────────────────────── layout ─────────────────────────────

/** Skeleton block whose size is fully controlled by className (no default width/height). */
export function Bone({ className }: { className?: string }) {
  return <span className={cn("skeleton block", className)} aria-hidden />;
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1400px] px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-7", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  busy,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  meta?: React.ReactNode;
  /** Shows the needle + "מתעדכן…" while a background refresh runs. */
  busy?: boolean;
}) {
  return (
    <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex min-h-8 items-center gap-1 rounded-full text-sm font-semibold text-fg-muted transition-colors hover:text-fg">
            <ArrowRight size={16} aria-hidden />
            {back.label}
          </Link>
        )}
        <div className="flex items-center gap-3">
          <h1 className="display text-[26px] sm:text-[30px]">{title}</h1>
          {busy && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
              <NeedleLoader size={20} label={null} />
              מתעדכן…
            </span>
          )}
        </div>
        {meta && <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div>}
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush,
  id,
  index = 0,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** No body padding (tables, maps). */
  flush?: boolean;
  id?: string;
  /** Stagger position for the entrance animation. */
  index?: number;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: Math.min(index, 8) * 0.06 }}
      className={cn("card min-w-0 overflow-hidden", className)}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-bold leading-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && "p-4 sm:p-5", bodyClassName)}>{children}</div>
    </motion.section>
  );
}

// ───────────────────────────── KPIs ─────────────────────────────

type Tone = "brand" | "success" | "warning" | "danger" | "ink" | "muted";
const TONE_BG: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand",
  success: "bg-[color-mix(in_oklab,var(--success)_14%,transparent)] text-[color-mix(in_oklab,var(--success)_80%,var(--fg))]",
  warning: "bg-[color-mix(in_oklab,var(--warning)_20%,transparent)] text-[color-mix(in_oklab,var(--warning)_55%,var(--fg))]",
  danger: "bg-[color-mix(in_oklab,var(--danger)_13%,transparent)] text-danger",
  ink: "bg-[color-mix(in_oklab,var(--fg)_8%,transparent)] text-fg",
  muted: "bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] text-fg-muted",
};

export function Kpi({
  label,
  value,
  kind = "int",
  icon,
  tone = "brand",
  hint,
  href,
  loading,
  attention,
  index = 0,
}: {
  label: string;
  /** Numbers animate (count up on load, tick on live updates). */
  value: number | React.ReactNode;
  kind?: "int" | "ils" | "ils0";
  icon?: React.ReactNode;
  tone?: Tone;
  hint?: React.ReactNode;
  href?: string;
  loading?: boolean;
  /** Highlights the card (e.g. pending items that need action). */
  attention?: boolean;
  index?: number;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] font-semibold leading-snug text-fg-muted">{label}</div>
        {icon && <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", TONE_BG[attention ? "warning" : tone])}>{icon}</span>}
      </div>
      <div className="display mt-1.5 text-[28px] leading-none tabular-nums">{loading ? <Bone className="h-7 w-16" /> : typeof value === "number" ? <AnimatedNumber value={value} kind={kind} /> : value}</div>
      {hint && <div className={cn("mt-2 text-xs", attention ? "font-semibold text-[color-mix(in_oklab,var(--warning)_50%,var(--fg))]" : "text-fg-muted")}>{loading ? <Bone className="h-3 w-24" /> : hint}</div>}
    </>
  );
  const cls = cn(
    "card relative block h-full p-4 transition-[box-shadow,transform,border-color] duration-200",
    attention && "border-[color-mix(in_oklab,var(--warning)_60%,transparent)] shadow-[0_1px_2px_rgba(17,19,24,.04),0_12px_30px_-24px_rgba(17,19,24,.3),inset_0_3px_0_color-mix(in_oklab,var(--warning)_75%,transparent)]",
    href && "hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--brand)_30%,transparent)] hover:shadow-[0_1px_2px_rgba(17,19,24,.05),0_18px_36px_-22px_rgba(36,87,255,.45)]",
  );
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: Math.min(index, 12) * 0.04 }} className="min-w-0">
      {href ? (
        <Link href={href} className={cls}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </motion.div>
  );
}

// ───────────────────────────── data table ─────────────────────────────

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headClassName?: string;
  align?: "start" | "end";
  /** Hide this column in table mode below a breakpoint (cards still show it if `card` says so). */
  hideBelow?: "lg" | "xl";
  /** Role of the column in the mobile card: title row, top-end badge, labelled field, or hidden. */
  card?: "title" | "badge" | "field" | "hidden";
  /** Label used in the mobile card (defaults to header). */
  cardLabel?: string;
  /** Span both columns of the mobile card (long values like routes). */
  cardWide?: boolean;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  loading,
  empty,
  skeletonRows = 6,
  className,
  caption,
  tableFrom = "lg",
}: {
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string | null;
  loading?: boolean;
  empty?: React.ReactNode;
  skeletonRows?: number;
  className?: string;
  caption?: string;
  /** Breakpoint from which the real table is shown (cards below; 2-up cards on tablet). */
  tableFrom?: "md" | "lg" | "xl";
}) {
  const router = useRouter();
  if (loading || !rows) return <TableSkeleton rows={skeletonRows} cols={Math.min(columns.length, 6)} />;
  if (rows.length === 0) return <>{empty ?? <EmptyState title="אין נתונים להצגה" />}</>;

  const titleCols = columns.filter((c) => c.card === "title");
  const badgeCols = columns.filter((c) => c.card === "badge");
  const fieldCols = columns.filter((c) => !c.card || c.card === "field");
  const hide = (c: Column<T>) => (c.hideBelow === "lg" ? "hidden lg:table-cell" : c.hideBelow === "xl" ? "hidden xl:table-cell" : "");

  return (
    <div className={className}>
      {/* table ≥ breakpoint */}
      <div className={cn("hidden overflow-x-auto", TABLE_FROM[tableFrom])}>
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-line bg-[color-mix(in_oklab,var(--fg)_2.5%,transparent)]">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-fg-muted first:ps-5 last:pe-5", c.align === "end" ? "text-end" : "text-start", hide(c), c.headClassName)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, i) => {
              const href = rowHref?.(row) ?? null;
              return (
                <motion.tr
                  key={rowKey(row)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING, delay: Math.min(i, 14) * 0.022 }}
                  className={cn("transition-colors", href && "cursor-pointer hover:bg-brand-50")}
                  onClick={
                    href
                      ? (e) => {
                          if ((e.target as HTMLElement).closest("a,button,input,select,textarea,label")) return;
                          if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
                          else router.push(href);
                        }
                      : undefined
                  }
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 align-middle first:ps-5 last:pe-5", c.align === "end" && "text-end", hide(c), c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* cards < breakpoint (two columns on tablet) */}
      <ul className={cn("divide-y divide-line", CARDS_UNTIL[tableFrom])}>
        {rows.map((row, i) => {
          const href = rowHref?.(row) ?? null;
          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">{titleCols.map((c) => <div key={c.key}>{c.cell(row)}</div>)}</div>
                {badgeCols.length > 0 && <div className="flex shrink-0 flex-col items-end gap-1">{badgeCols.map((c) => <div key={c.key}>{c.cell(row)}</div>)}</div>}
              </div>
              {fieldCols.length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                  {fieldCols.map((c) => (
                    <div key={c.key} className={cn("min-w-0", c.cardWide && "col-span-2")}>
                      <dt className="text-[11px] font-semibold text-fg-muted">{c.cardLabel ?? c.header}</dt>
                      <dd className="mt-0.5 min-w-0 break-words">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          );
          return (
            <motion.li key={rowKey(row)} className={tableFrom !== "md" ? "md:border-b md:border-line md:odd:border-e" : undefined} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: Math.min(i, 10) * 0.03 }}>
              {href ? (
                <Link href={href} className="block px-4 py-4 transition-colors active:bg-brand-50">
                  {inner}
                </Link>
              ) : (
                <div className="px-4 py-4">{inner}</div>
              )}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

const TABLE_FROM = { md: "md:block", lg: "lg:block", xl: "xl:block" } as const;
const CARDS_UNTIL = {
  md: "md:hidden",
  lg: "md:grid md:grid-cols-2 md:divide-y-0 lg:hidden",
  xl: "md:grid md:grid-cols-2 md:divide-y-0 xl:hidden",
} as const;

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="טוען נתונים">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Bone className="h-9 w-9 shrink-0 rounded-full" />
          {Array.from({ length: cols }).map((__, j) => (
            <Bone key={j} className={cn("h-3.5", j === 0 ? "w-1/4" : "hidden w-1/6 md:block")} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────── filters ─────────────────────────────

export function FilterTabs<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number; attention?: boolean }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors",
              active
                ? "border-[color-mix(in_oklab,var(--brand)_55%,transparent)] bg-brand-50 text-brand-700 shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_10%,transparent)]"
                : "border-line bg-surface text-fg-muted hover:border-[var(--line-strong)] hover:text-fg",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  "min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] leading-none tabular-nums",
                  active ? "bg-brand/12 text-brand-700" : o.attention && o.count > 0 ? "bg-[color-mix(in_oklab,var(--warning)_25%,transparent)] text-[color-mix(in_oklab,var(--warning)_55%,var(--fg))]" : "bg-[color-mix(in_oklab,var(--fg)_7%,transparent)]",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder, label, className, id }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; className?: string; id?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search size={18} className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-fg-muted [inset-inline-start:14px]" aria-hidden />
      <input
        id={id}
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input h-11 bg-surface ps-11 pe-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="ניקוי חיפוש" className="absolute top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-fg-muted hover:bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] [inset-inline-end:6px]">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between", className)}>{children}</div>;
}

// ───────────────────────────── states ─────────────────────────────

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] text-danger">
        <AlertTriangle size={22} aria-hidden />
      </span>
      <div>
        <div className="font-bold">לא הצלחנו לטעון את הנתונים</div>
        <p className="mt-1 max-w-sm text-sm text-fg-muted">{message}</p>
      </div>
      {onRetry && (
        <Button variant="glass" size="sm" onClick={onRetry}>
          <RotateCw size={16} aria-hidden />
          נסו שוב
        </Button>
      )}
    </div>
  );
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-2xl bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] px-3.5 py-2.5 text-sm font-semibold text-danger">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="טוען">
      <div className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
        <NeedleLoader size={26} label={null} />
        טוען פרטים…
      </div>
      <div className="space-y-3">
        <Bone className="h-4 w-24" />
        <Bone className="h-8 w-64" />
        <Bone className="h-4 w-40" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card space-y-3 p-5 lg:col-span-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bone key={i} className="h-4" />
          ))}
        </div>
        <div className="card space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} className="h-4" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── key / value ─────────────────────────────

export function KV({ items, className, cols = 2 }: { items: { label: string; value: React.ReactNode; wide?: boolean }[]; className?: string; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((it) => (
        <div key={it.label} className={cn("min-w-0", it.wide && "sm:col-span-2 lg:col-span-3")}>
          <dt className="text-xs font-semibold text-fg-muted">{it.label}</dt>
          <dd className="mt-1 min-w-0 break-words text-[15px] font-medium">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** LTR island for plates, phones, emails and ids inside RTL copy. */
export function Ltr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span dir="ltr" className={cn("inline-block tabular-nums [unicode-bidi:isolate]", className)}>
      {children}
    </span>
  );
}

export function PersonCell({ name, sub, href }: { name: string | null | undefined; sub?: React.ReactNode; href?: string }) {
  if (!name) return <span className="text-fg-muted">—</span>;
  const content = (
    <span className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
        {name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0])
          .join("")}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{name}</span>
        {sub && <span className="block truncate text-xs text-fg-muted">{sub}</span>}
      </span>
    </span>
  );
  return href ? (
    <Link href={href} className="block min-w-0 rounded-lg hover:text-brand">
      {content}
    </Link>
  ) : (
    content
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-fg-muted">{children}</span>;
}
