---
name: brandwiki-status
description: "Check the status of brandwiki for the current project. Shows server state, article count, compile history, and external sources. Quick health check without opening a browser."
origin: custom
---

# /brandwiki-status - Wiki Health Check

Quick status check for the current project's brandwiki.

## When to Use

- User types `/brandwiki-status`
- User asks "is brandwiki running?", "how many articles?", "wiki status"

## Usage

```
/brandwiki-status
```

## Workflow

### Step 1: Find Config

1. Locate `.brandwiki/config.json`
2. If not found: "No brandwiki configured. Run `/brandwiki-setup` to create one."

### Step 2: Check Local State

Read from filesystem:
- `.brandwiki/wiki/**/*.md` — count articles, list categories with counts
- `.brandwiki/raw/` — count raw source files
- `.brandwiki/raw/external/` — count external sources
- `.brandwiki/manifest.json` — last compile time, source hashes

### Step 3: Check Server

Try known ports (check memory for project-port mapping, else try 8787):

```bash
curl -s http://localhost:<port>/_status
```

Parse response for: mode, liveReload, articles, sseClients, lastBroadcast, broadcastCount.

If no server running, report "Server: not running".

### Step 4: Report

```
brandwiki status: <projectName>
  
  Server:     http://localhost:<port> (watch mode, live reload ON)
  Articles:   N across M categories
  Raw files:  K sources
  External:   J fetched (Wikipedia/URL)
  Last compile: 2026-04-12 04:34 JST
  SSE clients:  2 connected
  
  Categories:
    ブランド (5) · プロダクト (8) · 医療ロジック (4) · ...
    
  Health:
    [OK] Server running
    [OK] Wiki populated
    [WARN] External sources fetched but not compiled (run /brandwiki-compile)
    [--] No externalSources configured
```

### Health Checks

| Check | OK | WARN | FAIL |
|-------|-----|------|------|
| Server | Running | Not running | Port conflict |
| Wiki | Has articles | Empty | No .brandwiki/ |
| Raw | Has files | Empty | Missing dirs |
| External | Fetched + compiled | Fetched, not compiled | Not configured |
| Compile | Recent (<24h) | Stale (>7d) | Never compiled |
