# brandwiki-engine

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)

LLM-powered brand wiki compiler. Ingest raw project material, compile a living Markdown knowledge base, and serve it as a **Wikipedia-style web UI** with an **interactive backlink graph**.

Inspired by [Andrej Karpathy's LLM Knowledge Bases pattern](https://x.com/karpathy) and Luke Carter's Brand Wiki system.

---

## Concept

**Two-layer architecture**:
- **Engine** (this repo): Reusable CLI + web UI
- **Data** (`.brandwiki/` inside each project): Per-project raw material and compiled wiki

You drop raw notes, meeting transcripts, decision logs, code snapshots, and frontmatter into `raw/`. The engine compiles them into a structured Markdown knowledge base in `wiki/`. You rarely edit `wiki/` manually — the LLM owns it.

---

## Install

```bash
git clone https://github.com/22kyasue/brandwiki.git
cd brandwiki
npm install
npm run build
npm link              # makes `brandwiki` available globally
```

API key is optional:
- **Default (recommended)**: uses your Claude Code Pro subscription by spawning `claude -p` as a subprocess — **no API charges**
- **API mode**: set `ANTHROPIC_API_KEY` and flip `provider: "api"` in config.json

---

## Quick Start

```bash
# In any project:
cd my-project
brandwiki init --template medical-app --language ja

# Drop raw material (or use auto-ingest):
brandwiki ingest        # copies files matching config.ingestPaths

# Compile raw/ → wiki/ using LLM:
brandwiki compile

# Serve the wiki as a web UI:
brandwiki serve
# → http://localhost:8787

# Or watch mode (auto-ingest + auto-serve + live reload):
brandwiki watch
```

---

## CLI Reference

```bash
brandwiki init [--template <name>] [--language ja|en] [--name <name>]
brandwiki compile [--force] [--dry-run]
brandwiki ingest [--verbose]
brandwiki watch [--port 8787] [--auto-compile]
brandwiki serve [--port 8787] [--no-live-reload]
brandwiki lint
brandwiki search <query>
brandwiki query "<question>"
brandwiki status
brandwiki research [--competitor <name>] [--since <date>] [--compile] [--dry-run] [--force]
brandwiki append [text] [--from <source>] [--type <type>] [--category <id>] [--stdin]
```

---

## Autonomous Research

`brandwiki research` turns the wiki into a living competitive-intelligence system. It reads `config.research.competitors`, calls the LLM (with web search enabled on the API provider), and writes a dated brief per competitor to `raw/competitors/YYYY-MM-DD-<slug>.md`. The next `compile` folds them into the wiki.

Config example:

```jsonc
{
  "research": {
    "targetCategory": "bb-competitive",
    "cadenceDays": 1,
    "competitors": [
      {
        "name": "Acme Booking",
        "description": "Primary competitor — SaaS booking platform",
        "urls": ["https://acme.example.com", "https://twitter.com/acme"],
        "focus": ["pricing", "feature-launches", "japan-market"],
        "tags": ["competitor", "saas"]
      }
    ]
  },
  "model": {
    "research": "claude-sonnet-4-6"
  }
}
```

Run locally:

```bash
brandwiki research --compile               # all competitors, then compile
brandwiki research --competitor "Acme Booking"
brandwiki research --since 2026-04-01 --compile
```

Run daily via GitHub Actions — copy the template workflow:

```bash
cp node_modules/brandwiki-engine/templates/github/brandwiki-research.yml \
   .github/workflows/brandwiki-research.yml
```

Then add `ANTHROPIC_API_KEY` as a repo secret and set `"provider": "api"` in `config.json`. The workflow opens a PR with the daily diff so each update is reviewable before merging.

---

## Web UI Features

Once you run `brandwiki serve`, visit `http://localhost:8787`:

### Main Page (dashboard)
- **Browse by category** — featured at the top with rich colored cards (one per category)
- **Featured article** — highest-confidence pick with drop cap and excerpt
- **Recently updated** — last 6 compiled articles with dates
- **About** + **Wiki health** — stats and metadata
- **Article connections** — interactive D3 force-directed **backlink graph**
  - Drag nodes, **Ctrl+scroll** to zoom, +/− zoom buttons
  - Hover highlights connected nodes and dims the rest
  - Double-click a node to open the article
  - Labels appear on hover / for anchor (high-degree) nodes
  - Wikipedia-fused aesthetic: light bg, subtle grid, wiki blue accents

### Article Pages
- Left **sticky sidebar** with:
  - **Navigation** (Main / All / Recent / Random)
  - **Categories** (current highlighted with color-coded border)
  - **Contents** — auto-generated multi-level TOC (H2/H3)
  - **Scroll-spy**: current section gets a red underline as you scroll
- Right **Infobox** with Status / Confidence / Updated / Words / Sources
- MediaWiki-style typography (Linux Libertine / Hiragino Mincho serif titles)
- Syntax highlighting (highlight.js, lazy-loaded)
- Mermaid diagram support (lazy-loaded)
- `[[wiki backlinks]]` auto-resolved to real article links

### Category Pages
- **3 view modes**: Cards (default) / List / A-Z alphabetical
- Cards view: featured top card with drop cap, category-colored left accent, hover lift with HUD arrow `[ READ ▸ ]`, KEY badge on top-scored article, staggered fade-in
- Each card shows excerpt, read time ("5分で読める"), source count, relative time
- Scoll-spy, search, filter

### Other Features
- **Top header bar** with global search (focus: width expands) and Main/All/Recent/Random links
- **Hover prefetch**: links pre-fetch on hover for instant navigation
- **View Transitions API**: smooth cross-page fades in modern browsers
- **ETag / 304**: zero-byte revalidation on repeat visits
- **SSE live-reload**: browser auto-refreshes when wiki/ changes (in watch mode)
- **In-memory cache**: 1-3ms response times once warm
- **Print CSS**: clean article printout / PDF export

---

## Architecture

```
brandwiki-engine/                   # This repo (the tool)
├── src/
│   ├── cli.ts                      # CLI entry point
│   ├── commands/
│   │   ├── init.ts                 # Scaffold .brandwiki/
│   │   ├── ingest.ts               # Copy project files into raw/
│   │   ├── compile.ts              # Claude API → markdown articles
│   │   ├── lint.ts                 # Detect contradictions
│   │   ├── search.ts               # Local grep
│   │   ├── query.ts                # Q&A with wiki context
│   │   ├── status.ts               # Health stats
│   │   ├── serve.ts                # HTTP server + SSR
│   │   └── watch.ts                # chokidar + auto-ingest + serve
│   └── lib/
│       ├── config.ts, manifest.ts
│       ├── anthropic.ts, claude-cli.ts  # LLM providers
│       ├── article-processor.ts    # Markdown → HTML + TOC + backlinks
│       └── site-template.ts        # CSS + htmlShell
├── templates/                      # Project archetypes
│   ├── generic/                    # 6 broad categories
│   └── medical-app/                # 9 categories tuned for healthcare (Japanese)
└── examples/
    └── kusunavi/                   # Live example — medical app knowledge base

<your-project>/.brandwiki/           # Created by `brandwiki init`
├── config.json                     # Categories, models, ingest rules
├── manifest.json                   # Incremental compile tracking
├── raw/                            # You drop files here (auto-ingested)
│   ├── notes/
│   ├── meetings/
│   ├── decisions/
│   ├── references/
│   └── code-snapshots/
├── wiki/                           # LLM writes files here
│   ├── 01-brand/
│   ├── 02-product/
│   └── ...
└── outputs/                        # Query results, lint reports
```

---

## Live Example: Kusunavi (クスナビ)

See [`examples/kusunavi/`](./examples/kusunavi) — a compiled brand wiki for a Japanese medical-app project with 31 articles across 9 categories.

To run it locally:
```bash
cd examples/kusunavi
brandwiki serve
# open http://localhost:8787
```

---

## Templates

- `generic` — 6 broad categories (Overview, Product, Architecture, Design, Operations, History)
- `medical-app` — 9 categories tuned for healthcare apps (Japanese): ブランド, プロダクト, 医療ロジック, デザインシステム, アーキテクチャ, コンテンツ, 運用, 開発史, マーケット
- `personal` — 17 categories for a personal life wiki (Japanese): 羅針盤, 自分, 目標, 身体, 食事, 健康, 日記, 学び, 仕事, 創作, 人, お金, 時間, 思い出, 自分のパターン, 自分との約束, PC作業ログ. Designed to be wrapped by a private security layer (e.g. a separate Hadi project) for at-rest encryption and offline-only operation. Ships with a `daily-template.md` for daily journaling.

Add your own template as `templates/<name>/config.json`.

---

## Write-only Inbox (`brandwiki append`)

External agents (a Claude Code session ending, an iOS Shortcut, a shell hook, or a private wrapper) can drop notes into the wiki **without being granted read access** to the existing content. The next `compile` folds them into the structured wiki.

```bash
brandwiki append --from claude-code --type task "Refactored auth middleware"
brandwiki append --from manual --type thought --category 06-journal "Today I felt..."
echo "Bench 80kg x 5" | brandwiki append --from cli --category 03-fitness --stdin
```

Files land in `raw/inbox/<YYYY-MM-DD>-<source>.md`, one per source per day, aggregated.

---

## Embedding the engine

The CLI exits with the project root determined by walking up from `cwd` for `.brandwiki/`. To redirect every command at an arbitrary directory (useful when the wiki lives on a tmpfs / encrypted mount), set:

```bash
export BRANDWIKI_DIR=/path/to/dir   # may point at the parent or at .brandwiki/ itself
brandwiki compile
```

Provider override:

```bash
export BRANDWIKI_PROVIDER=ollama    # claude-cli (default) | api | ollama
export OLLAMA_HOST=http://127.0.0.1:11434
export OLLAMA_MODEL=llama3.1:8b
```

The `ollama` provider lets the wiki run end-to-end with no content leaving the host.

---

## Config

After `brandwiki init`, edit `.brandwiki/config.json` to customize:

```jsonc
{
  "projectName": "My Project",
  "language": "ja",
  "template": "medical-app",
  "provider": "claude-cli",     // "claude-cli" | "api"
  "categories": [ ... ],
  "model": {
    "compile": "claude-sonnet-4-6",
    "lint": "claude-haiku-4-5-20251001",
    "query": "claude-sonnet-4-6"
  },
  "ingestPaths": [              // auto-copy into raw/ on `brandwiki ingest`
    { "from": "CLAUDE.md", "to": "raw/notes/" },
    { "from": "backend/src/services/*.ts", "to": "raw/code-snapshots/services/" },
    { "from": "notes/**/*.md", "to": "raw/notes/" }
  ],
  "watch": {
    "debounceMs": 20000,
    "autoCompile": false
  }
}
```

---

## Credits

- [Andrej Karpathy — LLM Knowledge Bases tweet](https://x.com/karpathy) (the incremental compile + wiki-as-context pattern)
- [Luke Carter — "I Cloned My Brain So AI Could Run My Business"](https://www.youtube.com/watch?v=Ag7g9u6E4Ko) (brand wiki concept)
- [Wikipedia / MediaWiki](https://www.mediawiki.org/) (typography, layout aesthetic)
- [Obsidian](https://obsidian.md/) (graph view interaction patterns)

---

## License

MIT — see [LICENSE](./LICENSE).
