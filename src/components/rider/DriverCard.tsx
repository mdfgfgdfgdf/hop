import { Star } from "lucide-react";
import { Avatar } from "@/components/ui";
import type { RideCounterpartDTO } from "@/lib/types";
import { PlateChip } from "./PlateChip";

export function vehicleLine(d: RideCounterpartDTO) {
  const v = d.vehicle;
  if (!v) return null;
  // Non-breaking hyphens keep model names like "E-Class" on one line.
  return [[v.make, v.model].filter(Boolean).join(" "), v.color].filter(Boolean).join(" · ").replace(/-/g, "\u2011") || null;
}

export function RatingBadge({ rating, count }: { rating: number | null; count: number }) {
  if (rating == null) return <span className="text-xs font-semibold text-fg-muted">נהג חדש</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-bold" aria-label={`דירוג ${rating} מתוך 5, ${count} דירוגים`}>
      <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden />
      <span className="tabular-nums">{rating.toFixed(1)}</span>
      <span className="text-xs font-semibold text-fg-muted tabular-nums">({count})</span>
    </span>
  );
}

/** Driver + vehicle summary with the big plate chip. */
export function DriverCard({ driver, compact }: { driver: RideCounterpartDTO; compact?: boolean }) {
  const vehicle = vehicleLine(driver);
  return (
    <div className="flex items-center gap-3" data-testid="driver-card">
      <Avatar name={driver.name} size={compact ? 44 : 54} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-base font-extrabold">{driver.name}</span>
          <RatingBadge rating={driver.rating} count={driver.ratingCount} />
        </div>
        {vehicle && <div className="line-clamp-2 text-sm leading-snug text-fg-muted">{vehicle}</div>}
      </div>
      {driver.vehicle?.plate && <PlateChip plate={driver.vehicle.plate} size={compact ? "md" : "lg"} className="self-center" />}
    </div>
  );
}
