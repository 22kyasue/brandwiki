---
title: Reservation System — Multi-Path Architecture
category: 03-architecture
status: draft
confidence: high
updated: 2026-04-13
sources: [raw/decisions/docs__plan_reservations.md, raw/code-snapshots/backend/backend__src__lib__tools.ts]
---

## Current State

`make_reservation` in `tools.ts` is **partially real**: it always writes to local SQLite and optionally attempts Tabelog browser automation if the restaurant has a Tabelog URL and the user provided email + phone. The autocall path (`make_phone_reservation`) is architecture-complete but untested end-to-end.

## Japan Reservation Landscape

| Method | Share | Platforms |
|--------|-------|-----------|
| Platform-exclusive | ~60% casual/mid dining | Tabelog, Hot Pepper Gourmet, Gurunavi, **Ikkyu** (high-end), OMAKASE, Pocket Concierge, OpenTable |
| Direct online form | ~15% | Restaurant website (no login) |
| Phone only | ~20%+ (higher at 3.5+ Tabelog rating) | N/A |
| Walk-in only | Remainder | Ramen, standing bars, counters |

**Ikkyu note:** Requires credit card pre-authorization and cancellation penalties — always show explicit warning before directing user there.

## Planned Architecture: Reservation Router

```
AI Concierge
  → detect_reservation_method(restaurant_id, name, website_url?)
  → ReservationRouter
      ├── tabelog / hotpepper / gurunavi → Deep-link Handoff (Phase 1)
      ├── ikkyu                          → Ikkyu Handoff + Warning (Phase 1)
      ├── direct_form                    → Playwright Form Filler (Phase 2)
      ├── phone                          → Phone Guidance Handler (Phase 1)
      └── walkin                         → Walk-in Info Handler (Phase 1)
```

## The Five Handlers

### 1. Deep-link Handoff (Tabelog, Hot Pepper, Ikkyu, OMAKASE)
AI pre-fills a direct link to the restaurant's reservation page with date/party. User completes booking in their own browser. **No credential-in-chat** — security non-negotiable.

### 2. Direct Form / Playwright Sidecar (Phase 2)
Playwright runs as a separate Node.js sidecar (port distinct from Next.js). Claude vision reads Japanese form fields via screenshot. Requires explicit user confirmation gate before any form submission.

### 3. Phone Guidance Handler
For phone-only restaurants, the AI generates:
- Full Japanese script (keigo)
- Romaji phonetics for non-Japanese speakers
- Katakana name conversion
- Best calling hours (10:00–11:30 or 14:30–17:00; avoid lunch/dinner service)
- LINE/email alternatives if available

### 4. Walk-in Info Handler
Opening time, queue arrival tip, expected wait, seat count.

## Detection Method (Priority Order)

1. Curated local SQLite table (seeded with popular Tokyo restaurants)
2. Google Places `reservable` and `reservations_url` fields (unreliable in Japan — treat as hint)
3. Playwright sidecar scrape of Tabelog listing page (cached 7 days)
4. Fallback: ask the user

## Phased Implementation

| Phase | Key Deliverables | Status |
|-------|-----------------|--------|
| 1 | Deep-link handoff, phone guidance, walk-in, Ikkyu warning, detection tool | Not started |
| 2 | Playwright sidecar, direct form filler, confirmation gate, progress streaming | Not started |
| 3 | Platform automation with OAuth session capture (requires user auth first) | Not started |
| 4 | 2FA handling, failure recovery, Gurunavi/Ikkyu handlers | Not started |

## What NOT to Build

- **Credential-in-chat** — passwords entered in chat enter the Claude API payload and server logs
- **Static `fetch()` scraping of Tabelog** — requires JavaScript rendering; use Playwright sidecar
- **Playwright inside Next.js API routes** — incompatible with serverless; always in sidecar

See also: [[autocall-voice-pipeline]], [[claude-agent-tool-loop]]