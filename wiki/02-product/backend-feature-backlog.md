---
title: Backend Feature Backlog
category: 02-product
status: draft
confidence: high
updated: 2026-04-13
sources: [raw/decisions/docs__backlog-backend.md]
---

Items captured from product sessions with Kotaro. Backend engineers pick these up. Add items during product sessions with format: **What** / **Likely scope** / **UI status**.

## Queued

### Chat History Persistence

**What:** Conversations are lost on page refresh and new session. Users want to return to ongoing chats.

**Likely scope:**
- Store `messages[]` per user session in DB
- Return last N messages on `GET /api/chat/history`
- Associate with `userId` from auth token

**UI status:** Ready — the `messages` array in `useStreamingChat` hook just needs to be seeded from an API call on mount.

---

### Settings / Preferences API

**What:** No settings page exists. Users need: language preference, notification opt-in, default party size.

**Likely scope:** `GET/PATCH /api/users/me/preferences`. Frontend settings modal reads/writes this.

**UI status:** Not started.

---

### Help / FAQ Content Endpoint

**What:** No help or onboarding content in the app.

**Likely scope:** Could be static (frontend only). If dynamic: `GET /api/help` with FAQ items array.

**UI status:** Not started.

See also: [[project-overview]], [[security-bug-tracker]]