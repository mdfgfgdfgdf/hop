/** Israel-local calendar helpers (the platform operates in Asia/Jerusalem). */
export const IL_TZ = "Asia/Jerusalem";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: IL_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD of the given instant in Israel local time. */
export function dayKeyIL(d: Date): string {
  return dayFmt.format(d);
}

/** The instant at which the Israel-local calendar day containing `d` starts. */
export function startOfDayIL(d: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: IL_TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const localMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const offsetMs = localMs - d.getTime(); // tz offset at this instant
  const localMidnight = Date.UTC(get("year"), get("month") - 1, get("day"));
  return new Date(localMidnight - offsetMs);
}
