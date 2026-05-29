## Problem Statement

I have one context problem with two faces. First, I repeat myself constantly — every new AI session about a project starts cold, and I re-explain the same decisions, structure, and "why we did it this way" that I've already explained a dozen times. Second, the documents meant to prevent that — `CLAUDE.md`, plans, summaries, the per-project wikis — go stale the moment a project moves on, and then they actively feed me and my agents *false* context. My own brandwikis prove it: twelve projects have one, most were compiled once and abandoned weeks-to-a-year ago, and the current `compile` makes it worse by regenerating articles from scratch and overwriting them, silently dropping facts it knew last month. So I'm caught between "no context" and "confidently wrong context," and brandwiki today sits on the wrong side of both.

## Solution

Brandwiki becomes the context library for my entire project setup. Each project keeps its own **Per-Project Wiki**; a thin **Global Layer** sits on top for cross-project system reality; and `MEMORY.md` keeps owning my behavior and the people I work with. The source of truth stops being LLM-generated prose and becomes an **append-only Fact Ledger** — atomic, sourced, dated claims that are never overwritten. Everything readable (wiki pages, the per-session **Digest**) is a **Render** of the ledger, never authoritative. Volatile values are stored as **Pointer Facts** that point at the live source instead of copying it, so they can't go stale. Contradictions are resolved latest-by-date, and when two recent facts genuinely conflict the **Conflict-Gate** shows both rather than guessing. Facts are captured automatically from the artifacts I already produce (commits, ADRs, docs) on git commit; agent-proposed facts wait in a **Review Queue** so nothing wrong gets written silently. And every session auto-loads a compact, generated, "do not edit" Digest — so I never re-explain a project, and I never act on a fact whose age I can't see.

## User Stories

1. As Kensei, I want each project to have its own Fact Ledger, so that context is organized the way I actually sit down to work — one project at a time.
2. As Kensei, I want a thin Global Layer above the per-project wikis, so that cross-project system reality (shared infra, project roster, conventions) has one home instead of being copy-pasted into each project.
3. As Kensei, I want brandwiki and `MEMORY.md` split by kind of fact, so that the systems live in brandwiki and my behavior/people live in MEMORY, with no overlap to drift.
4. As Kensei, I want every Fact to carry its source and a date, so that I can always see how old a claim is and how much to trust it.
5. As Kensei, I want the Fact Ledger to be append-only, so that a refresh can never silently delete or reword a true fact I captured earlier.
6. As Kensei, I want a fact that disappears from a Render to still exist in the ledger, so that nothing is ever truly lost and I can audit what was known and when.
7. As Kensei, I want volatile values (prices, ports, config, API shapes) stored as Pointer Facts, so that the worst case is "go look here" instead of a confidently wrong number.
8. As Kensei, I want durable "why" decisions stored as Copied Facts, so that reasoning I hate re-explaining is captured once and lasts.
9. As Kensei, I want the system to hold both the "why" (decisions/reasoning) and the "what exists" (current state), so that a session understands both how the project got here and where it is now.
10. As Kensei, I want contradictions resolved latest-by-date by default, so that the current view just works without me linking every supersession.
11. As Kensei, I want a Conflict-Gate to surface both facts when two recent claims genuinely contradict, so that the system tells me to decide rather than silently picking one and hiding the other.
12. As Kensei, I want freshness computed from content hashes rather than file mtime, so that a `git pull` or branch switch doesn't falsely mark everything as changed.
13. As Kensei, I want the wiki to refresh automatically when I commit, so that the context updates on the meaningful unit of change without me remembering to run anything.
14. As Kensei, I want refresh to NOT fire on every keystroke-save, so that I don't burn LLM calls churning on half-edited files.
15. As Kensei, I want facts captured from artifacts I already produce (commit messages, ADRs, decision docs), so that capture has no separate "write it down" step that I'll forget.
16. As Kensei, I want agent-proposed facts from conversation to land in a Review Queue, so that an AI mishearing me can never quietly write a wrong fact into my trusted brain.
17. As Kensei, I want to accept or reject queued facts in one step, so that good proposals reach the Trusted Store and bad ones are discarded with low friction.
18. As an AI agent starting a session in a project, I want a compact Digest auto-injected, so that I begin every task already knowing the project's durable decisions and where its volatile truth lives.
19. As an AI agent, I want the Digest stamped "do not edit — generated," so that I never treat it as a hand-editable doc that can drift.
20. As an AI agent, I want the Digest to carry freshness dates inline, so that even my always-on brief shows its own age and I distrust anything stale.
21. As an AI agent, I want to pull deeper detail from the ledger on demand, so that the Digest can stay small while full context is one query away.
22. As an AI agent, I want Pointer Facts to send me to the live source file, so that I read the real current value instead of a cached copy.
23. As Kensei, I want the Digest composed at inject time from brandwiki's project facts plus the relevant `MEMORY.md` behavior rules, so that a session gets both system context and working-style context in one brief.
24. As Kensei, I want `CLAUDE.md` to shrink to pure house rules, so that the part of my context that goes stale (project state) lives in the dated ledger instead.
25. As Kensei, I want the invented-strategy "brandbook" pass cut from core, so that speculative SWOT/positioning never gets mistaken for a fact I actually decided.
26. As Kensei, I want the Renderer to replace the destructive `compile`, so that producing readable pages never overwrites or endangers the underlying facts.
27. As Kensei, I want cross-project system reference migrated out of `MEMORY.md` into the Global Layer, so that the infra facts that visibly go stale finally get dates, sources, and the Conflict-Gate.
28. As Kensei, I want the Global Layer to use the same ledger and freshness rules as a Per-Project Wiki, so that there's one mental model, not two.
29. As Kensei, I want a project roster in the Global Layer, so that the system knows what projects exist and where each wiki lives.
30. As the maintainer, I want the pure-logic core (ledger, resolver, freshness, digest) to have zero LLM dependency, so that the trust guarantee is deterministic and unit-testable.
31. As the maintainer, I want the LLM to live only at the edges (capture, render), so that non-determinism can't corrupt the source of truth.
32. As Kensei, I want a one-time big-bang migration across all 12 repos, with a snapshot taken first, so that I get the new system everywhere fast and a bad rebuild is free to undo.
33. As Kensei, I want the engine proven end-to-end on AirSync before fanning out, so that the novel pieces surface their surprises on the project I know cold.
34. As Kensei, I want stale `AGENTS.md` references to tools that don't ship corrected, so that my own docs stop being an example of the false-context problem.

