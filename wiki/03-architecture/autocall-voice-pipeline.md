---
title: Autocall Voice Pipeline
category: 03-architecture
status: draft
confidence: high
updated: 2026-04-13
sources: [raw/notes/CLAUDE.md, raw/code-snapshots/autocall/autocall__src__conversation.ts, raw/decisions/docs__agent-zones.md]
---

## Purpose

The autocall service (`autocall/`, port 3003) is a custom Twilio + Deepgram + Cartesia voice pipeline that replaces a previous Bland.ai integration. It places outbound calls to Tokyo restaurants to make reservations on the user's behalf, conducting the conversation in keigo (formal Japanese).

**Cost advantage:** ~60–70% cheaper than Bland.ai with full vendor control.

## Latency Architecture

**Target:** ~450ms perceived latency per AI turn

| Stage | Budget |
|-------|--------|
| Deepgram STT | ~100ms |
| Claude Haiku first token | ~200ms |
| Cartesia TTS | ~100ms |
| Twilio delivery | ~50ms |

**Sentence pipelining:** TTS fires on sentence 1 while Claude Haiku is still generating sentence 2 — implemented by yielding sentences from `respondStream()` one at a time via an async generator.

**Turn 0 skip:** `openingGreeting()` returns a hardcoded greeting string with no LLM call, saving ~200ms.

**Barge-in:** Continuous Deepgram STT with a Japanese backchannel filter (`BACKCHANNEL_RE`) to suppress filler words (「はい」「そうですね」) from triggering AI turns.

## Conversation Design (`conversation.ts`)

The `ReservationConversation` class drives the keigo loop:

```typescript
const conversation = new ReservationConversation(ctx);
const greeting = await conversation.openingGreeting(); // no LLM

// Each restaurant utterance:
const { sentences, done } = conversation.respondStream(staffUtterance);
for await (const sentence of sentences) { /* pipe to Cartesia TTS */ }
const result = await done; // ConversationResult | null
```

### ConversationResult States

| Status | Meaning |
|--------|---------|
| `confirmed` | Restaurant confirmed the reservation; details extracted |
| `alternative` | Restaurant offered a different time (surfaced to user to accept/decline) |
| `unavailable` | Fully booked, no alternative offered |
| `error` | Unexpected end / call dropped |

### Terminal Signals

Claude Haiku embeds these signals at the end of its response text (stripped before TTS):

- `[DONE:confirmed:<date+time>]`
- `[DONE:alternative:<HH:MM>]`
- `[DONE:unavailable]`
- `[DONE:error:<reason>]`

## System Prompt Rules (Keigo Enforcement)

The conversation system prompt enforces:
- Never say 「もしもし」(only for answering, not placing calls)
- Use 「～でしょうか」not 「～ですか」(softer register)
- Use 「～と申します」for name introductions
- Use 「かしこまりました」when acknowledging, not 「わかりました」
- Surface alternative times with `[DONE:alternative:...]` without accepting/declining on user's behalf

## DB Status Fix (Key Design Decision)

The `registerOnDone()` callback updates the DB **only when the call actually ends**, NOT when `placeCall()` returns. This fixed a prior bug where calls were marked complete immediately on initiation.

## Key Files

| File | Role |
|------|------|
| `autocall/src/conversation.ts` | Claude Haiku keigo loop, sentence streaming |
| `autocall/src/twilio-stream.ts` | Real-time audio pipeline (WebSocket + Deepgram + Cartesia) |
| `autocall/src/pipeline.ts` | Twilio call initiation + state management |
| `autocall/src/server.ts` | HTTP routes + WebSocket endpoint `/media-stream/:callId` |

**Removed:** `bland.ts`, `sdk.ts` — both deleted when pipeline was rebuilt.

## Status

Architecture is complete. **Not yet testable end-to-end** — Twilio, Deepgram, Cartesia, and ngrok `AUTOCALL_BASE_URL` keys must be filled in `.env.local` before any live call can be placed.

See also: [[claude-agent-tool-loop]], [[reservation-system]]