/**
 * Light-theme semantic colour classes for the driver app.
 *
 * The status tokens (--danger, --success, --warning) are tuned for fills and
 * icons; as small text on white or gray glass some of them fall under 4.5:1.
 * These mixes darken them towards ink so text stays legible, and the chip
 * tones give every icon badge the same soft-tint-plus-strong-icon look as the
 * rider app (bg-brand-100 + text-brand).
 */
export const TEXT = {
  danger: "text-[color-mix(in_oklab,var(--danger)_66%,var(--ink))]",
  success: "text-[color-mix(in_oklab,var(--success)_64%,var(--ink))]",
  warning: "text-[color-mix(in_oklab,var(--warning)_42%,var(--ink))]",
  brand: "text-brand-700",
  /** Secondary text on glass over busy backgrounds (fg-muted can dip under 4.5:1 there). */
  muted: "text-[color-mix(in_oklab,var(--fg-muted)_78%,var(--ink))]",
} as const;

/** Shared `.field-error` text is --danger (≈3.9:1 on white); deepen it inside driver pages. */
export const FIELD_ERROR_FIX = "[&_.field-error]:text-[color-mix(in_oklab,var(--danger)_66%,var(--ink))]";

/**
 * Status fills deep enough for white button text (≥ 4.5:1). The shared
 * .btn-success / .btn-danger fills are ~3.3:1 and ~3.9:1 with white.
 */
export const FILL = {
  success: "bg-[color-mix(in_oklab,var(--success)_75%,var(--ink))]! shadow-[0_14px_30px_-14px_rgba(23,163,90,0.7),inset_0_1px_0_rgba(255,255,255,0.25)]!",
  danger: "bg-[color-mix(in_oklab,var(--danger)_86%,var(--ink))]! shadow-[0_14px_30px_-14px_rgba(229,72,77,0.7),inset_0_1px_0_rgba(255,255,255,0.2)]!",
} as const;

/**
 * Blue liquid glass for brand panels that carry small white text. Same recipe
 * as .glass-brand (rim, depth, pointer light) with a slightly deeper blue and a
 * softer specular so 12–14px white text keeps ≥ 4.5:1 at the bright top edge.
 */
export const BRAND_GLASS = "glass glass-brand bg-[linear-gradient(160deg,rgba(45,92,255,0.96),rgba(26,66,214,0.97))] [--glass-spec:rgba(255,255,255,0.16)]";

export const CHIP = {
  brand: "bg-brand-100 text-brand",
  danger: "bg-danger/10 text-[color-mix(in_oklab,var(--danger)_80%,var(--ink))]",
  warning: "bg-warning/18 text-[color-mix(in_oklab,var(--warning)_50%,var(--ink))]",
  success: "bg-success/12 text-[color-mix(in_oklab,var(--success)_75%,var(--ink))]",
  neutral: "bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] text-fg",
} as const;

/** A frosted white cell that sits inside a glass panel (sheet, dialog, offer card). */
export const TILE = "rounded-2xl bg-surface/70 ring-1 ring-line";
/** A quiet cell that sits inside a white card on paper. */
export const WELL = "rounded-2xl bg-bg ring-1 ring-line";
