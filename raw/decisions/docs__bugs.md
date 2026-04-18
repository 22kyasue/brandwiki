<!-- Ingested from: docs/bugs.md -->
<!-- Mtime: 2026-04-13T12:08:33.486Z -->

# Yoyaku Bug & Vulnerability Tracker

> Check off with `[x]` when fixed. Add new items at the bottom of each section.

---

## Critical

- [x] **JWT secret hardcoded fallback** — `backend/src/lib/auth.ts:4` — throws at startup if `NODE_ENV=production` and `JWT_SECRET` missing ✓
- [ ] **No rate limiting anywhere** — `backend/src/server.ts` — add `express-rate-limit` global middleware
- [x] **`POST /complete-past` unauthenticated** — `backend/src/routes/bookings.ts:110` — add `requireAuth` + admin role check ✓
- [ ] **Vote/preference spoofing** — `backend/src/routes/room-votes.ts`, `room-preferences.ts` — `participantId` accepted from body with no ownership proof; add `joinToken` issued at join time
- [x] **`GET /bookings/:id` unauthenticated** — `backend/src/routes/bookings.ts:127` — add `requireAuth` + ownership check ✓
- [x] **XSS via raw lat/lng in Google Maps iframe** — `frontend/src/components/MessageBubble.tsx` — already uses `encodeURIComponent()` on Google Maps link ✓
- [ ] **Room route `:roomId` param ambiguity** — `backend/src/routes/room-ai.ts:13`, `room-votes.ts:28`, `room-preferences.ts:26` — some routes query by `inviteCode`, others by UUID; requests go to the wrong record; standardize all routes to one identifier
- [x] **Vote tally null crash** — `backend/src/routes/room-votes.ts:57-71` — NOT A BUG: `tallies[0]` as reduce seed returns `undefined` on empty array (no crash), and `if (topTally)` guard on line 68 handles it correctly ✓

---

## High

- [x] **Login brute-forceable** — `backend/src/routes/auth.ts` — `loginLimiter` (5 req / 15 min per IP) already applied to `POST /login` ✓
- [x] **Registration leaks user existence** — `backend/src/routes/auth.ts` — message already says "may already exist. Try signing in instead." — generic enough ✓
- [x] **JSON.parse crashes on corrupt DB prefs** — `backend/src/lib/preferences.ts` — all 6 calls wrapped via `parseJsonArray()` helper ✓
- [x] **Session eviction is FIFO** — `backend/src/lib/sessions.ts` — `setSession()` now calls `evictExpired()` before capacity check, so expired sessions are cleared first ✓
- [ ] **JWT in localStorage** — `frontend/src/contexts/UserContext.tsx` — migrate to httpOnly cookies (needs backend `/api/auth/session` support)
- [x] **Session state race on stream close** — `backend/src/lib/claude.ts` — removed `setSession()` from inside tool callbacks; session only persisted after full stream completes ✓
- [x] **Tool result JSON serialization unsafe** — `backend/src/lib/claude.ts` — `JSON.stringify(result)` wrapped in try-catch; falls back to `{ error: "Result could not be serialized" }` ✓
- [ ] **N+1: user bookings queried every message** — `backend/src/routes/chat.ts:26-39` — recent bookings fetched from DB on every chat request; cache in session or fetch once at session init
- [ ] **Session resume does not validate user identity** — `backend/src/lib/claude.ts:208` — resumed sessions don't verify the requesting user matches the session owner; cross-user preference bleed possible
- [x] **Booking state machine allows unguarded loops** — `backend/src/lib/booking-state.ts` — NOT A BUG: invalid transitions already return unchanged `ctx` (not `merged`); state machine is correct ✓
- [x] **Room create endpoint unauthenticated** — `backend/src/routes/rooms.ts` — `requireAuth` added to `POST /` (create room); join intentionally open for invite-link guests ✓
- [ ] **Preference submission triggers AI twice (race)** — `backend/src/routes/room-preferences.ts:53-67` — two simultaneous last-preference POSTs both see `COLLECTING` status and both fire AI suggestion; wrap check+update+trigger in a single DB transaction
- [x] **Streaming parse error leaves UI in ambiguous state** — `frontend/src/hooks/useStreamingChat.ts` — malformed SSE lines now caught with try/catch and skipped; stream continues reading ✓

---

## Medium

