# brandwiki-engine

LLM-powered brand wiki compiler. Inspired by Andrej Karpathy's LLM knowledge base pattern and Luke Carter's Brand Wiki system.

## Concept

**Two-layer architecture**:
- **Engine** (this repo): Reusable CLI tool
- **Data** (`.brandwiki/` inside each project): Per-project raw material and compiled wiki

You drop raw notes, meeting transcripts, decision logs, and code snapshots into `raw/`. The engine compiles them into a structured Markdown knowledge base in `wiki/`. You rarely edit `wiki/` manually — the LLM owns it.

## Install

```bash
cd brandwiki-engine
npm install
npm run build
npm link  # makes `brandwiki` command globally available
```

Set your API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

```bash
# Inside any project
cd my-project
brandwiki init --template medical-app --language ja --name "My Project"

# Drop raw material into .brandwiki/raw/
cp -r ../old-notes/* .brandwiki/raw/notes/

# Compile raw → wiki
brandwiki compile

# Health checks
brandwiki lint

# Search
brandwiki search "トリアージ"

# Ask questions
brandwiki query "くすまるのトーンを教えて"

# Status
brandwiki status
```

## Templates

- `generic` — 6 broad categories
- `medical-app` — 9 categories tuned for healthcare apps (Japanese)

Add your own under `templates/<name>/config.json`.

## Architecture

```
brandwiki-engine/          # This repo
├── src/
│   ├── cli.ts
│   ├── commands/          # init, compile, lint, search, query, status
│   └── lib/               # config, manifest, anthropic client
├── templates/             # Project templates
└── prompts/               # (reserved for prompt library)

<your-project>/.brandwiki/ # Created by `brandwiki init`
├── config.json
├── manifest.json          # Incremental compile tracking
├── raw/                   # You drop files here
├── wiki/                  # LLM writes files here
├── outputs/               # Query results, lint reports
└── _index/                # Auto-generated indexes
```

## Credits

- [Andrej Karpathy's LLM Knowledge Bases tweet](https://x.com/karpathy)
- [Luke Carter — "I Cloned My Brain So AI Could Run My Business"](https://www.youtube.com/watch?v=Ag7g9u6E4Ko)
