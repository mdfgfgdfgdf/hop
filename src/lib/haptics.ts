/** Tiny haptics helper — no-op where the Vibration API is unavailable. */
export function haptic(kind: "tap" | "success" | "warning" | "offer" = "tap") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  const pattern = kind === "tap" ? [12] : kind === "success" ? [18, 40, 18] : kind === "warning" ? [40, 60, 40] : [60, 80, 60, 80, 120];
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}
