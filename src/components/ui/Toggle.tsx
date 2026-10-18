"use client";
import { cn } from "./cn";

export function Toggle({ checked, onChange, label, disabled, size = "md" }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean; size?: "md" | "lg" }) {
  const w = size === "lg" ? 72 : 52;
  const h = size === "lg" ? 40 : 30;
  const knob = h - 6;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative shrink-0 rounded-full transition-colors disabled:opacity-50", checked ? "bg-success" : "bg-[color-mix(in_oklab,var(--fg)_20%,transparent)]")}
      style={{ width: w, height: h }}
    >
      <span
        className="absolute top-[3px] rounded-full bg-white shadow-md transition-all"
        style={{ width: knob, height: knob, insetInlineStart: checked ? w - knob - 3 : 3 }}
      />
    </button>
  );
}
