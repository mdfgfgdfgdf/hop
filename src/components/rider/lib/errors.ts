/** Maps API errors to short, human Hebrew copy (what happened + what to do). */
import { ApiClientError } from "@/lib/api";

export type FriendlyError = { code: string; title: string; message: string };

const COPY: Record<string, { title: string; message: string }> = {
  network: { title: "אין חיבור לשרת", message: "בדקו את החיבור לאינטרנט ונסו שוב." },
  outside_service_area: {
    title: "HOP עדיין לא פועלת כאן",
    message: "כרגע אנחנו פועלים בגוש דן בלבד. בחרו נקודת איסוף בתל אביב והסביבה.",
  },
  quote_expired: { title: "הצעת המחיר פגה", message: "רעננו את המחיר ואשרו שוב — זה לוקח שנייה." },
  quote_used: { title: "הצעת המחיר כבר נוצלה", message: "ביקשנו עבורכם מחיר עדכני, בדקו ואשרו שוב." },
  ride_active: { title: "כבר יש לכם נסיעה פעילה", message: "העברנו אתכם לנסיעה הפעילה." },
  rate_limited: { title: "יותר מדי ניסיונות", message: "המתינו רגע ונסו שוב." },
  same_point: { title: "האיסוף והיעד קרובים מדי", message: "בחרו יעד רחוק יותר מנקודת האיסוף." },
  invalid_promo: { title: "קוד הקופון אינו תקף", message: "בדקו את הקוד ונסו שוב." },
  no_services: { title: "אין כרגע שירותים פעילים", message: "נסו שוב בעוד כמה דקות." },
  service_unavailable: { title: "השירות שבחרתם אינו זמין", message: "בחרו סוג נסיעה אחר." },
  cannot_cancel: { title: "לא ניתן לבטל", message: "הנסיעה כבר החלה או הסתיימה. לעזרה פנו לתמיכה." },
  already_rated: { title: "כבר דירגתם נסיעה זו", message: "תודה! הדירוג שלכם נשמר." },
  validation: { title: "חלק מהפרטים אינם תקינים", message: "בדקו את השדות ונסו שוב." },
  unauthorized: { title: "נדרשת התחברות מחדש", message: "התחברו שוב כדי להמשיך." },
  forbidden: { title: "אין הרשאה", message: "אין לכם הרשאה לפעולה זו." },
  not_found: { title: "לא מצאנו את מה שחיפשתם", message: "ייתכן שהפריט הוסר. חזרו לדף הקודם." },
  internal: { title: "משהו השתבש אצלנו", message: "נסו שוב בעוד רגע." },
};

export function describeError(err: unknown): FriendlyError {
  if (err instanceof ApiClientError) {
    const copy = COPY[err.code];
    if (copy) return { code: err.code, ...copy };
    return { code: err.code, title: "הפעולה לא הושלמה", message: err.message || "נסו שוב בעוד רגע." };
  }
  return { code: "unknown", title: "משהו השתבש", message: "נסו שוב בעוד רגע." };
}

export function errorCode(err: unknown) {
  return err instanceof ApiClientError ? err.code : "unknown";
}

export function isAbort(err: unknown) {
  return err instanceof DOMException ? err.name === "AbortError" : (err as Error | null)?.name === "AbortError";
}
