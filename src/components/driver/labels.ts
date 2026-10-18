/** Driver-app specific Hebrew copy (shared labels live in @/lib/labels). */
import type { RideDTO } from "@/lib/types";

export const RIDE_EVENT_HE: Record<string, string> = {
  requested: "הנוסע הזמין נסיעה",
  searching: "חיפוש נהג",
  offered: "הנסיעה הוצעה לנהג",
  offer_declined: "ההצעה נדחתה",
  offer_expired: "ההצעה פגה",
  accepted: "קיבלתם את הנסיעה",
  driver_arriving: "יצאתם לדרך לאיסוף",
  driver_arrived: "הגעתם לנקודת האיסוף",
  started: "הנסיעה התחילה",
  completed: "הנסיעה הושלמה",
  cancelled: "הנסיעה בוטלה",
  driver_cancelled: "הנהג ביטל והנסיעה חזרה לתור",
  rated: "דירוג",
  adjusted: "התאמה ע״י מפעיל",
};

export const DRIVER_CANCEL_REASONS = [
  { id: "rider_no_show", label: "הנוסע לא הגיע לנקודת האיסוף" },
  { id: "rider_asked", label: "הנוסע ביקש לבטל" },
  { id: "vehicle_issue", label: "תקלה ברכב" },
  { id: "wrong_pickup", label: "נקודת האיסוף אינה נגישה" },
  { id: "safety", label: "חשש לבטיחות" },
  { id: "other", label: "סיבה אחרת" },
] as const;

/** Phase of an active ride from the driver's point of view. */
export type RidePhase = "to_pickup_pending" | "to_pickup" | "at_pickup" | "on_trip";

export function ridePhase(ride: Pick<RideDTO, "status" | "arrivedAt">): RidePhase | null {
  if (ride.status === "accepted") return "to_pickup_pending";
  if (ride.status === "driver_arriving") return ride.arrivedAt ? "at_pickup" : "to_pickup";
  if (ride.status === "in_progress") return "on_trip";
  return null;
}

export const PHASE_TITLE_HE: Record<RidePhase, string> = {
  to_pickup_pending: "נסיעה חדשה — יוצאים לאיסוף",
  to_pickup: "בדרך לאיסוף",
  at_pickup: "הגעתם — ממתינים לנוסע",
  on_trip: "בנסיעה ליעד",
};

export const PHASE_SHORT_HE: Record<RidePhase, string> = {
  to_pickup_pending: "נסיעה חדשה",
  to_pickup: "בדרך לאיסוף",
  at_pickup: "בנקודת האיסוף",
  on_trip: "בנסיעה ליעד",
};

export const PHASE_ACTION_HE: Record<RidePhase, string> = {
  to_pickup_pending: "יוצא לדרך",
  to_pickup: "הגעתי לנוסע",
  at_pickup: "התחלת נסיעה",
  on_trip: "סיום נסיעה",
};

/** The driver's payout for a ride: final when completed, otherwise the quoted/offered one. */
export function payoutOf(ride: Pick<RideDTO, "driverPayoutAgorot" | "offer" | "quotedFare">) {
  return ride.driverPayoutAgorot ?? ride.offer?.driverPayoutAgorot ?? ride.quotedFare.driverPayoutAgorot;
}
export function riderTotalOf(ride: Pick<RideDTO, "finalTotalAgorot" | "quotedTotalAgorot">) {
  return ride.finalTotalAgorot ?? ride.quotedTotalAgorot;
}
export function commissionOf(ride: Pick<RideDTO, "commissionAgorot" | "quotedFare" | "finalFare">) {
  return ride.commissionAgorot ?? (ride.finalFare ?? ride.quotedFare).hopCommissionAgorot;
}
