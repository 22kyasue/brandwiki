# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Repository identity

`brandwiki-engine` — public, MIT-licensed CLI/library that compiles raw project material into a Wikipedia-style Markdown knowledge base. Generic and reusable: medical apps, SaaS, etc.

## Active personal project on this branch (`claude/personal-brand-wiki-gelYT`)

**If the user says "パーソナルウィキ" / "personal wiki" / "Hadi" / "ハディ", they are referring to a private personal-life-wiki + AI-coach project being built on top of brandwiki-engine.**

→ **Read `docs/HANDOFF.md` IMMEDIATELY and continue from there.**

The design, decisions, threat model, Phase 1 status, Phase 2 plan, and open questions are all in `docs/HANDOFF.md`. Do not re-litigate decisions that are already locked there. Do not propose new architecture without checking what was already decided.

## Standard rules

- Test everything before pushing. `npm run build` must pass.
- The personal/Hadi project is built in a **separate private repo** (`22kyasue/hadi`). Only the generic engine improvements (templates, append command, ollama provider, BRANDWIKI_DIR support) belong in this repo.
- Never commit personal data, journal entries, or anything from `~/.personal-brandwiki/` into this repo.
