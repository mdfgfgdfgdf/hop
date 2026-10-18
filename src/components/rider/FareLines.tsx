import { formatILS } from "@/lib/format";
import type { FareBreakdown } from "@/lib/types";
import { cn } from "@/components/ui/cn";

/** Server-computed fare lines + transparent split (driver vs HOP). */
export function FareLines({ fare, total, className, showSplit = true }: { fare: FareBreakdown; total?: number; className?: string; showSplit?: boolean }) {
  const sum = total ?? fare.riderTotalAgorot;
  return (
    <div className={cn("text-sm", className)}>
      <dl className="space-y-1.5">
        {fare.lines.map((l) => (
          <div key={l.key} className="flex items-baseline justify-between gap-3">
            <dt className="text-fg-muted">{l.label}</dt>
            <dd className={cn("font-semibold ltr-nums", l.amountAgorot < 0 && "text-success")}>{formatILS(l.amountAgorot)}</dd>
          </div>
        ))}
        {fare.discountAgorot > 0 && !fare.lines.some((l) => l.amountAgorot < 0) && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-fg-muted">הנחה</dt>
            <dd className="font-semibold text-success ltr-nums">{formatILS(-fare.discountAgorot)}</dd>
          </div>
        )}
      </dl>
      <div className="divider my-2.5" />
      <div className="flex items-baseline justify-between gap-3 text-base">
        <span className="font-bold">סה״כ</span>
        <span className="font-extrabold ltr-nums">{formatILS(sum)}</span>
      </div>
      {showSplit && (
        <p className="mt-2 rounded-xl bg-[color-mix(in_oklab,var(--fg)_5%,transparent)] px-3 py-2 text-xs text-fg-muted">
          מתוך הסכום: הנהג מקבל <b className="text-fg ltr-nums">{formatILS(fare.driverPayoutAgorot)}</b> · עמלת HOP{" "}
          <b className="text-fg ltr-nums">{formatILS(fare.hopCommissionAgorot)}</b>
        </p>
      )}
    </div>
  );
}
