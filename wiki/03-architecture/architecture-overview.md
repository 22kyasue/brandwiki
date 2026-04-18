---
title: System Architecture — Four Services
category: 03-architecture
status: draft
confidence: high
updated: 2026-04-13
sources: [raw/notes/CLAUDE.md, raw/decisions/docs__agent-zones.md]
---

## Services

| Service | Directory | Port | Responsibility |
|---------|-----------|------|----------------|
| Frontend | `frontend/` | 3000 | Next.js 16 chat UI — pages, components, hooks, contexts |
| Backend | `backend/` | 3001 | Express API — Claude tool loop, auth, bookings |
| Scraper | `scraper/` | 3002 | Tabelog scraper + restaurant data API |
| Autocall | `autocall/` | 3003 | Twilio outbound call pipeline (Deepgram STT → Claude Haiku → Cartesia TTS) |

Start all services: `npm run dev` from repo root (runs all 4 in parallel via `concurrently`).

## Phone Booking Flow (End-to-End)

```
ChatInterface
  → POST /api/chat
  → claude.ts tool loop
  → tools.ts initiatePhoneCall()
  → POST autocall:3003/call
  → placeCall() → Twilio dials restaurant
  → TwiML webhook → WebSocket /media-stream/:callId
  → Deepgram STT → ReservationConversation (Haiku) → Cartesia TTS → Twilio
  → onDone() → DB updated (completed / alternative_offered / failed)
  → GET /api/calls/:id polls until final status
```

## Hot Paths — Highest Collision Risk

These files have the broadest blast radius. Change only what a bug requires; name the exact function before touching anything.

| File | Why it's critical |
|------|------------------|
| `backend/src/lib/claude.ts` | Claude tool loop + agent orchestration — all AI behavior flows through here |
| `backend/src/lib/tools.ts` | Every AI tool definition and execution — every feature goes through here |
| `frontend/src/components/ChatInterface.tsx` | Entire chat UI hot path |
| `autocall/src/conversation.ts` | Keigo call loop — latency-sensitive |
| `autocall/src/twilio-stream.ts` | Real-time audio pipeline — latency-sensitive |

## Zone Ownership (Anti-collision Law)

Each directory has exactly one logical owner. Two agents or engineers never write the same file simultaneously.

| Zone | Writes | Never touches |
|------|--------|---------------|
| `frontend/` | Components, pages, hooks, contexts, types | backend lib, routes, scraper, autocall |
| `backend/` | Routes, lib, jobs, types, `prisma/schema.prisma` | frontend components, scraper, autocall |
| `scraper/` | All scraper src and prisma | backend, frontend, autocall |
| `autocall/` | Voice pipeline, personas, Twilio/STT/TTS | backend, frontend, scraper |
| `docs/` | Plans, ADRs, roadmap (read-mostly) | Never blocks builds |

**New route rule:** Never add to an existing route file. Create `backend/src/routes/<feature>.ts` and register in `backend/src/server.ts` with a single `app.use()` line.

**Never write to:** `backend/dist/` (auto-generated).

## Environment Variables

Each service has its own `.env.local`:

| Service | Required Vars |
|---------|--------------|
| Backend | `ANTHROPIC_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, `GOOGLE_PLACES_API_KEY`, `RESEND_API_KEY` |
| Autocall | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `AUTOCALL_BASE_URL`, `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY` |
| Scraper | `DATABASE_URL`, `ANTHROPIC_API_KEY` |
| Frontend | `NEXT_PUBLIC_BACKEND_URL` |

See also: [[autocall-voice-pipeline]], [[claude-agent-tool-loop]], [[zone-ownership]]