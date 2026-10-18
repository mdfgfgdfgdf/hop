import { FlaskConical } from "lucide-react";
import { cn } from "./cn";

/** Always shown when data is demo/simulated. Never hide demo status. */
export function DemoBanner({ className, compact, text }: { className?: string; compact?: boolean; text?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/15 text-[11px] font-bold text-amber-900 [[data-theme=dark]_&]:text-amber-200",
        compact ? "px-2 py-0.5" : "px-3 py-1",
        className,
      )}
    >
      <FlaskConical size={12} aria-hidden />
      <span>{text ?? "סביבת הדגמה — הנתונים אינם אמיתיים"}</span>
    </div>
  );
}
