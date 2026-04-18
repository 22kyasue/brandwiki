<!-- Ingested from: docs/plan_reservations.md -->
<!-- Mtime: 2026-04-10T14:46:08.117Z -->

# Yoyaku — Reservation System Architecture Plan (v2)
> Refined after two independent agent reviews: technical feasibility + Japan market/UX

---

## Reality Check

The current `make_reservation` tool is **100% fake** — it writes to local SQLite only.
No real restaurant, platform, or booking system is contacted.

This plan replaces it with a real multi-path reservation system.

---

## The Real Reservation Landscape in Japan

Japanese restaurants fall into one of these categories (sometimes multiple):

| # | Method | Platforms | Notes |
|---|--------|-----------|-------|
| 1 | **Platform-exclusive** | Tabelog, Hot Pepper Gourmet, Gurunavi, **Ikkyu (一休)**, OMAKASE, Pocket Concierge/Tableall, OpenTable | ~60% casual/mid dining. Ikkyu dominates high-end kappo/kaiseki. OMAKASE/Tableall = ultra-premium counters |
| 2 | **Direct online form** | Restaurant's own website (Google Forms, custom, etc.) | ~15%. No login required |
| 3 | **Phone only** | N/A | ~20%+ at 3.5+ Tabelog rating tier. Higher % at premium end |
| 4 | **Walk-in only** | N/A | Ramen shops, standing bars, counters |

**Ikkyu note:** Distinct from the others — requires credit card pre-authorization and enforces cancellation penalties. Needs its own handler with explicit user warnings.

---

## Core Architecture: Reservation Router

```
User (chat)
    ↓
AI Concierge (Claude agent)
    ↓ collects: restaurant, date, time, party size, name
    ↓ calls tool
detect_reservation_method(restaurant_id, name, website_url?)
    ↓ returns method type
ReservationRouter
    ├── [tabelog / hotpepper / gurunavi]  → Deep-link Handoff Handler  (Phase 1)
    │                                     → Playwright Sidecar          (Phase 3)
    ├── [ikkyu]                           → Ikkyu Handoff + Warning Handler (Phase 1)
    ├── [omakase / tableall]              → Deep-link Handoff Handler  (Phase 1)
    ├── [direct_form]                     → Playwright Form Filler      (Phase 2)
    ├── [phone]                           → Phone Guidance Handler      (Phase 1)
    └── [walkin]                          → Walk-in Info Handler        (Phase 1)
```

**Key architectural decision (from technical review):**
Deep-link handoff is the **primary path** for all platform bookings (Tabelog, Hot Pepper, etc.), not a fallback. Playwright automation is reserved for direct restaurant forms only. Full platform automation (Playwright + login) is a later phase that requires user auth to be built first.

---

## The 5 Handlers

### Handler 1: Deep-link Handoff (Tabelog / Hot Pepper / Gurunavi / Ikkyu / OMAKASE)

The AI collects all booking details, then generates a direct link to the restaurant's reservation page on the platform with date/party pre-filled via URL params where supported.

**Why not automate platform login?**
- Credential-in-chat is a security anti-pattern (plaintext password enters Claude API payload, may appear in server logs)
- ToS violation at scale
- Platforms use 2FA, custom JS widgets, Japanese-only forms — all fragile to automate
- Users are already logged in on their own phone/browser
- Deep-link is reliable, zero credential risk, and works today

**Flow:**
```
AI: "This restaurant books exclusively through Tabelog.
     Here's your pre-filled reservation link:
     [Open Tabelog reservation →] (opens date: Apr 12, party: 2, pre-selected)

     On Tabelog: select a time slot → confirm your details → submit.
     You'll get an email confirmation from Tabelog directly."
```

**Tabelog URL pattern:** `https://tabelog.com/[pref]/A[area]/[id]/reserve/?date=YYYYMMDD&pax=N`
**Hot Pepper URL pattern:** `https://www.hotpepper.jp/str[id]/reserve/?date=YYYY-MM-DD&num=N`

