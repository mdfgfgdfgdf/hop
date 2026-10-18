import { cn } from "@/components/ui/cn";

type Point = { label?: string; address: string };

/** Pickup → dropoff with the brand dot/square markers and a connecting line. */
export function RouteSummary({
  pickup,
  dropoff,
  className,
  pickupAction,
  dropoffAction,
  dense,
  compact,
}: {
  pickup: Point;
  dropoff: Point;
  className?: string;
  pickupAction?: React.ReactNode;
  dropoffAction?: React.ReactNode;
  dense?: boolean;
  /** One line per point, labels visually hidden. */
  compact?: boolean;
}) {
  return (
    <ol className={cn("relative", className)} aria-label="מסלול">
      <span className="absolute start-[7px] top-[18px] bottom-[18px] w-0.5 rounded-full bg-[color-mix(in_oklab,var(--fg)_14%,transparent)]" aria-hidden />
      <RouteRow kind="pickup" point={pickup} action={pickupAction} dense={dense} compact={compact} />
      <RouteRow kind="dropoff" point={dropoff} action={dropoffAction} dense={dense} compact={compact} />
    </ol>
  );
}

function RouteRow({ kind, point, action, dense, compact }: { kind: "pickup" | "dropoff"; point: Point; action?: React.ReactNode; dense?: boolean; compact?: boolean }) {
  if (compact) {
    return (
      <li className="relative flex min-h-10 items-center gap-3">
        <span
          className={cn("relative z-[1] h-4 w-4 shrink-0 border-[3px] border-surface shadow-[0_0_0_1px_var(--line-strong)]", kind === "pickup" ? "rounded-full bg-brand" : "rounded-[5px] bg-ink")}
          aria-hidden
        />
        <span className="sr-only">{point.label ?? (kind === "pickup" ? "איסוף" : "יעד")}: </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{point.address}</span>
        {action}
      </li>
    );
  }
  return (
    <li className={cn("relative flex items-center gap-3", dense ? "py-1" : "py-1.5")}>
      <span
        className={cn("relative z-[1] h-4 w-4 shrink-0 border-[3px] border-surface shadow-[0_0_0_1px_var(--line-strong)]", kind === "pickup" ? "rounded-full bg-brand" : "rounded-[5px] bg-ink")}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-fg-muted">{point.label ?? (kind === "pickup" ? "איסוף" : "יעד")}</div>
        <div className={cn("truncate font-semibold", dense ? "text-sm" : "text-[15px]")}>{point.address}</div>
      </div>
      {action}
    </li>
  );
}
