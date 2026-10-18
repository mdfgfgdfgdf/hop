# Technology decisions (ADRs)

| # | Decision | Why | Alternatives considered |
|---|---|---|---|
| 1 | **Next.js 16 App Router + TypeScript, single app** for rider, driver, admin and API | One deployable, shared types end-to-end, SSR for auth-gated pages, route groups isolate the three UIs | Separate SPA + Express API (more plumbing); React Native (not needed for a PWA-first pilot) |
| 2 | **PostgreSQL dialect via Drizzle; PGlite in dev/test, PostgreSQL in prod** | Zero-setup `pnpm dev` and fast isolated tests with *real* Postgres semantics (FOR UPDATE, jsonb, enums); same migrations in production | Prisma (heavier runtime, slower tests); SQLite (different SQL, weaker concurrency story) |
| 3 | **Custom cookie sessions (argon2 + hashed tokens)** | Minimal, auditable, no third-party auth dependency for a pilot; easy to add phone OTP later | Auth.js (more surface than needed), Clerk/Auth0 (vendor lock, cost) |
| 4 | **Transactional state machine with row locks** for rides | Correctness under races (double accept/start) is the core product risk; DB-level guarantees beat application locks | Optimistic versioning only (still needs retries), queues/workers (premature) |
| 5 | **SSE + polling fallback** for realtime | Works everywhere (proxies, serverless), trivial reconnect semantics, no socket server to run | WebSockets (needs a long-lived server), third-party realtime (cost) |
| 6 | **Live geo by default: Photon (search) + Nominatim (reverse) + OSRM (routing), offline fallback** | Real addresses and road routes with no keys or billing; Photon because Nominatim's policy forbids autocomplete; timeouts, caches and a circuit breaker keep the app usable when a public server is slow or down, with estimates labelled as such | Google Maps Platform / Mapbox (keys, billing; can be added as another provider behind the same interface) |
| 7 | **MapLibre GL + OpenFreeMap "positron" tiles, self-hosted RTL text plugin** | Open, keyless light vector tiles that suit the blue-and-white look; Hebrew label shaping without a third-party CDN | Mapbox (token + billing), Leaflet (raster only) |
| 8 | **Integer agorot + basis points** | No floating-point money bugs; explicit rounding step | Decimal columns (fine, but integers are simpler to reason about in JS) |
| 9 | **Upfront pricing; final = quoted** with anomaly flags | Riders see the price before ordering; disputes handled by operators with an audit trail | Metered pricing (requires certified meters / more regulation) |
| 10 | **In-process scheduler + event bus** | Single-instance pilot; one file each to swap for a queue / Redis when scaling | BullMQ/Redis now (extra infra for a pilot) |
| 11 | **Tailwind v4 + hand-written liquid-glass tokens, no UI kit** | Full control of the HOP identity, small bundle, RTL-first | shadcn/ui, MUI (generic look) |
| 12 | **Vitest (unit/integration on PGlite) + Playwright (phone/tablet/desktop)** | Fast feedback on the domain; real browser checks for RTL and the full flow | Jest (slower with ESM), Cypress (heavier) |
| 13 | **Demo autopilot behind `HOP_DEMO_MODE`, demo data always labelled** | The rider flow can be demoed solo without pretending the data is real | Mock servers (diverge from the real engine) |
