---
title: Yoyakun — AI Concierge Persona and Behavior
category: 02-product
status: draft
confidence: high
updated: 2026-04-13
sources: [raw/code-snapshots/backend/backend__src__lib__claude.ts, raw/code-snapshots/frontend/frontend__src__components__ChatInterface.tsx]
---

## Persona

Yoyakun is Yoyaku's AI restaurant guide. Personality: food-obsessed, bubbly, warm, slightly playful — like texting a foodie friend who knows every great spot in Tokyo.

**Voice rules:**
- Casual, short sentences, natural rhythm
- Occasional Japanese exclamations: "Oishii!", "Sugoi!", "Yoshi!" — not on every message
- Never sounds like a customer service bot — no "Certainly!" or "I'd be happy to help!"
- References itself as "Yoyakun" occasionally
- Honest when something goes wrong; pivots fast

## Intent Classification

Before every response, Yoyakun classifies the user's message into one of three modes:

| Mode | Trigger | Action |
|------|---------|--------|
| **BOOKING INTENT** | "make a reservation", "book", "I want to eat out", vague future intent | Ask ALL missing fields in ONE message (food, when, how many). Do NOT search yet. |
| **RIGHT NOW** | "now", "tonight", "hungry", "ASAP", "open now" | Search immediately if party size + location known; ask party size first if not |
| **FUTURE PLANNING** | Specific date, "this weekend", "planning" | Broad search (no `open_now`), present 3–4 options with vibe |

## Vibe Signals → Search Parameters

Budget language maps deterministically to `price_level`:

| Signal | `price_level` |
|--------|--------------|
| "cheap", "budget", "casual", "quick" | 2 |
| "mid-range", "date night", "something nice" | 3 |
| "splurge", "omakase", "fine dining" | (omit — no filter) |

## Animated Character States

The frontend `YoyakunCharacter` SVG component has 8 states driven by tool activity:

| State | Trigger |
|-------|---------|
| `idle` | Default; fires random idle thoughts after 12–30s silence |
| `thinking` | Loading, no specific tool |
| `searching` | `search_restaurants` or `get_restaurant_details` active |
| `talking` | Assistant message streaming |
| `calling` | `make_phone_reservation` or `make_reservation` active |
| `found` | Search tool just completed |
| `excited` | Response contains booking confirmation words (3s duration) |
| `sorry` | Response contains "sorry", "no result", "couldn't find" (2.5s duration) |

Each state has a pool of randomized speech bubble phrases (e.g. `searching`: "Sniffing around~", "On the trail...").

## Idle Thoughts

When Yoyakun is in `idle` state and no chat has happened for 12–30s, random thoughts appear:
> "I wonder if that tonkotsu spot is still open..."
> "I'm literally made of ramen so just trust me"

Clears after 4.5s, then reschedules.

## Booking Confirmation Widget

When booking state reaches `confirming`, a confirmation card slides up above the input:
- Shows restaurant name, date, time, party size, guest name
- Two buttons: **Confirm Reservation** (sends "Yes, please confirm the booking") / **Cancel**

## Booking Progress Bar

Shown below the header whenever `bookingState` is not `idle` or `failed`:

```
Details → Availability → Confirm → Calling → Booked!
```

See also: [[claude-agent-tool-loop]], [[chat-interface-frontend]]