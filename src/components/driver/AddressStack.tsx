/** Pickup → dropoff addresses with the brand pin / square markers. */
import { cn } from "@/components/ui";

export function AddressStack({
  pickup,
  dropoff,
  className,
  emphasis,
  pickupHint,
  dropoffHint,
}: {
  pickup: string;
  dropoff: string;
  className?: string;
  emphasis?: "pickup" | "dropoff";
  pickupHint?: React.ReactNode;
  dropoffHint?: React.ReactNode;
}) {
  return (
    <ol className={cn("relative grid gap-3", className)} aria-label="מסלול">
      <span aria-hidden className="absolute start-[7px] top-[18px] bottom-[18px] w-0.5 rounded-full bg-[color-mix(in_oklab,var(--fg)_18%,transparent)]" />
      <li className="relative flex items-start gap-3">
        <span aria-hidden className="mt-1 h-4 w-4 shrink-0 rounded-full border-[3px] border-white bg-brand shadow-[0_0_0_3px_rgba(36,87,255,0.25)]" />
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-fg-muted">איסוף</div>
          <div className={cn("leading-snug", emphasis === "pickup" ? "text-lg font-extrabold" : "font-semibold")}>{pickup}</div>
          {pickupHint && <div className="mt-0.5 text-xs text-fg-muted">{pickupHint}</div>}
        </div>
      </li>
      <li className="relative flex items-start gap-3">
        <span aria-hidden className="mt-1 h-4 w-4 shrink-0 rounded-[5px] border-[3px] border-white bg-ink shadow-[0_0_0_3px_rgba(255,255,255,0.12)]" />
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-fg-muted">יעד</div>
          <div className={cn("leading-snug", emphasis === "dropoff" ? "text-lg font-extrabold" : "font-semibold")}>{dropoff}</div>
          {dropoffHint && <div className="mt-0.5 text-xs text-fg-muted">{dropoffHint}</div>}
        </div>
      </li>
    </ol>
  );
}
