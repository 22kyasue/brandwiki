---
title: Security Bug Tracker — Open Items
category: 05-operations
status: draft
confidence: high
updated: 2026-04-13
sources: [raw/decisions/docs__bugs.md]
---

> Source of truth: `docs/bugs.md`. Check off with `[x]` when fixed; add new items at bottom of each section.
> **20 open items** as of 2026-04-13.

## Critical — Block Launch

| Status | Issue | Location | Fix |
|--------|-------|----------|-----|
| ✅ Fixed | JWT secret hardcoded fallback | `backend/src/lib/auth.ts:4` | Throws at startup in production |
| **Open** | No rate limiting anywhere | `backend/src/server.ts` | Add `express-rate-limit` global middleware |
| ✅ Fixed | `POST /complete-past` unauthenticated | `backend/src/routes/bookings.ts:110` | Added `requireAuth` + admin role |
| **Open** | Vote/preference spoofing | `room-votes.ts`, `room-preferences.ts` | `participantId` accepted from body with no ownership proof; add `joinToken` |
| **Open** | Room route `:roomId` param ambiguity | `room-ai.ts:13`, `room-votes.ts:28`, `room-preferences.ts:26` | Some routes query by `inviteCode`, others by UUID; standardize |

## High — Fix Before Launch

| Status | Issue | Location |
|--------|-------|----------|
| **Open** | Login brute-forceable | `auth.ts:53` — add per-IP rate limiter (5 req/15 min) |
| **Open** | Registration leaks user existence | `auth.ts:34` — change `"Email already registered"` to generic message |
| **Open** | JWT in localStorage | `UserContext.tsx` — migrate to httpOnly cookies |
| **Open** | Session state race on stream close | `claude.ts:81–222` — `setSession()` called inside tool callbacks mid-stream; only persist after full stream completes |
| **Open** | Tool result JSON serialization unsafe | `claude.ts:45,92` — circular refs or Date objects crash at runtime |
| **Open** | N+1: user bookings queried every message | `chat.ts:26–39` — cache in session or fetch once at session init |
| **Open** | Session resume doesn't validate user identity | `claude.ts:208` — cross-user preference bleed possible |
| **Open** | Booking state machine allows unguarded loops | `booking-state.ts:39–79` — invalid transitions should throw, not warn |
| **Open** | Preference race condition (AI fires twice) | `room-preferences.ts:53–67` — wrap check+update+trigger in a DB transaction |

## Medium

| Status | Issue | Location |
|--------|-------|----------|
| **Open** | Scraper response not validated | `restaurants.ts` — add Zod schema, return 502 on bad shape |
| **Open** | Room invite code uses CUID (guessable) | `schema.prisma` — switch to `crypto.randomBytes(16).toString('hex')` |
| **Open** | Room FK cascade missing | `schema.prisma` — add `onDelete: Cascade` |
| **Open** | Booking timezone stored without offset | `tools.ts:624–626` — store UTC + timezone field |
| **Open** | Unbounded fallback search loops | `tools.ts:447–515` — `findRelaxedSearchFallback` has no cap; add max 3 attempts |
| **Open** | Email confirmation fire-and-forget | `tools.ts:673–687` — `sendBookingConfirmation()` not awaited; booking confirmed but email lost on crash |

## Low

| Status | Issue | Location |
|--------|-------|----------|
| **Open** | No AbortController timeout on scraper fetch | `restaurants.ts` — add 8s timeout, 504 on abort |
| **Open** | No React error boundary on ChatInterface | `ChatInterface.tsx` — any child throw crashes chat silently |
| **Open** | Simulated availability is deterministic | `tools.ts:183–198` — seeded by restaurantId+date; users can detect pattern |
| **Open** | No retry on transient scraper/Google Places failures | `tools.ts:318–343` — add exponential backoff (2 retries) |
| **Open** | Expired rooms never deleted | `schema.prisma` — `expiresAt` defined but no cleanup job |

See also: [[architecture-overview]], [[claude-agent-tool-loop]]