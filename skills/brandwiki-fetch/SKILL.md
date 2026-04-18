---
name: brandwiki-fetch
description: "Fetch external sources (Wikipedia articles, competitor info, URLs) into the brandwiki raw directory. Use to pull in market research, competitor data, and industry context from the web."
origin: custom
---

# /brandwiki-fetch - Fetch External Sources

Pull external information (Wikipedia, URLs) into the brandwiki pipeline.

## When to Use

- User says "fetch competitors", "add external sources", "pull Wikipedia data"
- User types `/brandwiki-fetch`
- User wants to research rival companies, partners, or industry context

## Usage

```
/brandwiki-fetch                # fetch all configured externalSources
/brandwiki-fetch --force        # re-fetch even if already downloaded
/brandwiki-fetch add <topic>    # add a new Wikipedia article to config and fetch it
```

## Workflow

### Step 1: Verify Setup

1. Find `.brandwiki/config.json`
2. Check if `externalSources` is configured

### Step 2a: If externalSources exists — Fetch

```bash
CLI="C:/Users/stake/githubproject/brandwiki-engine/dist/cli.js"
node $CLI fetch --verbose
```

This fetches Wikipedia articles and URLs, saves to `.brandwiki/raw/external/`.

### Step 2b: If no externalSources — Help Configure

Ask the user what they want to research. Common patterns:

**For apps/products:**
```json
{
  "externalSources": [
    {
      "type": "wikipedia",
      "articles": ["Competitor A", "Competitor B", "Industry Term"],
      "language": "ja",
      "category": "09-market",
      "tags": ["competitor"]
    }
  ]
}
```

**For the `add` subcommand:**
1. Read current `externalSources` from config
2. Add the new article/URL to the appropriate source group
3. Write config back
4. Run fetch

### Step 3: Report

```
brandwiki fetch complete
  Fetched: N sources (M Wikipedia, K URLs)
  Skipped: J (already downloaded)
  Failed: F
  Stored in: .brandwiki/raw/external/

Next: run /brandwiki-compile to incorporate into wiki articles
```

### Step 4: Offer to Compile

Ask: "Fetch complete. Run compile now to generate wiki articles from these sources? (uses LLM credits)"

## What Gets Fetched

### Wikipedia articles
- Full article text (plain text extract)
- Description / summary
- Categories (e.g., "日本のドラッグストア")
- Outgoing links → auto-filtered for company names → saved as `[[backlinks]]`
- Stored as `.brandwiki/raw/external/wiki-<slug>.md`

### URLs
- Page content (HTML stripped to text)
- Title extracted from `<title>` tag
- Stored as `.brandwiki/raw/external/url-<slug>.md`

## Relationship Detection

Wikipedia fetcher auto-detects related companies by filtering outgoing links for:
- 株式会社, グループ, ホールディングス
- Industry-specific terms (薬局, ドラッグ, etc.)

These become `[[backlink]]` references, so after compile they appear as edges in the Article Connections graph.
