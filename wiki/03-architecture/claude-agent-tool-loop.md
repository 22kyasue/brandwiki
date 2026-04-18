---
title: Claude Agent Tool Loop (claude.ts)
category: 03-architecture
status: draft
confidence: high
updated: 2026-04-13
sources: [raw/code-snapshots/backend/backend__src__lib__claude.ts, raw/notes/CLAUDE.md]
---

## Overview

`backend/src/lib/claude.ts` is the core AI orchestration layer. It uses the `@anthropic-ai/claude-agent-sdk` `query()` function to drive a multi-turn agentic loop, exposes Yoyakun's tools via an in-process MCP server, and streams results back to the frontend as SSE chunks.

## Key Exports

- `streamAgent(userMessage, sessionId?, userId?, userContext?)` — async generator yielding `StreamChunk` events

## Stream Chunk Types

```typescript
| { type: "delta"; text: string }                          // text fragment
| { type: "tool_status"; toolName: string }               // tool is being called
| { type: "tool_result"; toolName: string; toolInput; result } // tool completed
| { type: "done"; toolCalls; sessionId; bookingState }    // session complete
```

## Yoyakun Persona (System Prompt)

The system prompt defines "Yoyakun" — a food-obsessed, bubbly Tokyo restaurant guide. Key behavioral rules encoded in the prompt:

- Classifies every incoming message into one of three modes before acting:
  - **BOOKING INTENT** — user wants to reserve but hasn't given details → ask all missing fields in one message
  - **RIGHT NOW** — user is hungry now → search immediately with `open_now=true`
  - **FUTURE PLANNING** — specific future date → broad search, then narrow
- Budget signals map deterministically to `price_level` (1–4)
- After `search_restaurants`, always call `get_restaurant_details` on the most relevant result
- After `check_call_status` returns `completed`, must read the transcript to classify outcome before responding

## Available Tools (MCP Server)

All tools are wrapped through `executeToolCall` in `tools.ts`:

| Tool | Purpose |
|------|---------|
| `search_restaurants` | Google Places + Tabelog search |
| `get_restaurant_details` | Full detail fetch (photos, hours, reviews, phone) |
| `check_availability` | Tabelog slot check with nearby-alternative fallback |
| `make_reservation` | Local DB write + optional Tabelog automation |
| `make_phone_reservation` | Initiates autocall pipeline |
| `check_call_status` | Polls autocall; reads transcript to determine outcome |
| `get_user_bookings` | Fetches user's booking history |
| `cancel_booking` | Cancels a booking |
| `modify_reservation` | Updates date/time or party size |
| `save_user_preferences` | Persists cuisine, dietary, area, phone, budget preferences silently |

## Booking State Machine

`BookingContext` is persisted per-session. `applyToolResult()` transitions the state machine after each tool result:

```
idle → collecting_details → checking_availability → confirming → booking → confirmed
                                                              ↘ calling → confirmed
                                                   ↘ failed
```

## Session Management

- Sessions are keyed by `sessionId` (from the SDK's `init` event)
- `getSession(sid)` / `setSession(sid, ctx)` — in-memory store
- **Known bug:** `setSession()` is called inside tool callbacks mid-stream; if the connection drops, the session persists partial state. Should only persist after the full stream completes. (See [[security-bug-tracker]])

## User Preferences

- Loaded at stream start via `getUserPreferences(userId)` and injected into the system prompt
- Saved silently via `save_user_preferences` tool whenever the user reveals preferences

See also: [[yoyaku-tool-definitions]], [[autocall-voice-pipeline]], [[security-bug-tracker]]