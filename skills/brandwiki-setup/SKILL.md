---
name: brandwiki-setup
description: "First-time brandwiki setup for any project. Creates .brandwiki/, auto-detects project files, configures ingestPaths, runs ingest + compile, and starts serving. Use when a project has no brandwiki yet or wiki/ is empty."
origin: custom
---

# /brandwiki-setup - First-Time Wiki Setup

One command to go from zero to a fully populated brandwiki.

## When to Use

- User types `/brandwiki-setup` in a project without `.brandwiki/`
- User says "set up brandwiki", "create wiki for this project"
- `/brandwiki` was run but wiki/ is empty and user wants to populate it

## Usage

```
/brandwiki-setup                    # full auto-setup
/brandwiki-setup --name "My App"    # with custom project name
```

## Workflow

### Step 1: Check Current State

1. Check if `.brandwiki/config.json` already exists
2. If yes, check if `wiki/` has articles — if populated, report and stop ("Already set up with N articles")
3. If `.brandwiki/` exists but wiki/ is empty, skip to Step 3

### Step 2: Initialize (if needed)

```bash
CLI="C:/Users/stake/githubproject/brandwiki-engine/dist/cli.js"
node $CLI init --name "<project-name>" --language ja
```

Default project name = current directory name, capitalized.

### Step 3: Auto-Configure ingestPaths

Scan the project directory for common patterns and add matching ingestPaths to `.brandwiki/config.json`:

**Always check for:**
- `README.md`, `CLAUDE.md`, `*.md` in root → `raw/notes/`
- `docs/**/*.md` → `raw/notes/`
- `notes/**/*.md` → `raw/notes/`
- `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml` → `raw/code-snapshots/`

**Language-specific (check if directories exist):**
- `src/**/*.ts` or `src/**/*.tsx` → `raw/code-snapshots/src/` (limit to key files: routes, services, controllers, models)
- `prisma/schema.prisma` → `raw/code-snapshots/`
- `backend/`, `frontend/` → scan separately
- `app/` (Next.js/Laravel) → `raw/code-snapshots/app/`
- `.github/workflows/*.yml` → `raw/code-snapshots/ci/`

**Rules:**
- Only add paths that actually have files (glob match > 0)
- Keep to ~15-20 ingestPaths max to avoid overwhelming the LLM
- Prefer high-signal files: config, schema, routes, README over utility files
- Write the updated config.json back

### Step 4: Run Ingest

```bash
node $CLI ingest --verbose
```

Report: "Ingested N files from M rules"

### Step 5: Run Compile

**IMPORTANT**: Warn the user first:
> "Compiling wiki articles using LLM (claude-sonnet-4-6). This will take 1-3 minutes and uses API credits. Proceed?"

Wait for confirmation, then:

```bash
node $CLI compile
```

Report: "Compiled N articles across M categories"

### Step 6: Start Server

```bash
node $CLI watch --port <port>
```

Use port 8787 by default, or check memory for project-specific port assignments.

### Step 7: Report

```
brandwiki setup complete for <projectName>
  URL: http://localhost:<port>
  Articles: <count>
  Categories: <list>
  ingestPaths: <count> rules configured
  
Next steps:
  - Browse: http://localhost:<port>
  - Add external sources: edit externalSources in .brandwiki/config.json, then /brandwiki-fetch
  - Re-compile after changes: /brandwiki-compile
```

## CLI Location

```
C:/Users/stake/githubproject/brandwiki-engine/dist/cli.js
```

If `dist/cli.js` doesn't exist or is stale, run `npm run build` in `C:/Users/stake/githubproject/brandwiki-engine/` first.
