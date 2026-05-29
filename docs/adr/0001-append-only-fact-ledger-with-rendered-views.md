# Append-only Fact Ledger, with the wiki as a rendered view

## Status

accepted

## Decision

The source of truth for each project is an **append-only ledger of atomic, sourced, timestamped Facts**. Nothing is ever overwritten or deleted; new Facts supersede old ones by date. The wiki articles, web UI, and per-session Digest are **Renders** generated *from* the ledger — disposable and regenerable, never authoritative.

## Context

Brandwiki's whole purpose is to stop stale documents from feeding false context. But the original `compile` did the opposite: it asked the LLM to "generate 8–15 articles" from scratch and **overwrote** `wiki/` every run, with no memory of prior content. Because refresh is now triggered automatically on every git commit, that meant every refresh could silently drop or reword a correct fact — non-deterministically. A self-inflicted version of the exact problem the tool exists to solve.

## Considered options

- **Keep regenerate-and-overwrite** — simplest, but gambles accumulated facts on every refresh. Rejected: it *is* the staleness mechanism.
- **Incremental merge** of LLM prose — better, but still treats generated prose as the store, so a bad merge corrupts a fact. Rejected.
- **Append-only ledger + rendered views** — chosen.

## Consequences

- Facts cannot silently vanish: a Fact missing from a Render is still in the ledger, recoverable and auditable.
- Each Fact carries source + date, which directly powers the freshness display and the honest Digest.
- Append-only creates accumulating contradictions; resolved by latest-by-date default plus a **Conflict-Gate** that surfaces unresolved conflicts rather than guessing instead of silently picking one.
- This is the largest build in the redesign — a genuine data-model change, not a config flip. Accepted as the cost of making brandwiki *trustworthy* rather than merely convenient.
