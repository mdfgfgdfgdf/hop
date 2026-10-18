/** Formatting helpers (client-safe). */
export { formatILS } from "./money";

export function formatDistance(m: number | null | undefined) {
  if (m == null) return "—";
  if (m < 1000) return `${Math.round(m)} מ'`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} ק"מ`;
}

export function formatDuration(s: number | null | undefined) {
  if (s == null) return "—";
  const min = Math.round(s / 60);
  if (min < 1) return "פחות מדקה";
  if (min < 60) return `${min} דק'`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} ש' ${rest} דק'` : `${h} ש'`;
}

export function formatEta(s: number | null | undefined) {
  if (s == null) return "—";
  const min = Math.max(1, Math.round(s / 60));
  return `${min} דק'`;
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(iso));
}

export function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("he-IL", { timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeZone: "Asia/Jerusalem" }).format(new Date(iso));
}

export function formatRelative(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("he", { numeric: "auto" });
  if (Math.abs(diff) < 60) return rtf.format(-Math.round(diff), "second");
  if (Math.abs(diff) < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (Math.abs(diff) < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  return rtf.format(-Math.round(diff / 86400), "day");
}

export function percentFromBp(bp: number) {
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 1)}%`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}