## Implementation Decisions

**Architecture is governed by the repo's ADRs and glossary.** Use the vocabulary in `CONTEXT.md` (Fact, Fact Ledger, Render, Digest, Pointer Fact, Copied Fact, Trusted Store, Review Queue, Conflict-Gate, Per-Project Wiki, Global Layer). Respect `docs/adr/0001` (append-only ledger + rendered views) and `docs/adr/0002` (per-project primary + cross-project global layer).

**Pure-logic core (deep modules, no LLM, no network):**

- **FactLedger** — append-only store of Facts. Interface roughly `append(fact) → factId`, `query({ project, subject }) → Fact[]`, `all(project) → Fact[]`. Invariant: no operation returns a value that lets a caller mutate or delete a prior Fact. A Fact carries at minimum: id, project, subject/topic key, body, kind (`copied` | `pointer`), source (artifact ref), sourceHash, createdAt.
- **Resolver** — pure: `resolve(facts) → { current: Fact[], unresolvedConflicts: ConflictPair[] }`. Groups by subject, picks latest-by-date as current; when two facts share a subject, are both recent, and contradict, emits an unresolved conflict instead of choosing.
- **Freshness** — pure: `assess(fact, liveSourceHash) → { stale: boolean, ageDays: number }`. Compares the Fact's stored sourceHash to the live source's current hash. mtime is permitted only as a display hint, never as the staleness signal.
- **DigestBuilder** — `build(project, { ledger, memoryRules }) → Digest`. Assembles the compact per-session brief: resolved durable Facts, Pointer Facts (as "live truth lives at X"), a freshness index, and the relevant `MEMORY.md` behavior rules composed in at build time. Output is text stamped "do not edit — generated."

**LLM / IO edge modules (thin, mockable):**

