/** Rider-facing labels for ride timeline events. */
export const RIDE_EVENT_HE: Record<string, string> = {
  requested: "ההזמנה נקלטה",
  searching: "התחלנו לחפש נהג",
  offered: "הבקשה נשלחה לנהג קרוב",
  offer_declined: "הנהג לא היה זמין — המשכנו לחפש",
  offer_expired: "לא התקבלה תשובה — המשכנו לחפש",
  accepted: "הנהג אישר את הנסיעה",
  driver_arriving: "הנהג יצא לדרך אליכם",
  driver_arrived: "הנהג הגיע לנקודת האיסוף",
  started: "הנסיעה התחילה",
  completed: "הנסיעה הושלמה",
  cancelled: "הנסיעה בוטלה",
  driver_cancelled: "הנהג ביטל — חיפשנו נהג חדש",
  rated: "הדירוג נשמר",
  adjusted: "בוצעה התאמה בחיוב",
  refunded: "בוצע החזר",
};

export function eventLabel(type: string) {
  return RIDE_EVENT_HE[type] ?? type.replace(/_/g, " ");
}
