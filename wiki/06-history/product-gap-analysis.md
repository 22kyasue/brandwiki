---
title: Product Gap Analysis — Replacing Tabelog
category: 06-history
status: draft
confidence: high
updated: 2026-04-13
sources: [raw/decisions/docs__plan.md]
---

## The Wedge

Tabelog's interface is objectively poor — a directory from 2005 with 12 manual filter dropdowns. Nobody enjoys it; they tolerate it because the data is there.

Yoyaku's wedge: **a better interface on top of the same data**, using natural language where Tabelog requires manual filters. Realistic path: be the best interface → gradually own the supply side.

## What Yoyaku Permanently Has Over Tabelog

These advantages require rethinking the product from the interface layer up — Tabelog cannot bolt them on:

- Understand intent: "somewhere good for impressing a client" vs "casual ramen after 11pm"
- Multi-turn clarification with follow-up questions
- Context-aware recommendations across preferences and past visits
- Proactive suggestions: "you usually book Italian — there's a new place in Daikanyama you'd like"
- End-to-end booking in one flow without leaving a chat thread

## What Yoyaku Is Missing (Brutal Inventory)

### 1. Data Ownership
Currently scrapes Tabelog + Google Places — building on someone else's foundation. Real replacement needs:
- Canonical restaurant DB Yoyaku controls
- Direct restaurant partnerships for hours, menus, reservation slots
- Real-time availability via direct API/webhook relationship

### 2. User-Generated Reviews
Tabelog's moat: 170M+ reviews from 20 years. Without reviews: no social proof, no quality signal. Needs review system + user incentive (points, community, identity).

### 3. Restaurant Owner Accounts
Tabelog and Jalan are two-sided marketplaces. Restaurants pay to manage pages, enable booking, respond to reviews. That's the revenue model AND the data quality flywheel. Without restaurant-side accounts, data is always secondhand.

### 4. Real Reservation Infrastructure
Current booking is partially fake (writes only to local DB). Real system needs: slot inventory, confirmed emails/SMS to both sides, cancellation/modification flow, no-show handling.

### 5. User Accounts + History
"Where did we go last month?" Personalization and retention both require persistent user identity. Without it, chat is stateless between sessions.

### 6. Photos
Japanese restaurant-seekers look at photos **before anything else**. Google Images isn't enough. Needs curated, restaurant-verified photo system.

### 7. Mobile-Native Experience
Tabelog app: 10M+ downloads. People open it walking down the street. Next.js is not that. PWA buys time but native matters in Japan specifically.

## Priority Stack for Closing the Gap

| Priority | Gap | Why |
|----------|-----|-----|
| 1 | Real booking confirmation | Without this it's not a booking service |
| 2 | User accounts + history | Personalization and return retention |
| 3 | Photo integration | Non-negotiable for Japanese market |
| 4 | Review layer | Quality signal, reduces Tabelog dependency |
| 5 | Restaurant-side onboarding | Data ownership + revenue model |
| 6 | Mobile app | Distribution in Japan |

**Biggest unlock:** #1 + #2 together — if you can close a booking and remember the user, you have a relationship that Tabelog doesn't offer.

See also: [[project-overview]], [[reservation-system]]