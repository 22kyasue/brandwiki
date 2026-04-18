---
title: Listings UX Direction — Faster, Richer Results
category: 02-product
status: draft
confidence: high
updated: 2026-04-13
sources: [raw/decisions/docs__direction-listings-ux.md]
---

## Problem

Search results are slow, sparse (hard cap at 5), and ephemeral — once a result set appears in chat it's gone, with no persistent view across the session.

## Recommended Implementation Stack

| Phase | Work | Impact | Lift |
|-------|------|--------|------|
| 1 | Bump limit 5→10 (`tools.ts:634`), prefetch all results | Immediate abundance | Hours |
| 2 | Inline filter chips after result cards | Instant pivot, no new panels | 1 day |
| 3 | Session-level results store | Foundation for directions below | 1–2 days |
| 4 | Persistent results drawer (chat left, results right) | Searchable history | 1–3 days |
| 5 | Live map panel (promote Leaflet to session-level) | Full spatial experience | 3–5 days |
| 6 | Canvas / shortlist board (desktop only, stretch) | High expressiveness | 1–2 weeks |

## Direction 1 — Live Session Map Panel ★ Recommended

Promote the existing Leaflet infrastructure (`ChatMiniMapInner.tsx`, `MapView.tsx`) from per-message to session-level:

- Pins drop in real-time as each `search_restaurants` tool call completes
- Results persist and deduplicate across all tool calls (keyed by restaurant `id`)
- Click a pin → pre-fills chat with "tell me more about [name]"
- Filter chips on the panel: cuisine, price level, open now, area → each triggers a new search
- Toggle: slide in from right (desktop) / bottom sheet (mobile)

**Implementation:**
1. Session-level results store via React context or `useReducer` in `ChatInterface.tsx`
2. Feed all `search_restaurants` tool results into the store
3. Promote `ChatMiniMapInner.tsx` to session-level panel
4. Add filter chips that append constraints to the next chat message
5. Bump backend limit: `tools.ts:634` `results.slice(0, 5)` → `results.slice(0, 10)`
6. Extend prefetch: `tools.ts:646` from first 3 → all results

## Direction 4 — Inline Filter Chips ★ Do regardless

After each result set, render chips directly below cards:
```
[Ramen] [Sushi] [Under ¥3000] [Open now] [Near station] [More like these]
```
Chips either filter the current results inline or fire a new search. 1 day of work, immediate impact.

## Relevant Code Locations

| Location | What it controls |
|----------|-----------------|
| `backend/src/lib/tools.ts:634` | `results.slice(0, 5)` — hard result cap |
| `backend/src/lib/tools.ts:646` | Prefetch loop — currently only first 3 results |
| `frontend/src/components/ChatMiniMapInner.tsx` | Per-message mini map — promote to session-level |
| `frontend/src/components/MapView.tsx` | Standalone map page — reuse Leaflet setup |
| `frontend/src/components/MessageBubble.tsx:174` | Where `restaurantCards` are extracted per message |
| `frontend/src/components/ChatInterface.tsx` | Where session-level store should live |

See also: [[restaurant-search]], [[chat-interface-frontend]]