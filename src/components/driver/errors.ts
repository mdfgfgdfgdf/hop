/** Maps API errors to short, human Hebrew copy for the driver app. */
import { ApiClientError } from "@/lib/api";

const MESSAGES: Record<string, string> = {
  offer_unavailable: "ההצעה כבר אינה זמינה — ייתכן שפגה או שהנוסע ביטל.",
  not_approved: "החשבון עדיין לא אושר לקבלת נסיעות.",
  location_required: "נדרש מיקום כדי לעבור למצב זמין. אפשרו גישה למיקום ונסו שוב.",
  invalid_transition: "הפעולה אינה אפשרית בשלב הנוכחי של הנסיעה. רעננו את המצב.",
  stale: "מצב הנסיעה השתנה בינתיים. המסך עודכן — נסו שוב אם צריך.",
  rate_limited: "יותר מדי בקשות ברצף. המתינו רגע ונסו שוב.",
  network: "אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.",
  unauthorized: "פג תוקף ההתחברות. התחברו מחדש.",
  cannot_cancel: "לא ניתן לבטל את הנסיעה בשלב הזה. לבעיה — פנו לתמיכה.",
  already_rated: "כבר דירגתם את הנסיעה הזו.",
  bad_file_type: "ניתן להעלות תמונה (JPG / PNG / WebP) או PDF בלבד.",
  file_too_large: "הקובץ גדול מדי — עד 8MB.",
  empty_file: "הקובץ ריק. בחרו קובץ אחר.",
  validation: "חלק מהפרטים אינם תקינים. בדקו את השדות ונסו שוב.",
  internal: "אירעה שגיאה בשרת. נסו שוב בעוד רגע.",
};

/** Codes where the server's own Hebrew message is more specific than ours. */
const PREFER_SERVER = new Set(["driver_busy", "forbidden", "not_found", "bad_date", "no_file", "bad_type"]);

export function errorCode(err: unknown): string | null {
  return err instanceof ApiClientError ? err.code : null;
}

export function errorMessage(err: unknown, fallback = "משהו השתבש. נסו שוב בעוד רגע."): string {
  if (err instanceof ApiClientError) {
    if (PREFER_SERVER.has(err.code) && err.message) return err.message;
    return MESSAGES[err.code] ?? err.message ?? fallback;
  }
  return fallback;
}
