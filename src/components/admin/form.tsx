"use client";
/** Small form helpers shared by pricing & settings. */
import { useId } from "react";
import { cn } from "@/components/ui";

export function UnitField({
  label,
  value,
  onChange,
  unit,
  hint,
  error,
  disabled,
  inputMode = "decimal",
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  hint?: React.ReactNode;
  error?: string | null;
  disabled?: boolean;
  inputMode?: "decimal" | "numeric" | "text";
  type?: "text" | "time";
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("field", className)}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          dir="ltr"
          inputMode={type === "time" ? undefined : inputMode}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-d` : undefined}
          className={cn("input h-11 bg-surface text-right tabular-nums disabled:cursor-not-allowed disabled:opacity-60", unit && "pl-16")}
        />
        {/* Input is LTR (numbers), so pad/position physically: unit sits on the left (RTL "end"). */}
        {unit && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-semibold text-fg-muted">{unit}</span>}
      </div>
      {error ? (
        <div id={`${id}-d`} className="field-error" role="alert">
          {error}
        </div>
      ) : hint ? (
        <div id={`${id}-d`} className="text-xs text-fg-muted">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function FormSection({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={cn("border-t border-line px-4 py-5 first:border-t-0 sm:px-5", className)}>
      <legend className="sr-only">{title}</legend>
      <div className="mb-4">
        <div className="text-[15px] font-bold" aria-hidden>
          {title}
        </div>
        {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
      </div>
      {children}
    </fieldset>
  );
}

/** Parses "12.5" / "12,5" → number, or NaN. */
export function parseNum(v: string) {
  const t = v.trim().replace(",", ".");
  if (t === "") return NaN;
  return Number(t);
}
