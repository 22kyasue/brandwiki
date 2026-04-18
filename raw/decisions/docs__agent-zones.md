<!-- Ingested from: docs/agent-zones.md -->
<!-- Mtime: 2026-04-12T15:58:10.093Z -->

# Agent Zones — Ownership Map

This is the law for parallel AI work. Every directory has exactly one owner.
Two agents never write the same file at the same time.

---

## Zone Map

| Zone | Workdir | Owner terminal | What it owns |
|------|---------|---------------|--------------|
| **frontend** | `frontend/` | Terminal A | All UI — pages, components, hooks, contexts, types |
| **backend** | `backend/src/` | Terminal B | All API logic — routes, lib, jobs, types |
| **scraper** | `scraper/src/` | Terminal C | Tabelog scraper, API server, formatters |
| **autocall** | `autocall/src/` | Terminal D | Custom Twilio+Deepgram+Cartesia voice pipeline, personas |
| **docs** | `docs/` | Any (read-mostly) | Plans, ADRs, roadmap — never blocks builds |

---

## Hot Paths — One Agent At A Time

These three files are the highest-collision risk in the repo. If two agents touch them simultaneously, the booking flow breaks.

| File | Why it's hot |
|------|-------------|
| `backend/src/lib/claude.ts` | Claude tool loop — core agent orchestration |
| `backend/src/lib/tools.ts` | All tool definitions and execution — every AI feature goes through here |
| `frontend/src/components/ChatInterface.tsx` | UI entry point for the entire chat experience |

**Protocol for hot paths:**
1. Before editing, check `git status` — if another agent has modified the file, pull or wait.
2. Keep your change to the smallest possible surface area — name the exact function before touching anything.
3. Never refactor a hot path as a side effect of a feature change.

---

## File Ownership Rules

### frontend agent (Terminal A)
**Writes:**
- `frontend/src/components/`
- `frontend/src/app/` (pages + API proxies only, not business logic)
- `frontend/src/hooks/`
- `frontend/src/contexts/`
- `frontend/src/types/`
- `frontend/public/`

**Reads (never writes):**
- `backend/src/types/index.ts` — to understand API shapes
- `docs/` — for context

**Never touches:**
- `backend/src/lib/`
- `backend/src/routes/`
- `scraper/`
- `autocall/`

---

### backend agent (Terminal B)
**Writes:**
- `backend/src/lib/`
- `backend/src/routes/`
- `backend/src/jobs/`
- `backend/src/types/`
- `backend/prisma/schema.prisma`

**Reads (never writes):**
- `frontend/src/types/` — to understand what the UI expects
- `docs/`

**Never touches:**
- `frontend/src/components/`
- `scraper/src/`
- `autocall/src/`

---

### scraper agent (Terminal C)
**Writes:**
- `scraper/src/`
- `scraper/prisma/`

**Reads:**
- `docs/`

**Never touches:**
- `backend/`
- `frontend/`
- `autocall/`

---

### autocall agent (Terminal D)
**Writes:**
- `autocall/src/`
- `autocall/prisma/`
- `autocall/personas/`

**Reads:**
- `docs/`

**Never touches:**
- `backend/`
- `frontend/`
- `scraper/`

---

## Running Two Terminals in Parallel — The Right Way

### Option 1: Workdir isolation (default)
Each terminal posts tasks with its own workdir:
```bash
# Terminal A — frontend only
curl -s -X POST http://localhost:3747/task \
  -H "Content-Type: application/json" \
  -d '{"prompt":"<task>","agent":"auto","workdir":"C:/Users/Kotar/githubproject/yoyaku/frontend"}'

# Terminal B — backend only
curl -s -X POST http://localhost:3747/task \
  -H "Content-Type: application/json" \
  -d '{"prompt":"<task>","agent":"auto","workdir":"C:/Users/Kotar/githubproject/yoyaku/backend"}'
```
Safe as long as each terminal stays inside its zone.

### Option 2: Git worktrees (maximum isolation)
When two terminals might touch shared files, use git worktrees — completely separate directory trees:
```bash
# Spin up isolated frontend workspace
git worktree add ../yoyaku-fe-work -b feat/my-frontend-change

# Spin up isolated backend workspace
git worktree add ../yoyaku-be-work -b feat/my-backend-change
```
Or use the helper:
```bash
bash scripts/worktree.sh frontend feat/my-feature
bash scripts/worktree.sh backend feat/my-feature
```
Each worktree is a fully independent file tree. Writes to `../yoyaku-fe-work/` are invisible to `../yoyaku-be-work/`. Zero collision possible.

---

## New Route Rule
Never add logic to an existing route file when building a new feature.
Create a new route file: `backend/src/routes/<feature>.ts`
Register it in `backend/src/server.ts` with a single `app.use()` line.
This prevents any merge conflict on route files.

---

## What "Done" Means Per Zone

| Zone | Acceptance test |
|------|----------------|
| frontend | User can complete search → results → booking in the UI |
| backend | `POST /api/chat` returns correct tool results end-to-end |
| scraper | `GET /search?q=sushi&area=shinjuku` returns real Tabelog data |
| autocall | Twilio call connects, Deepgram STT → Claude Haiku keigo → Cartesia TTS pipeline runs, DB updated with confirmed/failed result |
