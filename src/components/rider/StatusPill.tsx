import { Pill } from "@/components/ui";
import { RIDE_STATUS_SHORT_HE } from "@/lib/labels";
import type { RideStatus } from "@/lib/types";

const TONE: Record<RideStatus, "brand" | "success" | "danger" | "muted" | "warning"> = {
  requested: "brand",
  searching: "brand",
  offered: "brand",
  accepted: "brand",
  driver_arriving: "brand",
  in_progress: "brand",
  completed: "success",
  cancelled: "muted",
};

export function StatusPill({ status }: { status: RideStatus }) {
  return <Pill tone={TONE[status]}>{RIDE_STATUS_SHORT_HE[status]}</Pill>;
}