**Ikkyu warning (always shown):**
> "⚠️ Ikkyu reservations require a credit card and have a cancellation fee. Please review the cancellation policy on the Ikkyu page before confirming."

---

### Handler 2: Direct Form (Playwright Sidecar — Phase 2)

For restaurants with their own website booking form (no login required, no ToS issue).

**Architecture:** Playwright runs as a **separate Node.js sidecar process** (port 3001), not embedded in Next.js API routes. Next.js calls it via HTTP. This is required because:
- Next.js serverless functions can't run browser binaries
- Browser contexts are stateful and long-lived; API routes are stateless
- Isolates browser crashes from the main app

**Translation layer (required):** Japanese form fields, error messages, and UI elements are handled via Claude vision on screenshots — Claude reads the Japanese page and maps fields to user-provided values. This is the primary interaction method, not CSS selectors.

**Explicit confirmation gate (required):**
Before submitting any form, the agent must surface a summary to the user and wait for explicit "yes, submit" confirmation. This is enforced at the tool level, not just by prompt engineering.

**Flow:**
```
AI: "I found the restaurant's booking form. Here's what I'll submit:
     - Name: Kayo
     - Date: Saturday, April 12
     - Time: 19:00
     - Party: 2 people
     - Special requests: Window seat if possible

     Ready to submit? (yes / make changes)"

User: "yes"

AI: [Playwright fills and submits the form]
    "Done! Confirmation received. Check your email."
```

---

### Handler 3: Phone Only

Many quality restaurants, especially 3.5+ Tabelog-rated or traditional establishments, only accept phone reservations. This is a high-value handler for tourists.

**What the AI produces:**

1. **Full Japanese script** with the reservation request filled in:
   ```
   「もしもし、予約をお願いしたいのですが、
   4月12日（土）の夜7時に、2名で席を取ることはできますか？
   名前はカヨと申します。」
   ```

2. **Romaji phonetics** for non-Japanese speakers:
   ```
   "Moshi moshi, yoyaku wo onegai shitai no desu ga,
   Shigatsu jūni-nichi, doyōbi no yoru shichi-ji ni,
   ni-mei de seki wo toru koto wa dekimasu ka?
   Namae wa Kayo to mōshimasu."
   ```

3. **Katakana name conversion** (e.g. "Michael" → マイケル, "Sarah" → サラ) — auto-generated from the user's name

4. **Calling hours guidance:**
   > "Best times to call: 10:00–11:30 or 14:30–17:00. Avoid calling during lunch (12:00–14:00) or dinner service (18:00–21:00) — you likely won't get through and it's poor etiquette."

5. **Written alternatives if available:**
   - LINE message template (if restaurant has a LINE account)
   - Email template in Japanese (for foreign visitors who can explain they are non-Japanese-speaking)
   > "You can also try messaging them on Instagram (@handle) — many restaurants will accommodate non-Japanese speakers in writing."

---

### Handler 4: Walk-in Only

```
AI: "This restaurant doesn't accept reservations. Here's what you need to know:
     - Opens: 11:30 AM
     - Best arrival: 10–15 minutes before opening to join the queue
     - Typical wait on weekends: 30–60 minutes
     - Seats: 12 counter seats"
```

---

## Detection Layer

### How we determine reservation method

**Priority order:**

1. **Curated restaurant DB** (primary for demo/Phase 1) — Seed a local SQLite table with popular restaurants pre-annotated with their booking method. More reliable than dynamic detection. Refresh manually as needed.

2. **Google Places API** — `reservable` and `reservations_url` fields. Useful signal but unreliable in Japan (these fields have inconsistent coverage; `reservations_url` often points to homepage, not booking page). Use as a hint, not ground truth.

3. **Cached scrape results** — When a restaurant isn't in the curated DB, fetch its Tabelog listing page via Playwright (sidecar) to detect the booking button. Cache the result in SQLite with a TTL of 7 days. **Static `fetch()` won't work** — Tabelog uses JavaScript rendering. This requires the Playwright sidecar to be running.