- **ArtifactCapture** — on git commit, reads the changed/added artifacts (commit message, ADRs, decision docs) and produces *proposed* Facts via the LLM. Writes only to the Review Queue, never directly to the ledger.
- **ReviewQueue** — `propose(fact)`, `list()`, `accept(id) → FactLedger.append`, `reject(id)`. The only path from proposed to Trusted Store.
- **PointerResolver** — given a Pointer Fact, reads the referenced live source and returns the current value on demand (used by pull, not baked into the Digest copy).
- **Renderer** — `render(resolvedFacts) → articles/pages`. Replaces the existing destructive `compile`: it reads the ledger and writes Renders, and is forbidden from writing back into the ledger. The brandbook strategy pass is removed from this path entirely.
- **GitTrigger** — wiring that fires capture + render on commit (git hook or equivalent), debounced to the commit event, not file-save. Cross-project: the **GlobalLayer** reuses FactLedger + Resolver + Freshness at cross-project scope and maintains the project roster.

**Data model:** Facts are append-only records keyed by `(project, subject)`. Renders and the Digest are derived artifacts and are safe to delete/regenerate. The Global Layer is a Fact Ledger whose `project` scope is "global."

**Migration:** Big-bang across all 12 `.brandwiki/` repos. Snapshot every `.brandwiki/` directory before any rebuild. Discard existing `wiki/` content (regenerable Renders, no loss); seed ledgers from each repo's existing artifacts. Stand the full loop up on **AirSync** first within the same push, then fan out. Migrate `MEMORY.md`'s "OpenClaw ops" and "Reference / cross-cutting" sections into the Global Layer. Correct `AGENTS.md` to describe tools that actually ship.

## Testing Decisions

**What makes a good test here:** tests assert *external behavior* through a module's public interface, never its internals. For this project the behaviors that matter are the trust invariants, and they're testable as pure functions over in-memory inputs — no LLM, no real filesystem, no git.

**Modules to test (agreed):**

- **FactLedger** — appending never mutates or removes prior Facts; `query` returns all matching Facts including superseded ones; the returned objects cannot be used to corrupt stored state.
- **Resolver** — latest-by-date is selected as current; superseded facts are excluded from `current` but retained; genuinely contradicting recent facts produce an unresolved conflict rather than a silent pick; non-contradicting facts about different subjects never conflict.
- **Freshness** — a fact whose stored sourceHash matches the live hash is fresh; a changed hash marks stale; mtime differences alone never flip the stale flag (the git-pull false-positive case).
- **DigestBuilder** — the Digest includes resolved durable facts, renders Pointer Facts as live-source references (never inline copies of the volatile value), carries freshness dates, and surfaces unresolved conflicts.
- **ReviewQueue** — proposed facts never appear in ledger queries until accepted; `accept` moves exactly one fact to the ledger; `reject` discards without trace in the Trusted Store.

**Explicitly not unit-tested:** ArtifactCapture and Renderer (LLM-backed, non-deterministic) — verified by eval/spot-check, not unit tests.

**Prior art:** none in-repo — there is no test runner or test file today (`package.json` has only `build`/`dev`/`start`). Establishing the harness is part of this work: add a fast TS-native runner (Vitest fits the existing `tsx`/ESM/TypeScript setup) and a `test` script. The pure-logic modules should be importable and exercised with plain in-memory fixtures.

## Out of Scope

- The brandbook strategy generator (SWOT, positioning, personas, competitor matrices) — cut from core; if ever wanted, produced ad hoc, never into the Trusted Store or Digest.
- Absorbing `MEMORY.md` wholesale — only cross-project *system* reference migrates; behavior and people stay in MEMORY.
- The web UI redesign / "immersive codebase explorer" (0.3.0 serve work) — orthogonal to the context-engine change; the Renderer must keep producing pages the existing serve layer can display, but no new UI is in scope here.
- The autonomous competitor-research command.
- A daemon that watches projects continuously — refresh is git-triggered, not always-on.
- Explicit manual supersession linking — latest-by-date + Conflict-Gate is the chosen mechanism.

## Further Notes

- The pure-logic core (FactLedger, Resolver, Freshness, DigestBuilder) is the load-bearing trust guarantee and is the largest new build; it is intentionally LLM-free so correctness is deterministic.
- The MCP `brandwiki__*` tools referenced in `AGENTS.md` are currently uncommitted local WIP and do not ship — they should be reconciled with the new pull interface (query against the ledger/Renders) as part of, or immediately after, this work.
- Rollout is big-bang per the owner's call, but the engine is proven on AirSync end-to-end first within the same push before fanning out to the other 11 repos.
