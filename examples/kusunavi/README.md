# Kusunavi (クスナビ) Brand Wiki — Example

A live example of `brandwiki-engine` compiled output for [Kusunavi](https://github.com/22kyasue/kusunavi), a Japanese family-medication risk-management app.

**31 articles** across **9 categories**, ~6,500 words, all in Japanese.

## View it locally

From the repo root:

```bash
cd examples/kusunavi
brandwiki serve
# open http://localhost:8787
```

Or use watch mode for live reload:
```bash
brandwiki watch
```

## What you'll see

- **Main page dashboard** — Browse by category, featured article, recently updated, wiki health, interactive backlink graph
- **Articles** — Wikipedia-style with sticky left sidebar (nav + contents), right infobox, references, category footer
- **Categories** — 3 view modes (Cards / List / A-Z)
- **Interactive graph** — D3 force layout, drag nodes, Ctrl+scroll to zoom, hover for connections

## Categories in this wiki

| ID | 名前 | Articles |
|---|---|:---:|
| 01-brand | ブランド | 5 |
| 02-product | プロダクト | 5 |
| 03-medical | 医療ロジック | 5 |
| 04-design | デザインシステム | 2 |
| 05-architecture | アーキテクチャ | 5 |
| 06-content | コンテンツ | 1 |
| 07-operations | 運用 | 1 |
| 08-history | 開発史 | 1 |
| 09-market | マーケット | 1 |

## Notes

- This snapshot contains only the compiled `wiki/` output and `config.json`.
- The raw source material (`raw/`) — which included `CLAUDE.md`, code snapshots, and agent work logs — is **not** published for privacy.
- To fully reproduce this, you'd need the original project at `22kyasue/kusunavi` plus the ingest rules in `config.json`.

## Template

Generated from the [`medical-app`](../../templates/medical-app/) template in the brandwiki-engine repo.