4. **Fallback: ask the user** — If confidence is low, the AI asks: "Do you know if this restaurant books through Tabelog, Hot Pepper, or another way?"

**Detection tool output:**
```typescript
detect_reservation_method(restaurant_id, name, website_url?) → {
  method: "tabelog" | "hotpepper" | "gurunavi" | "ikkyu" | "omakase" |
          "tableall" | "openTable" | "direct_form" | "phone" | "walkin",
  platform_url?: string,      // direct link to reservation page (not homepage)
  phone_number?: string,
  multiple_platforms?: string[], // if restaurant is on both Tabelog and Hot Pepper
  confidence: "high" | "low",
  ikkyu_cancellation_policy?: string  // if method is "ikkyu"
}
```

**Multi-platform disambiguation:** If a restaurant is on both Tabelog and Hot Pepper, the AI asks: "This restaurant is bookable on both Tabelog and Hot Pepper. Which do you have an account with?"

---

## New Tool Set

```typescript
// Replace the single make_reservation with:

detect_reservation_method(restaurant_id, restaurant_name, website_url?)

generate_platform_deeplink(
  platform: "tabelog" | "hotpepper" | "gurunavi" | "ikkyu" | ...,
  restaurant_platform_url: string,
  date: string,       // YYYY-MM-DD
  time: string,       // HH:MM
  party_size: number
) → { url: string, instructions: string }

generate_phone_script(
  restaurant_name: string,
  date: string,
  time: string,
  party_size: number,
  customer_name: string,
  preferred_language: "en" | "ja"
) → { japanese_script: string, romaji: string, katakana_name: string, calling_hours: string }

// Kept from existing:
confirm_reservation_intent(summary: object) → awaits user yes/no before any action

reserve_via_direct_form(    // Phase 2, Playwright sidecar only
  form_url: string,
  booking_details: BookingDetails
) → { success: boolean, confirmation_id?: string, error?: string }
```

---

## Database Schema Changes

```prisma
model Booking {
  // existing fields...
  reservationMethod    String    // "tabelog" | "hotpepper" | "ikkyu" | "direct_form" | "phone" | "walkin"
  platformUrl          String?   // deeplink used
  platformConfirmId    String?   // confirmation # from platform (if captured)
  platformName         String?   // human-readable: "Tabelog", "Hot Pepper Gourmet"
  status               String    // "pending" | "confirmed" | "cancelled" | "pending_confirmation"
  phoneScript          String?   // for phone bookings
}

model RestaurantReservationMethod {
  id              String   @id @default(cuid())
  placeId         String   @unique
  restaurantName  String
  method          String
  platformUrl     String?
  phoneNumber     String?
  detectedAt      DateTime
  cachedUntil     DateTime // TTL for scrape results
}
```

---

## Phased Implementation

### Phase 1 — Guidance System (no browser automation)
Deliverables that work immediately, provide real user value, and carry zero ToS risk:

- [ ] Schema migration: add `reservationMethod`, `platformUrl`, etc. to Booking model
- [ ] Add `RestaurantReservationMethod` cache table
- [ ] Seed curated DB: 20+ popular Tokyo restaurants with annotated booking methods
- [ ] `detect_reservation_method` tool (curated DB + Google Places hints)
- [ ] Deep-link handoff handler (Tabelog, Hot Pepper, Gurunavi, Ikkyu, OMAKASE)
- [ ] Ikkyu warning message (cancellation fee / credit card required)
- [ ] Phone guidance handler: Japanese script + romaji + katakana name + calling hours + LINE/email alternative
- [ ] Walk-in handler: hours + queue tips
- [ ] Multi-platform disambiguation flow
- [ ] Update `get_user_bookings` to show `reservationMethod` and `platformName`
- [ ] UI: show platform badge on booking cards (Tabelog logo, Hot Pepper logo, etc.)

