---
title: Engineering Rules — Karpathy Principles
category: 05-operations
status: draft
confidence: high
updated: 2026-04-13
sources: [raw/notes/CLAUDE.md, raw/decisions/docs__agent-zones.md]
---

## The Five Rules

These are project-level engineering constraints, not suggestions. They apply to every change.

1. **Name the file first.** Can't name the exact file → not ready to code. Start there.
2. **One tool, one responsibility.** No extra abstraction layers.
3. **Change only what the bug requires.** Don't broaden scope.
4. **Preserve working behavior.** Outside the failing path, nothing changes.
5. **Success = user completes a booking.** Not "code looks cleaner."

## Hot Path Protocol

Before editing any of these files, state the file name and confirm which surface it affects (Claude tool loop / scraper API / UI / call pipeline):

- `backend/src/lib/claude.ts`
- `backend/src/lib/tools.ts`
- `frontend/src/components/ChatInterface.tsx`
- `autocall/src/conversation.ts`
- `autocall/src/twilio-stream.ts`

## New Route Rule

Never add logic to an existing route file when building a new feature. Always:
1. Create `backend/src/routes/<feature>.ts`
2. Register with a single `app.use()` line in `backend/src/server.ts`

## Zone Acceptance Tests

| Zone | Done when |
|------|-----------|
| frontend | User can complete search → results → booking in the UI |
| backend | `POST /api/chat` returns correct tool results end-to-end |
| scraper | `GET /search?q=sushi&area=shinjuku` returns real Tabelog data |
| autocall | Twilio call connects, Deepgram→Haiku→Cartesia pipeline runs, DB updated with confirmed/failed result |

## Never Write To

- `backend/dist/` — auto-generated, overwritten on every build
- Root-level plan files — use `docs/` directory

See also: [[architecture-overview]], [[zone-ownership]]