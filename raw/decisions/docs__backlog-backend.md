<!-- Ingested from: docs/backlog-backend.md -->
<!-- Mtime: 2026-04-11T22:18:51.563Z -->

# Backend Backlog — From Product Sessions

Items captured from Kotaro's feedback. Backend engineers pick these up.

---

## Queued

### Chat history persistence
- **What**: Conversations are lost on page refresh / new session. Users want to return to ongoing chats.
- **Likely scope**: Store `messages[]` per user session in DB. Return last N messages on `GET /api/chat/history`. Associate with `userId` from auth token.
- **UI is ready**: The `messages` array in `useStreamingChat` hook just needs to be seeded from an API call on mount.

### Settings / preferences API
- **What**: No settings page exists. Users need: language preference, notification opt-in, maybe default party size.
- **Likely scope**: `GET/PATCH /api/users/me/preferences`. Frontend settings modal reads/writes this.

### Help / FAQ content endpoint
- **What**: No help or onboarding content in the app.
- **Likely scope**: Could be static (just frontend), but if content is dynamic, expose `GET /api/help` with FAQ items.

---

## Notes
- Add new items here during product sessions with format: **What** / **Likely scope** / **UI status**
- UI engineer will mark "UI is ready" when frontend is wired up waiting for the endpoint.
