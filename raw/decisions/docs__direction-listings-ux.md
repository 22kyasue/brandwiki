<!-- Ingested from: docs/direction-listings-ux.md -->
<!-- Mtime: 2026-04-13T08:43:51.006Z -->

# Direction: Faster, Richer Restaurant Listings

**Problem statement:** Search results feel slow, sparse (capped at 5), and hard to pivot from. Once a result set appears in chat, it's gone — there's no persistent view of what's been found across the session.

**Goals:**
- Immediate sense of abundance (many options, not 3–5)
- Spatial/visual context for Tokyo neighborhoods
- Instant pivot without re-typing to the chat

---

## Direction 1 — Live Session Map Panel ★ Recommended

Promote the existing Leaflet infrastructure (`ChatMiniMapInner.tsx`, `MapView.tsx`) into a **persistent panel** that accumulates all search results across the entire session.

**How it works:**
- Pins drop in real-time as each search completes
- Results persist and deduplicate across all tool calls (not scoped per message)
- Click a pin → pre-fills chat with "tell me more about [name]"
- Filter bar on the panel: cuisine, price level, open now, area — each chip triggers a new search

**Why this fits:**
- Tokyo is spatially meaningful — Shibuya vs Ebisu vs Daikanyama is obvious on a map, not a list
- Leaflet is already wired; `ChatMiniMapInner` already renders per-message, just needs to go session-level
- Solves "pivot instantly" natively — the map is always visible, no re-chatting required

**Concrete implementation plan:**
1. Session-level results store — React context or `useReducer` in `ChatInterface.tsx`
2. Feed all `search_restaurants` tool results into the store, deduplicate by `id`
3. Promote map to a toggleable panel (slide in from right on desktop, bottom sheet on mobile)
4. Filter chips on panel that append constraints to the next chat message
5. Bump backend result limit 5 → 10 in `tools.ts:634`
6. Extend speculative prefetch to cover all results (currently only first 3)

**Lift:** Medium (3–5 days). No new dependencies.

---

## Direction 2 — Persistent Results Drawer

Split-pane layout: chat on the left, results panel on the right. The panel holds a running list of everything found this session — deduplicated, sortable by rating / price / distance. New results slide in at the top.

**Why:** Zero new interaction model — users know how to scroll a list. Think Perplexity's source panel or Airbnb list+map.

**Lift:** Low-medium (1–3 days). Mostly CSS layout + session store (same store Direction 1 needs).

**Note:** Can be shipped as a stepping stone before the full map panel.

---

## Direction 3 — Canvas / Shortlist Board

A drag-rearrangeable card board. Restaurants accumulate as Yoyaku finds them. Swipe left to dismiss, drag to a "considering" lane. Feels like a personal moodboard rather than AI output.

**Why:** High expressiveness. Makes the shortlisting feel user-owned, not AI-dictated.

**Risk:** Mobile drag is consistently janky. Also needs a defined semantic for "dismiss" — does it signal the AI to avoid re-suggesting that place?

**Lift:** High (1–2 weeks to do well). Best treated as a desktop-only stretch goal.

---

## Direction 4 — Inline Filter Chips ★ Do this regardless

After each result set, render quick-filter chips directly below the cards:

```
[Ramen] [Sushi] [Under ¥3000] [Open now] [Near station] [More like these]
```

Tapping a chip either filters the current results inline OR fires a new search with that constraint added to the context.

**Why:** 1 day of work, immediate impact. Works as a complement to any of the above directions.

---

## Direction 5 — Bump Limit + Progressive Reveal

Raise the backend cap from 5 → 10 and reveal cards as they arrive (skeleton → filled) rather than waiting for all results. Extend speculative prefetch from 3 → all results.

**Why:** Fastest to ship, makes the result set feel more abundant immediately.

**Lift:** Small (a few hours). Should be done as part of any of the above.

---

## Recommended Stack

| Phase | Work | Impact |
|-------|------|--------|
| 1 | Bump limit 5→10, prefetch all | Immediate sense of abundance |
| 2 | Inline filter chips | Instant pivot, no new panels |
| 3 | Session-level results store | Foundation for everything below |
| 4 | Persistent results drawer | Searchable history, low lift |
| 5 | Live map panel | Full spatial experience |
| 6 | Canvas board (desktop only) | High expressiveness, stretch |

---

## Current Code Reference

| Location | What it controls |
|----------|-----------------|
| `backend/src/lib/tools.ts:634` | `results.slice(0, 5)` — the hard cap |
| `backend/src/lib/tools.ts:646` | Prefetch loop — currently only first 3 |
| `frontend/src/components/ChatMiniMapInner.tsx` | Per-message mini map — promote to session-level |
| `frontend/src/components/MapView.tsx` | Standalone map page — reuse Leaflet setup |
| `frontend/src/components/MessageBubble.tsx:174` | Where `restaurantCards` are extracted per message |
| `frontend/src/components/ChatInterface.tsx` | Where session-level store should live |
