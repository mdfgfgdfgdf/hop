# HOP — העיר שלך. הופ אחד.

<p align="center"><img src="public/logo.svg" alt="HOP" height="72"></p>

**HOP** היא פלטפורמת תחבורה לפי דרישה לישראל: אפליקציית נוסעים, אפליקציית נהגים ומערכת ניהול למפעילים — על בסיס מנוע הזמנות אמיתי, תמחור בצד השרת ועמלה שקופה.
המאגר הזה הוא מוצר עובד שניתן להדגים, לבדוק ולהרחיב — לא דמו של מסכים.

> **סטטוס:** פיילוט/פיתוח. התעריפים, הנתונים והנהגים בסביבת ברירת המחדל הם **הדגמה** ומסומנים ככאלה בכל מסך. הפעלה מסחרית מחייבת אישור רגולטורי וביטוחי (ראו `docs/LEGAL-AND-SAFETY.md`).

---

## Quick start

```bash
pnpm install
cp .env.example .env.local      # defaults: embedded PGlite DB, demo mode on, offline geo provider
pnpm dev                        # http://localhost:3000 — migrates + seeds automatically
                                # open it via localhost (the dev client is not served to other origins)
```

Demo accounts (seeded when `HOP_DEMO_MODE=true`):

| Role | Email | Password | Lands on |
|---|---|---|---|
| Rider | `rider@hop.local` | `Rider1234!` | `/ride` |
| Driver (approved, online) | `driver@hop.local` | `Driver1234!` | `/drive` |
| Driver (under review) | `driver.pending@hop.local` | `Driver1234!` | `/drive/onboarding` |
| Support | `support@hop.local` | `Support1234!` | `/admin` |
| Admin | `admin@hop.local` | `Admin1234!` | `/admin` |

In demo mode a **driver autopilot** makes the seeded demo drivers accept offers and drive rides to completion, so the full rider journey (price → order → match → ride → receipt → rating) can be experienced alone. Turn it off in **Admin → הגדרות** to drive manually with a real driver account.

## What's inside

| Area | Path | Notes |
|---|---|---|
| Rider app | `/ride` | map-first ordering, upfront price, live tracking, receipts, history, support |
| Driver app | `/drive` | onboarding + document verification, online/offline, offers with payout & commission, navigation, earnings |
| Operator dashboard | `/admin` | KPIs, live drivers, verification queue, users, rides & anomalies, tickets, pricing & service types, reports, audit log, settings |
| API | `/api/*` | REST + SSE (`/api/events`); see `docs/API.md` |
| Domain engine | `src/server/*` | pricing, dispatch state machine, matching, realtime, audit |

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js 16 (Turbopack) |
| `pnpm typecheck` · `pnpm lint` | TypeScript strict · ESLint (Next + React Compiler rules) |
| `pnpm test` | Vitest unit + integration tests on an in-memory PGlite Postgres |
| `pnpm test:e2e` | Playwright end-to-end on phone / tablet / desktop (RTL) — boots its own server on :3100 |
| `pnpm db:generate` | Generate a migration from `src/server/db/schema.ts` |
| `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:reset` | Apply migrations · seed baseline (+demo) · wipe the local PGlite DB |
| `pnpm check` | typecheck + lint + test |

Playwright in a container with a pre-installed Chromium: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e`.

## Configuration (`.env.example`)

- `DATABASE_URL` — `pglite://./data/hop` (embedded, zero setup), `memory://` (tests) or `postgres://…` (production; `docker-compose up` gives you one).
- `HOP_DEMO_MODE` — seeds demo users/drivers, enables the autopilot, shows the DEMO banner.
- `GEO_PROVIDER` — `osm` (default): **live map data, no API keys** — Photon search-as-you-type, Nominatim reverse geocoding (Hebrew), OSRM road routing; each call has a timeout, a cache and a circuit breaker, and falls back to a clearly-labelled estimate if a service is down. `demo` = offline only (used by the tests).
- `NEXT_PUBLIC_MAP_STYLE_URL` — MapLibre style; default OpenFreeMap "positron" (light vector tiles, no key). Hebrew labels are shaped by the RTL text plugin served from `/map/rtl-text`. Empty → flat offline canvas.
- **Live traffic** (optional): set one of `GOOGLE_MAPS_API_KEY` (Routes API), `MAPBOX_ACCESS_TOKEN` (Directions, `driving-traffic`) or `TOMTOM_API_KEY` (Routing + Traffic Flow). Quotes, ETAs and driver navigation then use traffic-aware durations and the route is coloured by congestion. TomTom also enables the live traffic overlay, whose tiles are proxied by the server so the key never reaches the browser. Without a key, routing is OSRM (real roads, no live traffic) and the UI never claims traffic data. Check `/api/health` → `trafficRouting`, `trafficTiles`.
- Before real traffic, point `PHOTON_URL`, `NOMINATIM_URL`, `OSRM_URL` at your own instances (the public servers are for light use) and set `HOP_GEO_CONTACT` to a real address.
- `HOP_SESSION_SECRET`, `HOP_ADMIN_EMAIL`, `HOP_ADMIN_PASSWORD` — change in production.

## Documentation

- `docs/ARCHITECTURE.md` — system design, ride state machine, matching, money flow, realtime
- `docs/DECISIONS.md` — technology decisions (ADRs)
- `docs/API.md` — endpoints and DTOs
- `docs/DESIGN.md` — brand, liquid-glass design system, RTL rules
- `docs/LEGAL-AND-SAFETY.md` — regulatory posture, verification, data protection
- `docs/RUNBOOK.md` — running, migrating, backing up, deploying
- `docs/STATUS.md` — what works, what is missing, next steps
