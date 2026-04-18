---
title: Yoyaku — Project Overview
category: 01-overview
status: draft
confidence: high
updated: 2026-04-13
sources: [raw/notes/CLAUDE.md, raw/decisions/docs__plan.md]
---

## What It Is

Yoyaku is an AI restaurant booking app for Tokyo. Users chat with a Claude-powered concierge ("Yoyakun"), find restaurants via Google Places and a Tabelog scraper, and complete reservations either online or via an outbound AI phone call.

**Primary acceptance test:** User searches → gets real Tokyo restaurant results → completes a booking end-to-end.

## Strategic Positioning

Tabelog (170M+ reviews, dominant in Japan) has a poor UX — manual filters, no intent understanding. Yoyaku's wedge is being a better interface on top of the same data, not replacing the data.

**Permanent advantages over Tabelog:**
- Natural language intent: "somewhere quiet for a date under ¥8000 in Shibuya"
- Multi-turn clarification and preference memory
- Context-aware recommendations across a session
- End-to-end booking in one chat thread

**Realistic path:** Be the best interface → gradually own the supply side (restaurant partnerships, direct slot inventory).

## What's Working (as of 2026-04-13)

- Restaurant search via Google Places + Tabelog scraper returning real Tokyo data
- Streaming SSE chat with full Claude tool loop
- JWT auth with email verification and password reset
- Bookings: create, cancel, manage, reminders
- Group rooms: invite, vote, confirm
- Autocall pipeline architecture (end-to-end untested — API keys needed)

## What's Not Working / Next Up

1. **Autocall API keys** — Twilio, Deepgram, Cartesia, ngrok `AUTOCALL_BASE_URL` missing; pipeline untested
2. **Call pending UX** — no "calling... ⏳" indicator or result surfaced after phone booking
3. **Tabelog online booking** — `makeReservation` writes only to local DB; real Tabelog flow is partially wired
4. **20 open security bugs** — see [[security-bug-tracker]]

## What's Missing to Replace Tabelog Entirely

| Priority | Gap | Why it matters |
|----------|-----|----------------|
| 1 | Real booking confirmation | Without this it's a chatbot, not a booking service |
| 2 | User history & personalization | Return retention and context memory |
| 3 | Photos | Primary decision signal for Japanese restaurant-seekers |
| 4 | Review layer | Quality signal without Tabelog dependency |
| 5 | Restaurant-side accounts | Data ownership + revenue model |
| 6 | Mobile-native app | Tabelog has 10M+ downloads; PWA buys time |

See also: [[architecture-overview]], [[reservation-system]], [[product-gap-analysis]]