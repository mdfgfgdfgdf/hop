/** Hebrew labels shared by all three apps (client-safe). */
import type { RideStatus } from "./types";

export const RIDE_STATUS_HE: Record<RideStatus, string> = {
  requested: "ההזמנה נקלטה",
  searching: "מחפשים נהג",
  offered: "ממתינים לאישור נהג",
  accepted: "הנהג אישר",
  driver_arriving: "הנהג בדרך אליך",
  in_progress: "בנסיעה",
  completed: "הנסיעה הושלמה",
  cancelled: "הנסיעה בוטלה",
};

export const RIDE_STATUS_SHORT_HE: Record<RideStatus, string> = {
  requested: "נקלטה",
  searching: "מחפשים נהג",
  offered: "הוצע",
  accepted: "אושר",
  driver_arriving: "בדרך",
  in_progress: "בנסיעה",
  completed: "הושלמה",
  cancelled: "בוטלה",
};

export const VERIFICATION_STATUS_HE = {
  documents_required: "נדרשים מסמכים",
  under_review: "בבדיקה",
  approved: "מאושר",
  rejected: "נדחה",
  suspended: "מושעה",
} as const;

export const AVAILABILITY_HE = { offline: "לא זמין", online: "זמין", busy: "בנסיעה" } as const;

export const VEHICLE_CLASS_HE = { standard: "רגיל", xl: "גדול (XL)", premium: "פרימיום", accessible: "נגיש" } as const;

export const DOCUMENT_TYPE_HE = {
  id_card: "תעודת זהות",
  drivers_license: "רישיון נהיגה",
  taxi_driver_permit: "היתר להסעת נוסעים בשכר",
  taxi_license_number: "רישיון מונית (מספר ירוק)",
  vehicle_registration: "רישיון רכב",
  insurance: "ביטוח חובה וצד ג' להסעת נוסעים",
  vehicle_photo: "תמונת הרכב",
} as const;

export const DOCUMENT_STATUS_HE = { submitted: "ממתין לבדיקה", approved: "אושר", rejected: "נדחה" } as const;

export const PAYMENT_METHOD_HE = { cash: "מזומן", card_demo: "כרטיס (הדגמה)" } as const;
export const PAYMENT_STATUS_HE = { not_applicable: "ללא חיוב", pending: "ממתין", paid: "שולם", refunded: "הוחזר", partially_refunded: "הוחזר חלקית" } as const;

export const CANCELLED_BY_HE = { rider: "הנוסע", driver: "הנהג", system: "המערכת", admin: "מפעיל" } as const;

export const USER_ROLE_HE = { rider: "נוסע", driver: "נהג", admin: "מנהל", support: "תמיכה" } as const;

export const TICKET_CATEGORY_HE = { complaint: "תלונה", safety: "בטיחות", lost_item: "אבידה", payment: "תשלום", incident: "אירוע", other: "אחר" } as const;
export const TICKET_STATUS_HE = { open: "פתוח", in_progress: "בטיפול", resolved: "נפתר", closed: "סגור" } as const;
export const TICKET_PRIORITY_HE = { low: "נמוכה", normal: "רגילה", high: "גבוהה", urgent: "דחוף" } as const;

export const LEDGER_TYPE_HE = {
  rider_charge: "חיוב נוסע",
  hop_commission: "עמלת HOP",
  driver_payout: "תשלום לנהג",
  cancellation_fee: "דמי ביטול",
  refund: "החזר",
  adjustment: "התאמה",
  processing_fee: "עמלת סליקה",
} as const;

export const CANCEL_REASONS_HE: Record<string, string> = {
  no_drivers_available: "לא נמצא נהג זמין",
};
