---
name: brandwiki
description: "Start the brandwiki local server for the current project. Detects .brandwiki/ config, picks the right port, and launches watch mode with live reload. Use /brandwiki to spin up the wiki UI for any project that has a .brandwiki/ directory."
origin: custom
---

# /brandwiki - Local Wiki Server

Start the brandwiki Wikipedia-style UI for the current project.

## When to Use

- User types `/brandwiki` in any project with a `.brandwiki/` directory
- User asks to "start the wiki", "localhost the brandwiki", "serve the wiki"

## Usage

```
/brandwiki              # start with defaults (watch mode, auto-detect port)
/brandwiki serve        # serve only, no file watching
/brandwiki --port 3000  # custom port
/brandwiki fetch        # fetch external sources first, then start
/brandwiki compile      # compile wiki first, then start
/brandwiki full         # fetch + compile + watch (full pipeline)
```

## Workflow

### Step 1: Detect or Create Project

1. Check if `.brandwiki/config.json` exists in the current working directory
2. If not found, walk up parent directories to find it
3. If not found anywhere, **auto-initialize**:
   - Ask the user for a project name (default: current directory name)
   - Run `node C:/Users/stake/githubproject/brandwiki-engine/dist/cli.js init --name "<name>" --language ja`
   - This creates `.brandwiki/` with config.json, raw/, wiki/ structure
   - Then **auto-configure ingestPaths**: scan the project for common file patterns (*.md, src/, docs/, package.json, prisma/schema.prisma, etc.) and add matching ingestPaths to config.json
   - Then continue to Step 1.5 to populate content

### Step 1.5: First-Run Pipeline (if wiki/ is empty)

Check if `.brandwiki/wiki/` has any `.md` files. If empty (0 articles):

1. **Tell the user**: "Wiki is empty. Running the initial pipeline: ingest → compile → serve. The compile step uses LLM and will take a minute."
2. **Ingest**: `node <cli.js> ingest` — copy project files into raw/
3. **Compile**: `node <cli.js> compile` — call LLM to generate wiki articles from raw sources
   - This is the expensive step (LLM API call). Warn user it may take 1-3 minutes and cost API credits.
   - If compile fails (e.g., no API key), tell the user what's needed and still start serve so they can see the empty shell.
4. **Verify**: Check that wiki/ now has articles. Report count.
5. Continue to Step 2.

This ensures `/brandwiki` is a **one-command experience**: init → configure → ingest → compile → serve. The user sees content on first visit.

### Step 2: Read Config

1. Read `.brandwiki/config.json` to get:
   - `projectName` — display in output
   - `watch.autoCompile` — whether compile runs on changes
   - Port preference (check for known project ports, default 8787)
2. Known project port mappings (check these first):
   - kusunavi → 1992
   - Other projects → 8787 (default)

### Step 3: Check Port Availability

1. Run `netstat -ano | grep :<port>` to check if the port is already in use
2. If already listening:
   - Verify it's a brandwiki instance by hitting `/_status`
   - If healthy, report "already running" with the URL and status info
   - If not a brandwiki server, pick the next available port (+1)

### Step 4: Locate brandwiki-engine CLI

The brandwiki CLI is at: `C:/Users/stake/githubproject/brandwiki-engine/dist/cli.js`

If not found, check if `brandwiki` is available as a global command.

### Step 5: Optional Pre-steps (based on args)

- If `fetch` or `full`: run `brandwiki fetch` first to pull external sources
- If `compile` or `full`: run `brandwiki compile --force` to regenerate wiki articles

### Step 6: Start Server

1. Default mode is `watch` (live reload + file monitoring)
2. If `serve` arg given, use serve mode instead
3. Run in background: `node <cli.js> watch --port <port>`
4. Wait briefly, then verify:
   - Hit `http://localhost:<port>/_status` to confirm healthy
   - Report the URL, mode, article count, and live reload status

### Step 7: Report

Output a concise status block:

```
brandwiki running for <projectName>
  URL: http://localhost:<port>
  Mode: watch (live reload ON)
  Articles: <count>
  External sources: <count if any>
```

## Port Registry

Maintain known port assignments so projects don't collide:

| Project | Port |
|---------|------|
| kusunavi | 1992 |
| default | 8787 |

To add a new project-port mapping, the user can say "use port XXXX for this project" and the assistant should save it to memory.

## Error Handling

- **No .brandwiki/ found**: "This project doesn't have a brandwiki setup. Run `brandwiki init` to create one."
- **Port in use by non-brandwiki**: Auto-increment port and notify user
- **CLI not found**: "brandwiki-engine CLI not found. Expected at C:/Users/stake/githubproject/brandwiki-engine/dist/cli.js"
- **Build needed**: If `dist/cli.js` is stale (older than `src/`), run `npm run build` in brandwiki-engine first
