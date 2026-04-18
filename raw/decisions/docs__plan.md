<!-- Ingested from: docs/plan.md -->
<!-- Mtime: 2026-04-11T18:54:19.506Z -->

# Yoyaku — Product Gap Analysis
## What's missing to replace Tabelog / Jalan entirely

---

## The Wedge

Tabelog's interface is objectively bad. It's a directory from 2005. Nobody *enjoys* using it — they tolerate it because the data is there.

Yoyaku's wedge: **the interface is better.** Natural language — "somewhere quiet for a date, under 8000 yen, with sake, in Shibuya" — maps perfectly to AI. Tabelog makes you manually set 12 filter dropdowns.

The realistic path isn't "replace Tabelog's data." It's **be the better interface on top of the same data, then gradually own the supply side.**

---

## What's Missing (Brutal Inventory)

### 1. Data you own
Right now Yoyaku scrapes Tabelog and uses Google Places. That means building on someone else's foundation — they can block, change structure, or sue. A real replacement needs:
- A canonical restaurant database you control
- Direct restaurant partnerships for hours, menus, reservation slots
- Real-time availability via direct API or webhook relationship with restaurants

### 2. User-generated reviews
Tabelog's moat is 170M+ reviews — a 20-year accumulation of trust. Without reviews:
- No social proof
- No way to surface quality signals
- The AI can search but can't answer "is this place actually good"

Needs: a review system + a reason for users to leave reviews (points, community, identity).

### 3. Restaurant owner accounts
Tabelog and Jalan are two-sided marketplaces. Restaurants pay to manage their pages, update menus, respond to reviews, and enable online booking. That's the revenue model AND the data quality flywheel. Without restaurant-side accounts, the data is always secondhand.

### 4. Actual reservation infrastructure
Booking needs to be real, not simulated:
- Slot inventory management
- Confirmed booking with email/SMS to both sides
- Cancellation and modification flow
- No-show handling

This is a deep operational problem, not just a UI problem.

### 5. User accounts + history
"Where did we go last month?" — Tabelog users have saved restaurants, past visits, favorites. Personalization requires persistent user identity. Without it, the chat is stateless between sessions and there's no retention hook.

### 6. Photos
Japanese restaurant-seekers look at **photos before anything else.** Food photos are the primary decision signal. Google Images isn't enough — needs a curated, restaurant-verified photo system.

### 7. Mobile-native experience
Tabelog's app has 10M+ downloads. People open it walking down the street. A Next.js web app isn't that. PWA buys time but native matters in Japan specifically.

---

## Priority Stack

| Priority | Gap | Why |
|----------|-----|-----|
| 1 | Real booking confirmation flow | Without this it's not a booking service — it's a chatbot |
| 2 | User accounts + history | Personalization and return retention |
| 3 | Photo integration | Non-negotiable for Japanese market |
| 4 | Review layer (even lightweight) | Quality signal without Tabelog dependency |
| 5 | Restaurant-side onboarding | Data ownership + revenue model |
| 6 | Mobile app | Distribution in Japan |

The single biggest unlock is **#1 + #2** — if you can actually close a booking and remember the user, you have something Tabelog doesn't: a relationship.

---

## What Tabelog Can't Do (Yoyaku's Permanent Advantage)

- Understand intent: "somewhere good for impressing a client" vs "casual ramen after 11pm"
- Multi-turn clarification: ask follow-up questions to narrow results
- Context-aware recommendations: remember past preferences, dietary restrictions, past visits
- Proactive suggestions: "you usually book Italian — there's a new place in Daikanyama you'd like"
- End-to-end in one flow: search → pick → book → confirm, without leaving a chat thread

These are not features Tabelog can bolt on. They require rethinking from the interface layer up, which is what Yoyaku is.
