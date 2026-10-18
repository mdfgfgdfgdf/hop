# Runbook

## Local development
```bash
pnpm install && cp .env.example .env.local && pnpm dev
```
Embedded PGlite data lives in `./data/hop`; uploads in `./data/uploads`. `pnpm db:reset` wipes the DB.

## Real PostgreSQL
```bash
docker compose up -d postgres
echo 'DATABASE_URL=postgres://hop:hop@localhost:5432/hop' >> .env.local
pnpm db:migrate && pnpm db:seed
```

## Real maps / geocoding
```
GEO_PROVIDER=osm
NOMINATIM_URL=https://your-nominatim      # public OSM servers are rate-limited; self-host for a pilot
OSRM_URL=https://your-osrm
# live traffic (pick one; keys server-side only, restricted by API + server IP)
GOOGLE_MAPS_API_KEY=...        # Routes API
# MAPBOX_ACCESS_TOKEN=...      # Directions (driving-traffic)
# TOMTOM_API_KEY=...           # Routing + Traffic Flow tiles (overlay)
NEXT_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
```

## Production
- Set `NODE_ENV=production`, a strong `HOP_SESSION_SECRET`, real `HOP_ADMIN_*`, `HOP_DEMO_MODE=false`,
  `DB_AUTO_SEED=false` after the first boot, `DATABASE_URL` to PostgreSQL.
- `pnpm build && pnpm start` (Node 22). The scheduler and SSE bus are in-process: run **one** instance, or
  replace `src/server/realtime/bus.ts` and `src/server/dispatch/scheduler.ts` with Redis-backed versions
  before scaling horizontally.
- Put uploads on durable storage (mount `HOP_DATA_DIR` or swap `src/server/driver/service.ts` storage for
  S3/R2).
- Backups: PostgreSQL `pg_dump` nightly + object storage for uploads. Restore = restore DB, redeploy, point
  `HOP_DATA_DIR` at the restored uploads.

## Operations
- Health: `GET /api/health` → db kind, demo mode, geo provider.
- Stuck ride? The sweep expires offers and retries matching every 2.5 s; `POST /api/demo/simulate` (demo mode)
  forces a tick. Admin can cancel any active ride from the dashboard with a reason (audited).
- Tariff change: Admin → תמחור. Every save creates a new active version; old versions stay for audit.
- Driver verification: Admin → נהגים → בבדיקה.

## Tests
```bash
pnpm test                       # unit + integration on in-memory PGlite
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e   # or `pnpm exec playwright install chromium`
```

## Dev-server gotchas (learned the hard way)
- Open the dev app at **http://localhost:3000**, not `127.0.0.1`: the Next dev client is only served to
  allowed origins (`allowedDevOrigins` in `next.config.ts` lists both, but Playwright and scripts use
  `localhost`). A blocked origin renders HTML that never hydrates.
- Run **one** `next dev` per checkout. Two dev servers sharing `.next/dev` corrupt the Turbopack cache and
  the page reloads forever with "HMR hash mismatch". Recovery: stop all `next` processes
  (`scripts/dev/free-port.sh <port>`), `rm -rf .next/dev`, start again. Playwright's `webServer` reuses a
  running server on :3100 when present, and `scripts/dev/e2e-server.mjs` resets the e2e database first.