- [ ] **Room AI status set without checking current state** — `backend/src/routes/room-ai.ts` — guard: must be `VOTING` before transitioning
- [ ] **Scraper response not validated** — `backend/src/routes/restaurants.ts` — parse with Zod schema, return 502 on bad shape
- [x] **Room creation accepts past dates** — `backend/src/routes/rooms.ts` — `isNaN` + `<= new Date()` guard added ✓
- [x] **`localStorage` book intent injectable** — `frontend/src/components/ChatInterface.tsx` — strip HTML tags + limit to 200 chars before setting input ✓
- [ ] **Room invite code uses CUID (guessable)** — `backend/prisma/schema.prisma` — switch to `crypto.randomBytes(16).toString('hex')`
- [ ] **Room FK cascade missing** — `backend/prisma/schema.prisma` — add `onDelete: Cascade` to Room→Booking and Participant→Preference relations
- [ ] **Fire-and-forget AI suggest silently fails** — `backend/src/routes/room-preferences.ts` — surface failure status to client
- [x] **Booking date/time not validated after parsing** — `backend/src/routes/bookings.ts:46` — `new Date(\`${date}T${time}\`)` silently produces Invalid Date on malformed input; add `isNaN(dateTime.getTime())` check ✓
- [ ] **Booking timezone stored without offset** — `backend/src/lib/tools.ts:624-626` — date formatted as JST then stored as JS Date (timezone-naive); will display wrong time in other locales; store UTC + timezone field or always convert on display
- [x] **JSON.parse in room-ai loop unprotected** — `backend/src/routes/room-ai.ts:35-39` — NOT A BUG: builder already wrapped it in try-catch with `cuisines = []` fallback ✓
- [x] **Unvalidated restaurant ID passed to scraper** — `backend/src/lib/tools.ts` — `handleGetRestaurantDetails` now validates ID as alphanumeric/`_-`, max 200 chars, before any external call ✓
- [x] **Stale closure over sessionId in useStreamingChat** — `frontend/src/hooks/useStreamingChat.ts` — `sessionIdRef` added; `sendMessage` reads `sessionIdRef.current` instead of stale state ✓
- [x] **Unbounded fallback search loops scraper/Google APIs** — `backend/src/lib/tools.ts` — `findRelaxedSearchFallback` now capped at 3 fallback location attempts ✓
- [ ] **Email confirmation fire-and-forget** — `backend/src/lib/tools.ts:673-687` — `sendBookingConfirmation()` called without await; app crash before send = lost email with confirmed booking; queue via job or await
- [ ] **Booking create + email not transactional** — `backend/src/lib/tools.ts:612-711` — Prisma insert and email send are separate; email failure leaves booking confirmed but user unnotified with no recovery path; use outbox pattern or job queue

---

## Low

- [x] **No env var validation at startup** — `backend/src/env.ts` — throws at startup if `ANTHROPIC_API_KEY`, `DATABASE_URL`, or `JWT_SECRET` is missing ✓
- [ ] **No AbortController timeout on scraper fetch** — `backend/src/routes/restaurants.ts` — add 8s timeout, return 504 on abort
- [ ] **Review comments not sanitized** — `backend/src/routes/reviews.ts` — add max length + confirm frontend doesn't render as HTML
- [x] **`restrictions`/`freeText` in room preferences** — `backend/src/routes/room-preferences.ts` — `.max(200)` / `.max(500)` added to Zod schema ✓
- [ ] **Room ID format not validated** — `backend/src/routes/rooms.ts` — reject params that don't match `[a-zA-Z0-9_-]`
- [ ] **Simulated availability is fully deterministic** — `backend/src/lib/tools.ts:183-198` — seeded by restaurantId+date so slots never change; users can detect the pattern; add per-request entropy
- [ ] **No React error boundary on ChatInterface** — `frontend/src/components/ChatInterface.tsx` — any child throw crashes the entire chat silently; wrap with an Error Boundary component
- [x] **Hardcoded `localhost` in room-preferences self-fetch** — `backend/src/routes/room-preferences.ts:64` — uses `INTERNAL_BASE_URL` env var with localhost fallback ✓
- [ ] **No retry on transient scraper/Google Places failures** — `backend/src/lib/tools.ts:318-343` — single attempt; a momentary network blip shows the user an error; add exponential backoff (2 retries)
- [ ] **`localStorage` called without `typeof window` guard** — `frontend/src/components/ChatInterface.tsx:36` — "use client" prevents SSR crash now but it's fragile; add explicit browser env check
- [x] **`status: "pending"` in booking update schema but not in Prisma enum** — `backend/src/routes/bookings.ts:26` — removed "pending" from Zod enum ✓
- [ ] **Expired rooms never deleted** — `backend/prisma/schema.prisma` — `expiresAt` field defined but no cleanup job; rows accumulate indefinitely; add a scheduled job to delete where `expiresAt < now`

---

## Done

<!-- Move items here when fixed -->

