# HOP — Design language & UI rules

HOP is a modern, trustworthy Israeli mobility brand. Hebrew-first, RTL, mobile-first.
Think "liquid glass over a live map": blue and white, cool-white backgrounds, floating gray translucent
panels, one confident blue, big tap targets, very few steps to order a ride.

## Brand
| Token | Value | Use |
|---|---|---|
| `--brand` | `#2457FF` | primary actions, route line, accents, logo |
| `--ink` | `#111318` | text, dark surfaces, driver app background |
| `--paper` | `#F4F6FA` | cool-white page background (all three apps) |
| `--mist` | `#C7C9D1` | borders, disabled, secondary icons |
| `--success/--warning/--danger` | green / amber / red | status only |

Logo: `import { Logo, LogoMark } from "@/components/brand/Logo"` (static) or
`import { AnimatedLogo, AnimatedMark } from "@/components/brand/AnimatedLogo"` (living marks: the letters hop,
the needle in the logo acts as a gauge — `mode` idle | loading | moving | success, `hopOn`, `hopKey`).
Use the animated marks wherever state changes (top bars, searching, completion, auth submit). Never redraw the logo.
Tagline: **העיר שלך. הופ אחד.** · **MOVE WITH HOP**

Typography: Heebo (loaded in root layout). Display headings use the `display` class
(800 weight, tight tracking). Body 16px. Numbers use `tabular-nums` (`ltr-nums` class for
mixed LTR numerals inside RTL copy, e.g. plates, phone numbers, prices).

## Surfaces — gray liquid glass
The `.glass` recipe has four layers: a neutral gray translucent fill with strong backdrop blur/saturation and
inner gray depth; a specular highlight (`::before`) that follows the pointer via `--gx/--gy` (set globally by
`GlassLight`); a bevelled rim (`::after`, bright top-left to gray bottom-right); content on top.

- `glass` — translucent panel with blur + specular highlight (`glass-strong` for more opacity,
  `glass-md`/`glass-sm`/`glass-pill` for smaller radii, `glass-brand` for a blue glass).
- Use glass for **floating** panels over the map (bottom sheets, offer cards, status chips,
  top bars). Use `card` for content sitting on paper (lists, forms, admin tables).
- Never stack glass on glass more than two levels. Keep text contrast ≥ 4.5:1 (add `glass-strong`
  when the map is busy underneath).
- All three apps use the light theme (`data-theme="light"`): blue and white, gray liquid glass. Dark tokens remain only for future use.
  Tokens switch automatically; always use token colours (`bg-bg`, `text-fg`, `text-fg-muted`,
  `bg-surface`, `border-line`) rather than hard-coded greys so both themes work.

## Components (`@/components/ui`)
`Button` (variants: primary · glass · ink · ghost · danger · success; sizes sm · md · lg · icon;
`loading`, `block`), `Glass`, `Sheet` (bottom sheet on mobile, side panel ≥ lg), `Field`/`Input`/
`Textarea`/`Select`, `Pill` (tones brand · ink · success · warning · danger · muted), `Spinner`,
`DemoBanner`, `EmptyState`, `Avatar`, `Stat`, `Segmented`, `Toggle`, `Skeleton`, `StarRating`,
`useToast()`. Icons: `lucide-react` (stroke 2, 18–22px). Motion: `motion/react` for sheet /
list / status transitions (spring, 300–450ms) — keep it subtle; respect reduced motion.

Map: `import { MapView } from "@/components/map"` (client-only). Props: `center`, `zoom`,
`markers` (`kind: pickup | dropoff | driver | me | poi`, `heading`), `polyline` ([lat,lng][]),
`fit` (points to fit), `fitPadding`, `onMoveEnd`, `onMoveStart`, `theme`. Children render on top
(use for the centre pin / overlays). It degrades to an offline flat canvas when tiles are
unavailable — the UI must still make sense without tiles.

## Layout rules
- Root is `<html lang="he" dir="rtl">`. Use logical properties (`ps-`, `pe-`, `ms-`, `me-`,
  `start`/`end`, `inset-inline-start`) — never `left/right` for RTL-sensitive layout.
  Arrows that mean "forward/continue" point **left** (`ArrowLeft`) in RTL.
- Mobile-first: design for 390×844, then tablet (768) and desktop (≥1024). On desktop the
  map pages keep the map full-bleed with the sheet as a side panel (`Sheet` does this).
- Primary action is always one big pill button at the bottom (52–60px tall), thumb-reachable,
  with `safe-bottom` padding. Secondary actions are glass/ghost.
- Accessibility: every interactive element has an accessible name; focus-visible rings are
  provided globally; status changes use `role="status"`/`aria-live`. Minimum tap target 44px.
- Loading: skeletons for content, `Button loading` for actions, never a blank screen.
- Errors: inline, in Hebrew, human (what happened + what to do). Use `useToast()` for
  transient confirmations.

## Honesty rules (product, not just design)
- Demo data is always labelled (`DemoBanner`, "תעריף הדגמה"). Never show demo numbers as real.
- Show the price **before** ordering; show the driver's net payout and HOP's commission separately.
- No guaranteed-earnings claims. Only server-computed amounts are displayed (`FareBreakdown`).
- Unapproved service types are shown as disabled with the reason, never hidden as "coming soon".

## Copy (Hebrew)
Short, warm, direct. Second person plural/neutral where possible ("בחרו יעד", "מחפשים נהג…").
Status labels come from `@/lib/labels` (`RIDE_STATUS_HE` etc.). Money via `formatILS` from
`@/lib/format` (agorot → ₪). Distances/durations via `formatDistance` / `formatDuration` / `formatEta`.
