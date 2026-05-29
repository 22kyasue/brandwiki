# Per-project wikis are primary; a thin Global Layer holds cross-project system reality

## Status

accepted

## Decision

The **Per-Project Wiki** (`.brandwiki/` in each repo) is the primary unit. A thin **Global Layer** sits on top for genuinely cross-project system reality (shared infra, project roster, cross-repo conventions). Context reaches a session as a **compact, auto-injected Digest** — composed at inject time from the relevant project's brief *plus* the relevant behavior rules from `MEMORY.md`.

The split between brandwiki and `MEMORY.md` is by **kind of fact**: brandwiki owns everything about the *systems/projects*; `MEMORY.md` owns *behavior and people*. Cross-project *system* reference (OpenClaw ops, shared infra) migrates out of `MEMORY.md` into the Global Layer, where it gains dates, sources, and the Conflict-Gate.

## Context

Twelve repos already had per-project `.brandwiki/` dirs (two heavily used), while the single global brain sat empty — the architecture already leaned per-project. Meanwhile `MEMORY.md` (178 files) had grown to hold large amounts of cross-project *system* reference that visibly goes stale (it contains its own "⚠️ STALE" warnings). Injection was pull-only and depended on the agent choosing to ask, so "context every time" was never actually delivered.

## Considered options

- **Single global brain** — what already existed and stayed empty; doesn't match how work actually happens (per project) and doesn't scale (compile truncates at ~180k). Rejected.
- **Thin index-only Global Layer**, infra reference stays in MEMORY — smallest migration, but leaves stale-prone infra facts in the layer with no freshness machinery. Rejected.
- **Global Layer absorbs cross-project system reference** — chosen; applies the anti-staleness machinery to the facts that actually rot.
- **Brandwiki absorbs MEMORY entirely** — rejected as high-blast-radius; MEMORY's behavior/people recall works and stays.

## Consequences

- Each fact lives in exactly one place, divided by what kind of fact it is — the structural fix for "same fact in several drifting docs."
- The Digest, being generated and stamped "do not edit," replaces the hand-written `CLAUDE.md`/notes that used to drift; `CLAUDE.md` shrinks to pure house rules.
- Requires a one-time migration of MEMORY's "OpenClaw ops" and "Reference / cross-cutting" sections into the Global Layer.
