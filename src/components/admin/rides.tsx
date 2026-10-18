"use client";
/** Shared ride table columns + small ride renderers used across screens. */
import { formatDateTime, formatILS, formatRelative } from "@/lib/format";
import type { RideDTO } from "@/lib/types";
import { FlagsCountPill, RideStatusPill } from "./pills";
import { type Column, Muted, PersonCell } from "./ui";
import { shortId } from "./hooks";

export function RouteCell({ ride, compact }: { ride: Pick<RideDTO, "pickup" | "dropoff">; compact?: boolean }) {
  return (
    <div className={compact ? "min-w-0 max-w-[200px] xl:max-w-[280px]" : "min-w-0 max-w-[320px]"}>
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-brand" />
        <span className="truncate" title={ride.pickup.address}>
          {ride.pickup.address}
        </span>
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-2 text-fg-muted">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-[3px] bg-ink" />
        <span className="truncate" title={ride.dropoff.address}>
          <span className="sr-only">אל </span>
          {ride.dropoff.address}
        </span>
      </div>
    </div>
  );
}

export function RidePrice({ ride }: { ride: RideDTO }) {
  if (ride.status === "cancelled") {
    return ride.cancellationFeeAgorot > 0 ? (
      <span className="tabular-nums">
        {formatILS(ride.cancellationFeeAgorot)} <span className="text-xs text-fg-muted">דמי ביטול</span>
      </span>
    ) : (
      <Muted>—</Muted>
    );
  }
  if (ride.finalTotalAgorot != null) {
    return (
      <span className="font-semibold tabular-nums">
        {formatILS(ride.finalTotalAgorot)}
        {ride.refundedAgorot > 0 && <span className="block text-xs font-normal text-danger">הוחזרו {formatILS(ride.refundedAgorot)}</span>}
      </span>
    );
  }
  return (
    <span className="tabular-nums">
      {formatILS(ride.quotedTotalAgorot)} <span className="text-xs text-fg-muted">הצעת מחיר</span>
    </span>
  );
}

export function rideColumns(opts: { flags?: boolean; service?: boolean; hideRider?: boolean; hideDriver?: boolean } = {}): Column<RideDTO>[] {
  const cols: Column<RideDTO>[] = [
    {
      key: "time",
      header: "זמן",
      card: "title",
      cell: (r) => (
        <div className="whitespace-nowrap">
          <div className="font-semibold tabular-nums">{formatDateTime(r.requestedAt)}</div>
          <div className="text-xs text-fg-muted">
            {formatRelative(r.requestedAt)} · <span className="tabular-nums">#{shortId(r.id)}</span>
          </div>
        </div>
      ),
    },
  ];
  if (!opts.hideRider) cols.push({ key: "rider", header: "נוסע", cell: (r) => <PersonCell name={r.rider?.name} /> });
  if (!opts.hideDriver) cols.push({ key: "driver", header: "נהג", cell: (r) => (r.driver ? <PersonCell name={r.driver.name} sub={r.driver.vehicle?.plate ? <bdi className="tabular-nums">{r.driver.vehicle.plate}</bdi> : undefined} /> : <Muted>טרם שובץ</Muted>) });
  cols.push({ key: "route", header: "מסלול", cardLabel: "מסלול", cardWide: true, cell: (r) => <RouteCell ride={r} compact /> });
  if (opts.service) cols.push({ key: "service", header: "שירות", hideBelow: "xl", cell: (r) => <span className="whitespace-nowrap">{r.serviceType.nameHe}</span> });
  cols.push({ key: "status", header: "סטטוס", card: "badge", cell: (r) => <RideStatusPill status={r.status} /> });
  cols.push({ key: "price", header: "מחיר", align: "end", cell: (r) => <RidePrice ride={r} /> });
  if (opts.flags) cols.push({ key: "flags", header: "דגלים", align: "end", cardLabel: "דגלים", hideBelow: "xl", cell: (r) => <FlagsCountPill flags={r.flags} /> });
  return cols;
}
