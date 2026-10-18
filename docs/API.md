# HOP API (REST + SSE)

All endpoints are JSON, same-origin, cookie session (`hop_session`, httpOnly). Errors:
`{ error: { code, message, details? } }` with proper HTTP status. Use the typed client
`src/lib/api.ts` (`api.*`) from the browser — it already encodes every route below and throws
`ApiClientError { status, code, message }`. DTO shapes live in `src/lib/types.ts`.

Realtime: `GET /api/events` (SSE). Events: `ride.updated {rideId,status,version}`,
`ride.offer {rideId,expiresAt}`, `ride.offer.cancelled`, `driver.location {rideId,lat,lng,heading}`,
`driver.availability`, `notification {kind,...}`, admin feed `admin.ride`, `admin.driver`.
Use `useRealtime({ onEvent, onReconnect })` from `src/lib/realtime.ts`; on any event re-fetch
authoritative state (e.g. `api.rides.active()`).

## Auth
- `POST /api/auth/signup` {role, name, email, phone, password, acceptTerms:true}
- `POST /api/auth/login` {email, password} · `POST /api/auth/logout`
- `GET /api/auth/me` → {user, driverProfile, demoMode} · `PATCH /api/auth/me` {name?, phone?}

## Rider
- `GET /api/geo/search?q=&lat=&lng=` → {places[]} · `GET /api/geo/reverse?lat=&lng=` → {place}
- `GET /api/service-types`
- `POST /api/quotes` {pickup:{lat,lng,address}, dropoff:{…}, promoCode?} → QuoteResponse
  (route + one quote per enabled service type, each with full FareBreakdown, ETA, driver count)
- `POST /api/rides` {quoteId, paymentMethod: "cash"|"card_demo"} → {ride}
- `GET /api/rides/active` → {ride|null} · `GET /api/rides` (history) · `GET /api/rides/:id`
- `GET /api/geo/route?fromLat&fromLng&toLat&toLng` (rider/driver) → `{route}`: a road route with `traffic` (`{source, durationNoTrafficS, spans:[{from,to,level}]}`) when a traffic-aware router is configured. For navigation and live ETAs; prices are only computed in `/api/quotes`.
- `GET /api/map/config` → `{trafficTiles, trafficRouting, geoProvider}` · `GET /api/map/traffic/:z/:x/:y` (signed-in) → a live traffic overlay PNG (TomTom flow, proxied, cached 60 s).
- Quotes (`route.traffic`) and rides (`traffic`) carry the congestion measured when the ride was quoted.
- `GET /api/rides/nearby?lat&lng` (rider) → `{cars:[{id,lat,lng,heading,vehicleClass}]}`: available, approved, non-busy drivers within 3 km, max 8. `id` is a per-day anonymous token; coordinates are rounded to ~10 m; no names or plates.
- `POST /api/rides/:id/cancel` {reason?} · `POST /api/rides/:id/rate` {stars, comment?}
- `GET /api/rides/:id/events` (timeline)

## Driver
- `GET/PATCH /api/driver/profile` (vehicle, licence numbers, service types) → {profile, documents, requiredDocuments}
- `GET /api/driver/documents` · `POST /api/driver/documents` multipart {type, file, expiresAt?}
  · `GET /api/driver/documents/:id` (file)
- `POST /api/driver/availability` {online, location?} · `POST /api/driver/location` {lat,lng,heading?,speedMps?}
- `POST /api/driver/offers/:rideId/accept|decline`
- `POST /api/driver/rides/:id/arriving|arrived|start|complete`
- `GET /api/driver/earnings?range=today|week|month|all` → gross / commission / net / by day
- `GET /api/rides/active` returns the driver's active ride **or** the pending offer (`ride.offer` set, `status: "offered"`).

## Support (any role)
- `POST /api/support/tickets` {rideId?, category, subject, body} · `GET /api/support/tickets`
- `GET /api/support/tickets/:id` · `POST /api/support/tickets/:id/messages` {body}

## Admin / support staff
- `GET /api/admin/overview` KPIs + recent rides + live drivers · `GET /api/admin/counts` light counters (drivers by status, active rides, open/urgent tickets)
- `GET /api/admin/drivers?status=&q=` · `GET /api/admin/drivers/:id` · `POST …/:id/verify` {decision: approve|reject|suspend|reinstate, reason?, notes?}
  · `POST /api/admin/drivers/:id/documents/:docId` {status: approved|rejected, notes?}
- `GET /api/admin/users?role=&status=&q=` · `GET /api/admin/users/:id` · `PATCH /api/admin/users/:id` {status?, reason?, role?} (role change = admin only)
- `GET /api/admin/rides?status=active|…&flagged=true&q=&from=&to=` (q matches addresses, ride id, rider/driver name, phone or email) · `GET /api/admin/rides/:id` (events, offers with driver names, ledger, track)
  · `POST /api/admin/rides/:id/cancel` {reason} · `POST /api/admin/rides/:id/adjust` {refundAgorot?, note} (notes on any ride; refunds only on completed/cancelled)
- `GET/PUT /api/admin/pricing` (PUT creates a new active tariff version; admin only)
- `GET /api/admin/service-types` · `PATCH /api/admin/service-types/:id` (cannot enable unapproved)
- `GET /api/admin/reports?from=&to=` · `GET /api/admin/audit?action=&actorId=`
- `GET/PUT /api/admin/settings` (dispatch + demo settings)
- `GET /api/admin/tickets?status=` · `GET/PATCH /api/admin/tickets/:id` {status, priority, assignedTo}
  · replies via `POST /api/support/tickets/:id/messages` {body, internal?}

## Demo
- `POST /api/demo/simulate` — runs one scheduler tick (offer expiry, matching, demo autopilot).
