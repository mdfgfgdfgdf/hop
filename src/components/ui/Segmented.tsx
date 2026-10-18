"use client";
import { cn } from "./cn";

export function Segmented<T extends string>({ value, onChange, options, className, size = "md", tone = "neutral" }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string; size?: "sm" | "md"; tone?: "neutral" | "brand" }) {
  return (
    <div role="tablist" className={cn("inline-flex rounded-full bg-[color-mix(in_oklab,var(--fg)_8%,transparent)] p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full font-bold transition-all",
            size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
            o.value === value
              ? tone === "brand"
                ? "bg-brand text-white shadow-[0_6px_16px_-8px_rgba(36,87,255,.8)]"
                : "bg-surface text-fg shadow-[0_2px_10px_-4px_rgba(17,19,24,.4)]"
              : "text-fg-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
