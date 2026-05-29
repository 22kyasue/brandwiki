# Brandwiki

Brandwiki is the context library for Kensei's entire project setup: a per-project knowledge store, fed from artifacts you already produce, that hands every AI session an accurate, dated brief so you never re-explain a project and never act on a stale fact.

## Language

**Fact**:
A single, atomic, sourced, timestamped claim about a project or system (e.g. "AirSync pricing is usage-based"). The unit of the ledger. Never edited or deleted once written.
_Avoid_: note, article, entry

**Fact Ledger**:
The append-only store of all Facts for a project. The single source of truth. Nothing in it is ever overwritten; new Facts supersede old ones, they don't replace them.
_Avoid_: database, wiki, knowledge base

**Render**:
A human- or agent-readable view generated *from* the Fact Ledger — a wiki article, a category page, the web UI. Disposable and regenerable; never a source of truth. If a Fact vanishes from a Render it is still in the Ledger.
_Avoid_: article (when used to mean the source), page, output

**Digest**:
The compact, generated brief auto-injected into every session for a project: durable "why" decisions, pointers to volatile truth, and a freshness index. Stamped "do not edit — generated." Replaces the hand-written `CLAUDE.md`/notes that used to drift.
_Avoid_: summary, context dump, brief

**Pointer Fact**:
A Fact about a *volatile* value (price, port, config, API shape) that stores *where the live truth lives* rather than a copy of it (e.g. "current pricing lives in `config/pricing.ts`"). Cannot go stale because there is no copy.
_Avoid_: reference, link

**Copied Fact**:
A Fact that stores the value itself, used for *durable* claims (decisions, reasoning) that don't rot. Carries a source and a last-verified date so its age is always visible.

**Trusted Store**:
Facts that came from a shipped artifact (a commit, an ADR, a decision doc). The only Facts allowed into a Render or Digest.

**Review Queue**:
Agent-*proposed* Facts captured from conversation. Quarantined and flagged low-confidence; never enters the Trusted Store, a Render, or a Digest until a human accepts it. Exists so auto-capture can't quietly write wrong facts.

**Conflict-Gate**:
The check that fires when two recent Facts about the same subject contradict and neither clearly supersedes the other. It surfaces *both* in the Digest as "unresolved" rather than silently picking one. The default resolution otherwise is latest-by-date.

**Per-Project Wiki**:
The Fact Ledger + Renders living in a project's `.brandwiki/` directory. The primary unit of the system. **One per repo.**

**Global Layer**:
A thin store on top of the Per-Project Wikis holding genuinely *cross-project* system reality: shared infra, the project roster, conventions that span repos. Subject to the same Ledger/freshness rules. **Distinct from** `MEMORY.md`.

## Flagged ambiguities

- **Brandwiki vs MEMORY.md** — clean split by *kind of fact*. Brandwiki owns everything about the *systems/projects* (per-project + cross-project). `MEMORY.md` owns *behavior and people* (how Kensei works, who someone is). Cross-project *system* reference (OpenClaw ops, shared infra) migrates OUT of MEMORY into the Global Layer. The per-session Digest is *composed* from both at inject time.
- **"Wiki"** — ambiguous between the source (now the **Fact Ledger**) and the view (now a **Render**). Use the precise term; reserve "wiki" only for the user-facing browse UI.
- **Brandbook** — *not* part of the context library. The invented-strategy generator (SWOT, positioning, personas) is cut from core compile; it never touches the Trusted Store or Digest.

## Example dialogue

> **Dev:** The AirSync pricing changed. Do I edit the pricing article?
> **Expert:** No — Renders are generated, you never edit them. You append a new **Fact**: "pricing is usage-based," sourced to the commit. The old flat-price Fact stays in the **Ledger**.
> **Dev:** So which one shows up in the **Digest**?
> **Expert:** Latest-by-date, so the usage-based one. Unless both are recent and contradict — then the **Conflict-Gate** shows both as unresolved until you settle it.
> **Dev:** And the price itself — we copy it in?
> **Expert:** Price is volatile, so make it a **Pointer Fact** — point at `config/pricing.ts`. The Digest sends the agent to the live source instead of risking a stale number.
> **Dev:** What about "AirSync runs on the shared OpenClaw gateway"? That's not really AirSync-only.
> **Expert:** Cross-project system reality — that's a Fact in the **Global Layer**, not the Per-Project Wiki, and not MEMORY.
