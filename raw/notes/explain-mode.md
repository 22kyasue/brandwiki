# Explain Mode — clickable context overlay

A devtools-style toggle in the yoyaku UI that lets anyone click on a UI element and see the context behind it: what it is, why it exists, recent changes (with rationale), open bugs, and a link to the relevant brandwiki article.

## How to enable

- Press `⌘.` / `Ctrl+.` in dev, OR click the small dot button bottom-left
- In production builds: append `?explain=1` to the URL (otherwise the panel does not render)

## How it works (data flow)

```
[click] → walks DOM up to find [data-explain="<key>"]
       → POST /api/explain/<key>
       → backend merges:
           - manifest entry (backend/src/data/explain-manifest.json — editable, hot-read)
           - CAR records   (../car-core/logs/records.jsonl filtered by entry.files)
           - bugs.md       (open `- [ ]` items mentioning entry.files)
       → side panel renders with sources badge showing how many items came from each source
```

## How to update an entry

Edit `backend/src/data/explain-manifest.json` — changes appear on next request, no rebuild, no restart. The backend reads the file fresh per call, with a 60s cache for performance.

## How to add a new entry

1. In the manifest, add a new top-level key (e.g. `"AuthModal"`) with the standard fields
2. In the React component, add `data-explain="AuthModal"` to its root `div`
3. Done — Explain Mode picks it up immediately

For Fragment-rooted components, wrap with `<div data-explain="X" style={{ display: "contents" }}>` so layout is unchanged.

## Live integration with CAR + bugs.md

- **CAR records** are filtered by file path against `entry.files` and merged into `recentChanges`. Risk levels normalize from CAR's `risk_level`. Records without rationale fall back to `thought` then `prompt`.
- **bugs.md** is parsed for unfixed `- [ ]` items mentioning any of `entry.files`. Severity comes from the `## Critical | High | Medium | Low` section header.
- Both sources are optional — the manifest entry is always returned even if CAR or bugs.md aren't accessible.

## Run order (when CAR is installed)

```bash
npm run car:export      # JSONL → markdown for brandwiki
npm run explain:refresh # car:export + brandwiki ingest
```

The `/api/explain/:key` endpoint reads CAR's JSONL directly — no export step needed for the panel itself. The export is only for brandwiki to ingest and surface CAR records as wiki articles.
