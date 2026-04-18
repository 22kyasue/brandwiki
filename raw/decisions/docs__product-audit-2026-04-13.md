<!-- Ingested from: docs/product-audit-2026-04-13.md -->
<!-- Mtime: 2026-04-13T09:27:50.257Z -->

# Yoyaku Product Audit — 2026-04-13

## The Vision

User types a vague ask → gets one great recommendation → table is confirmed. Under a minute, zero friction. No Japanese required.

Current flow without Yoyaku:
1. Search Tabelog/Google
2. Read reviews, compare options
3. Click to restaurant site
4. Find out they only take reservations by phone
5. Call during business hours (often Japanese only)
6. Hope someone picks up
7. Get rejected, start over

That's 20–40 minutes of work. Yoyaku collapses it to one conversation.

---

## Biggest Strategic Advantage

**Zero adoption barrier for restaurants.** Every other booking platform has a cold-start problem — restaurants won't sign up until there are users, users won't come until there are restaurants.

Yoyaku skips this entirely. The restaurant doesn't know Yoyaku exists. They just get a phone call. From their perspective nothing changed. This means:

- Day 1 inventory = every restaurant in Tokyo with a phone number
- No sales team, no onboarding, no contracts
- Works on places that would never join a platform (small family places, high-end omakase)

---

## Current Gaps (in priority order)

### 1. Autocall has no API keys — nothing actually calls anyone yet

**The hard blocker.** The pipeline is architecturally complete but untested end-to-end. All four services need credentials:

| Service | What it needs |
|---------|--------------|
| Twilio | Account SID, Auth Token, phone number, Japan geographic permissions enabled |
| Deepgram | API key (STT) |
| Cartesia | API key (TTS) |
| ngrok | Authtoken + running tunnel → `AUTOCALL_BASE_URL` |

**Cost to test:** ~$5 total. Twilio has $15 free credit. Deepgram and Cartesia both give free credits on signup.

**Twilio gotcha:** Must manually enable Japan outbound calling under Account → Voice → Geographic Permissions → Japan ✓ or calls silently fail.

---

### 2. No UX during or after the call

After a user says "book this" there is currently:
- No "calling now..." state
- No progress indicator
- No "your table is confirmed" message
- No failure/alternative surfaced back to the user

This is the most important UI gap. The moment of "is this actually working?" is the entire product experience. Without it, users will assume nothing happened.

What needs to exist:
- **Calling state** in chat: "Calling Sushi Saito now... ⏳"
- **Polling loop**: `GET /api/calls/:id` until status is final
- **Success state**: "Confirmed — Tuesday 8pm, party of 2. They're expecting you."
- **Failure state**: "They're fully booked that night. Want me to try Thursday, or find somewhere else?"

---

### 3. Recommendation quality

Search returns results but the concierge isn't yet great at the vague-ask → single confident recommendation flow.

"Somewhere special for a date under ¥15k in Shibuya" should return one answer with a reason, not a list of five. The list-of-options pattern pushes the decision back to the user — that's exactly what Yoyaku is supposed to eliminate.

---

## What's Already Working

- Search: Google Places + Tabelog scraper returns real Tokyo restaurant data
- Chat: streaming SSE, full Claude tool loop
- Auth: JWT, email verification, password reset
- Bookings: create, cancel, manage, reminders
- Group rooms: invite, vote, confirm
- Autocall pipeline: architecture complete (DB status bug previously fixed)

---

## The Three Things That Need to Happen

1. **Get API keys in** → make one real call work end-to-end
2. **Build the calling/confirmation UX loop** → user sees what's happening and gets a result
3. **Sharpen recommendation quality** → one confident answer, not a list

Everything else is polish. The core loop is: **ask → recommend → call → confirmed.**
