"use client";
/** Expressive, context-aware micro-copy for the driver app (Hebrew, neutral). */
import { useNow } from "./hooks";

export function firstName(name: string | null | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

function jerusalemHour(ms: number) {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jerusalem" }).format(ms));
}

export function greetingFor(ms: number) {
  if (!ms) return "שלום";
  const h = jerusalemHour(ms);
  if (h >= 5 && h < 12) return "בוקר טוב";
  if (h >= 12 && h < 17) return "צהריים טובים";
  if (h >= 17 && h < 21) return "ערב טוב";
  return "לילה טוב";
}

/** "ערב טוב, דני" — re-evaluated every minute. */
export function useGreeting(name: string | null | undefined) {
  const now = useNow(60_000);
  const g = greetingFor(now);
  const n = firstName(name);
  return n ? `${g}, ${n}` : g;
}

export const WAITING_LINES = [
  "מחפשים לך נסיעה באזור — נעדכן מיד",
  "ההצעה הבאה תופיע כאן, עם התשלום המדויק שלך",
  "המיקום שלך מתעדכן אוטומטית כל כמה שניות",
  "אפשר לעבור למצב לא זמין בכל רגע",
];

export const OFFLINE_LINES = ["הפעילו זמינות — ההצעות יגיעו ישר לכאן", "רואים את התשלום נטו לפני שמאשרים כל נסיעה"];
