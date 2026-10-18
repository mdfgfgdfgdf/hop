import type { RideStatus } from "../db/schema";
import { conflict } from "../errors";

export const RIDE_TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  requested: ["searching", "cancelled"],
  searching: ["offered", "cancelled"],
  offered: ["accepted", "searching", "cancelled"],
  accepted: ["driver_arriving", "in_progress", "searching", "cancelled"],
  driver_arriving: ["in_progress", "searching", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const ACTIVE_STATUSES: readonly RideStatus[] = [
  "requested",
  "searching",
  "offered",
  "accepted",
  "driver_arriving",
  "in_progress",
];

export const DRIVER_BUSY_STATUSES: readonly RideStatus[] = ["accepted", "driver_arriving", "in_progress"];
export const TERMINAL_STATUSES: readonly RideStatus[] = ["completed", "cancelled"];

export function canTransition(from: RideStatus, to: RideStatus) {
  return RIDE_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: RideStatus, to: RideStatus) {
  if (!canTransition(from, to)) {
    throw conflict("invalid_transition", `לא ניתן לעבור ממצב ${from} למצב ${to}`, { from, to });
  }
}

export const RIDE_STATUS_HE: Record<RideStatus, string> = {
  requested: "נקלטה",
  searching: "מחפשים נהג",
  offered: "הוצע לנהג",
  accepted: "נהג אישר",
  driver_arriving: "הנהג בדרך",
  in_progress: "בנסיעה",
  completed: "הושלמה",
  cancelled: "בוטלה",
};
