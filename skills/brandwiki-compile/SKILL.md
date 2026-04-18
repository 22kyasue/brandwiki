---
name: brandwiki-compile
description: "Run the brandwiki ingest + compile pipeline for the current project. Copies project files into raw/, then calls LLM to generate/update wiki articles. Use when project content has changed and wiki needs updating."
origin: custom
---

# /brandwiki-compile - Ingest & Compile Wiki

Re-ingest project files and compile them into wiki articles.

## When to Use

- User says "update the wiki", "recompile brandwiki", "refresh articles"
- User types `/brandwiki-compile`
- After editing project source files and wanting the wiki to reflect changes

## Usage

```
/brandwiki-compile           # incremental (only changed files)
/brandwiki-compile --force   # recompile everything
```

## Workflow

### Step 1: Verify Setup

1. Find `.brandwiki/config.json` (walk up from cwd)
2. If not found, tell user to run `/brandwiki-setup` first

### Step 2: Ingest

```bash
CLI="C:/Users/stake/githubproject/brandwiki-engine/dist/cli.js"
node $CLI ingest --verbose
```

This copies project files matching `ingestPaths` into `.brandwiki/raw/`.

### Step 3: Compile

**Warn user about LLM cost:**
> "Compiling wiki. This calls the LLM and may take 1-3 minutes."

```bash
node $CLI compile          # incremental
# or
node $CLI compile --force  # full recompile (if --force flag)
```

### Step 4: Broadcast Reload

If a brandwiki server is running (check `/_status`), the compile will trigger a live reload automatically via SSE.

### Step 5: Report

```
brandwiki compile complete
  Ingested: N files
  Compiled: M articles (K new, J updated)
  Wiki: http://localhost:<port> (if running)
```

## Notes

- Incremental compile only processes files whose hash has changed since last compile
- `--force` recompiles all articles (useful after config/category changes)
- Compile uses the model specified in `.brandwiki/config.json` → `model.compile`
