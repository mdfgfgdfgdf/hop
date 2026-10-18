import { cn } from "@/components/ui/cn";

/** Israeli licence plate (yellow, LTR, blue IL strip). */
export function PlateChip({ plate, size = "lg", className }: { plate: string; size?: "md" | "lg"; className?: string }) {
  return (
    <span
      dir="ltr"
      className={cn("inline-flex shrink-0 items-stretch overflow-hidden rounded-lg border-2 border-ink shadow-[0_6px_14px_-8px_rgba(17,19,24,.6)]", className)}
      aria-label={`מספר רישוי ${plate}`}
      role="img"
    >
      <span className="flex w-5 flex-col items-center justify-center bg-brand text-[8px] leading-none font-black text-white" aria-hidden>
        IL
      </span>
      <span
        className={cn("bg-[#FFD21F] font-black tracking-[0.06em] text-ink tabular-nums", size === "lg" ? "px-2.5 py-1 text-lg" : "px-2 py-0.5 text-sm")}
        aria-hidden
      >
        {plate}
      </span>
    </span>
  );
}
