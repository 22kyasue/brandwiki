---
title: Restaurant Search — Google Places + Tabelog Scraper
category: 02-product
status: draft
confidence: high
updated: 2026-04-13
sources: [raw/code-snapshots/backend/backend__src__lib__tools.ts, raw/notes/CLAUDE.md]
---

## Dual-Source Strategy

Every search runs Google Places and the Tabelog scraper in parallel. Source selection depends on whether cuisine is specified:

| Condition | Primary Source | Reason |
|-----------|---------------|--------|
| Cuisine specified | Google Places | Reliable keyword-based search |
| No cuisine | Tabelog DB / live scrape | Better Tokyo neighborhood coverage |

Results are deduplicated by `id`, merged, and capped at 5 (hard cap at `tools.ts:634`).

## Search Fallback Chain

1. Primary search (Tabelog DB + Google Places in parallel)
2. If cuisine filter returns nothing from Tabelog: Google becomes primary
3. If no results in specified neighborhood: try neighborhood→ward mapping (e.g. `hongo` → `Bunkyo`)
4. If still empty: live Tabelog scrape (area discovery, no cuisine filter — Tabelog ignores filter params)
5. If cuisine is specified and still empty: `findRelaxedSearchFallback()` tries progressively broader location queries
6. Returns `fallbackMessage` explaining the location substitution

## Neighborhood → Area Mapping

The scraper DB stores restaurants at ward/area level, not sub-neighborhood. A lookup table maps common names:

```
shimokitazawa → Shibuya | nakameguro → Shibuya | kagurazaka → Shinjuku
hongo → Bunkyo | azabu → Roppongi | kanda → Akihabara
```

## Result Shape

Each search result includes:
- `id`, `name`, `address`, `rating` (Tabelog), `googleRating`, `priceLevel`, `cuisine`
- `photoUrl` (scraped or Unsplash fallback by cuisine category)
- `hasOnlineBooking`, `tabelogUrl`, `ratingCount`, `priceRange`
- `lat`/`lng` coordinates

## In-Memory TTL Caches

| Cache | TTL | Purpose |
|-------|-----|---------|
| `searchCache` | 5 min | Avoid redundant search API calls within a session |
| `detailsCache` | 10 min | Avoid redundant detail fetches |

## Speculative Prefetch

After every search, `loadRestaurantDetails()` is called fire-and-forget on the first 3 results to warm `detailsCache`. This makes subsequent `check_availability` calls feel instant.

**Known gap:** Prefetch covers only 3 results. Direction: extend to all results when result cap is raised to 10. (See [[listings-ux-direction]])

## Availability Check

`handleCheckAvailability()`:
1. Fetches Tabelog availability via scraper (2s timeout; falls back to `phone_only` on timeout)
2. Checks if the requested time slot is exactly available
3. If not available at requested time: runs `findNearbyAvailabilitySuggestion()` (4s timeout) to find the closest restaurant with an open slot nearby

## Photo Fallbacks

If a restaurant has no scraped photo, `getCuisinePhotoFallback()` returns a curated Unsplash image matched by cuisine type (sushi, ramen, Italian, yakiniku, etc.).

See also: [[reservation-system]], [[listings-ux-direction]], [[claude-agent-tool-loop]]