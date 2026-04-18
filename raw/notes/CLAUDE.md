<!-- Ingested from: CLAUDE.md -->
<!-- Mtime: 2026-04-13T10:38:24.387Z -->

# CLAUDE.md

## What This Is

Yoyaku is an AI restaurant booking app for Tokyo. Users chat with a Claude-powered concierge, find restaurants via Google Places + Tabelog scraper, and book via online reservation or outbound phone call.

**Primary acceptance test:** User searches → gets real results → completes a booking end-to-end.

---

## Architecture (4 services, fixed ports)

| Service | Dir | Port | What it does |
|---------|-----|------|-------------|
| Frontend | `frontend/` | 3000 | Next.js 16 chat UI + pages |
| Backend | `backend/` | 3001 | Express API — Claude tool loop, auth, bookings |
| Scraper | `scraper/` | 3002 | Tabelog scraper + restaurant data API |
| Autocall | `autocall/` | 3003 | Twilio outbound call pipeline (Deepgram STT → Claude Haiku keigo → Cartesia TTS) |

**Flow for phone booking:**
```
ChatInterface → POST /api/chat → claude.ts tool loop → tools.ts initiatePhoneCall()
  → POST autocall:3003/call → placeCall() → Twilio dials restaurant
  → TwiML webhook → WebSocket /media-stream/:callId
  → Deepgram STT → ReservationConversation (Haiku) → Cartesia TTS → Twilio
  → onDone() → DB updated (completed / alternative_offered / failed)
  → GET /api/calls/:id polls until final status
```

---

## Current State

### Working
- Search: Google Places + Tabelog scraper, returns real Tokyo restaurant data
- Chat: streaming SSE, full Claude tool loop
- Auth: JWT, email verification, password reset
- Bookings: create, cancel, manage, reminders
- Group rooms: invite, vote, confirm
- Autocall pipeline: architecture complete, DB status bug fixed (onDone callback pattern)

### Not Yet Working / Next Up
1. **Fill in autocall API keys** — Twilio, Deepgram, Cartesia, ngrok `AUTOCALL_BASE_URL`. Pipeline is untested end-to-end.
2. **Call pending UX** — no UI shows "calling... ⏳" or surfaces the result to the user after a phone booking
3. **Tabelog online booking** — `makeReservation` in tools.ts writes to local DB, real Tabelog flow is partially wired
4. **Security bugs** — see `docs/bugs.md` (20 open: rate limiting, JWT storage, SSRF)

---

## Hot Paths — Surgical Changes Only

| File | Surface area |
|------|-------------|
| `backend/src/lib/claude.ts` | Claude tool loop + agent orchestration |
| `backend/src/lib/tools.ts` | Every AI tool definition and execution |
| `frontend/src/components/ChatInterface.tsx` | Entire chat UI hot path |
| `autocall/src/conversation.ts` | Keigo call loop — latency-sensitive |
| `autocall/src/twilio-stream.ts` | Real-time audio pipeline — latency-sensitive |

**Rule:** Before touching any hot path, name the file and state whether it affects Claude tool loop / scraper API / UI / call pipeline. Change only what the bug requires.

---

## Zone Ownership

| Dir | Owns | Never touches |
|-----|------|---------------|
| `frontend/` | UI — components, pages, hooks, contexts | backend lib, routes, scraper, autocall |
| `backend/` | API — routes, lib, jobs | frontend components, scraper, autocall |
| `scraper/` | Tabelog scraper + data API | backend, frontend, autocall |
| `autocall/` | Voice pipeline, personas, Twilio/STT/TTS | backend, frontend, scraper |

**New route rule:** New route → new file `backend/src/routes/<feature>.ts`. Never add to existing files.

**Never write to:** `backend/dist/` (auto-generated), root-level plan files (use `docs/`).

---

## Autocall Pipeline — Key Design Facts

Built to replace Bland.ai. ~60-70% cheaper, full vendor control.

- **Latency target:** ~450ms perceived (STT 100ms + Haiku first token 200ms + Cartesia 100ms + Twilio 50ms)
- **Sentence pipelining:** TTS fires on sentence 1 while Claude generates sentence 2
- **Turn 0 skip:** `openingGreeting()` returns hardcoded greeting, no LLM call (~200ms saved)
- **Barge-in:** continuous Deepgram STT, Japanese backchannel filter (`BACKCHANNEL_RE`)
- **Terminal signals:** `[DONE:confirmed:...]`, `[DONE:alternative:HH:MM]`, `[DONE:unavailable]` — stripped from speech, drive `ConversationResult`
- **DB status fix:** `registerOnDone()` callback updates DB only when call actually ends — NOT when `placeCall()` returns
- **Key files:** `conversation.ts` (keigo loop), `twilio-stream.ts` (audio pipeline), `pipeline.ts` (Twilio call + state), `server.ts` (routes + WS)
- **Dead files removed:** `bland.ts`, `sdk.ts` — both deleted

---

## Process Management — CRITICAL

**Never run `taskkill /IM node.exe` or `taskkill //F //IM node.exe`.** Claude Code CLI runs as `node.exe` on Windows — this command kills the current session.

To restart dev servers, kill by port:
```bash
npx kill-port 3000 3001 3002 3003
```
Or kill by specific PID (get with `netstat -aon | findstr :3001`).

---

## Karpathy Rules

1. **Name the file first.** Can't name it → not ready to code.
2. **One tool, one responsibility.** No extra abstraction layers.
3. **Change only what the bug requires.** Don't broaden scope.
4. **Preserve working behavior.** Outside the failing path, nothing changes.
5. **Success = user completes a booking.** Not "code looks cleaner."

---

## Open Bugs

Tracked in `docs/bugs.md` — 20 open items across Critical/High/Medium/Low.

**Critical (block launch):** Rate limiting bypass, brute-force login, JWT in localStorage, session state race in Claude tool loop.

---

## Environment

Each service has its own `.env.local`. Required vars:
- Backend: `ANTHROPIC_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, `GOOGLE_PLACES_API_KEY`, `RESEND_API_KEY`
- Autocall: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `AUTOCALL_BASE_URL` (ngrok for dev), `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`
- Scraper: `DATABASE_URL`, `ANTHROPIC_API_KEY`
- Frontend: `NEXT_PUBLIC_BACKEND_URL`

Start all services: `npm run dev` from repo root (runs all 4 in parallel via concurrently).

---

## Brand Wiki

A compiled knowledge base lives at `.brandwiki/wiki/` — 13 articles across Overview, Product, Architecture, Operations, and History. Served at `http://localhost:8788`.

**Before making significant architectural or product decisions, read the relevant wiki article first.**

Key articles:
- `.brandwiki/wiki/01-overview/project-overview.md` — mission, goals, current state
- `.brandwiki/wiki/03-architecture/architecture-overview.md` — full system design
- `.brandwiki/wiki/03-architecture/claude-agent-tool-loop.md` — tool loop internals
- `.brandwiki/wiki/03-architecture/autocall-voice-pipeline.md` — voice call pipeline
- `.brandwiki/wiki/05-operations/security-bug-tracker.md` — open security issues

To query the wiki: `brandwiki query "your question"` (uses Claude with wiki as context).
To update after changes: `brandwiki ingest && brandwiki compile` (auto-ingest also runs via hook on every file edit).