### Phase 2 — Direct Form Automation (Playwright sidecar)
For restaurants with their own booking form (no login, no ToS issue):

- [ ] Playwright sidecar server (separate Node.js process, port 3001)
- [ ] `reserve_via_direct_form` tool (calls sidecar via HTTP)
- [ ] `confirm_reservation_intent` gate — hard stop before any form submission
- [ ] Claude vision screenshot-based form interaction (handles Japanese UI)
- [ ] Japanese error message translation
- [ ] `status: "pending_confirmation"` state in Booking model
- [ ] Progress streaming during automation (SSE updates while Playwright is running)

### Phase 3 — Platform Automation (requires user auth first)
Only viable after user accounts are added to the app:

- [ ] User authentication (required prerequisite)
- [ ] OAuth-style session capture: user logs into Tabelog/Hot Pepper in a browser popup; app captures the session cookie — credentials never enter the chat
- [ ] Tabelog Playwright handler (date picker, slot selection, form fill, submit)
- [ ] Hot Pepper Playwright handler
- [ ] `cancel_reservation_on_platform` tool (cancels both locally and on the platform)
- [ ] `get_platform_booking_status` tool (verify booking still active on platform)
- [ ] Session context isolation per user

### Phase 4 — Robustness
- [ ] 2FA SMS handling (pause automation, stream prompt to user, continue)
- [ ] Mid-booking failure recovery + `pending_confirmation` state handling
- [ ] Detection cache refresh strategy
- [ ] Rate limiting and per-user request throttling
- [ ] Gurunavi handler
- [ ] Ikkyu handler (note: requires handling credit card pre-auth)

---

## What NOT to Build

- **Credential-in-chat flow** — Removed entirely. Typing passwords into a chat interface is a security anti-pattern. Credentials enter the Claude API payload, may appear in server logs, and erodes user trust. Not acceptable even for demo.
- **Static `fetch()` scraping** — Tabelog and Hot Pepper require JavaScript rendering. Use Playwright sidecar or don't scrape.
- **Playwright inside Next.js API routes** — Incompatible with serverless deployment. Always runs in the sidecar.

---

## What the Chat Flow Looks Like (Phase 1)

```
User: "Book a table at Narisawa for 2 people, Saturday 7pm"

AI:  Searching... Found Narisawa (Minami-Aoyama). Checking how they take reservations...
     Narisawa books through Tabelog.

     Here are the details I'll pre-fill for you:
     📅 Saturday, April 12 · 19:00 · 2 guests

     → Open Tabelog reservation page (pre-filled)

     On Tabelog: select your time slot, confirm your name and contact info, then submit.
     You'll receive a confirmation email from Tabelog directly.

     Need help navigating the Tabelog page? I can walk you through it step by step.

---

User: "What about Saito — the sushi place in Azabu?"

AI:  Sushi Saito only accepts reservations by phone.
     Phone: 03-XXXX-XXXX

     Here's your script:
     「もしもし、予約をお願いしたいのですが、4月12日土曜の夜7時に
      2名で伺えますか？サイトウと申します。」

     Phonetic guide:
     "Moshi moshi, yoyaku wo onegai shitai no desu ga, shigatsu jūni-nichi,
     doyōbi no yoru shichi-ji ni ni-mei de ukagaemasu ka? Saitō to mōshimasu."

     ⏰ Best time to call: 10:00–11:30 or 14:30–17:00
     ⚠️  Do not call during lunch or dinner service.
```

---

## Known Risks

| Risk | Mitigation |
|------|-----------|
| Platform UI changes (Phase 3) | Screenshot/vision-based interaction is more resilient than CSS selectors |
| Detection confidence low for unknown restaurants | Curated DB covers top restaurants; fallback asks user |
| Ikkyu cancellation fees | Always shown as explicit warning before user opens the link |
| Playwright sidecar crash | Next.js API returns error; user shown manual deep-link fallback |
| Commercial use of Playwright against platforms | Phase 3 only; apply for partner API for production |
