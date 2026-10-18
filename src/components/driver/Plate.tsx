/** Israeli-style licence plate badge (yellow, IL strip — the real plate colours). */
import { cn } from "@/components/ui";

export function Plate({ plate, className, size = "md" }: { plate: string; className?: string; size?: "sm" | "md" }) {
  return (
    <span dir="ltr" aria-label={`מספר רישוי ${plate}`} className={cn("inline-flex shrink-0 items-stretch overflow-hidden rounded-md border border-ink/35 bg-[#f6c90e] font-extrabold text-ink shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_2px_6px_-2px_rgba(17,19,24,0.35)]", size === "sm" ? "h-6 text-xs" : "h-8 text-sm", className)}>
      <span className="grid place-items-center bg-[#0038b8] px-1 text-[8px] font-bold leading-none text-white">IL</span>
      <span className="grid place-items-center px-2 tracking-wider tabular-nums">{plate}</span>
    </span>
  );
}
