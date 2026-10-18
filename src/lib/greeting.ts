/** Time-of-day greeting in Israel time (client-safe). */
export function greeting(name?: string | null, at: Date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hour12: false }).format(at)) % 24;
  const word = hour < 5 ? "לילה טוב" : hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : hour < 21 ? "ערב טוב" : "לילה טוב";
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${word}, ${first}` : word;
}
