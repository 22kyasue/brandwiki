import type { FactLedger } from './ledger.js';
import type { NewFact, Fact, ResolveResult } from './fact.js';
import { resolve, type ResolveOptions } from './resolver.js';

/** The reserved project scope for cross-project system reality (ADR 0002). */
export const GLOBAL_PROJECT = 'global';

const ROSTER_PREFIX = 'roster:';

export interface RosterEntry {
  project: string;
  wikiPath: string;
}

/**
 * The Global Layer (ADR 0002): a thin store over the Per-Project Wikis for
 * genuinely cross-project system reality (shared infra, conventions) plus the
 * project roster. It is *not* a second mechanism — it reuses the same
 * append-only FactLedger and Resolver as any project, scoped to `"global"`, so
 * cross-project facts gain the same dates, freshness, and Conflict-Gate.
 */
export class GlobalLayer {
  constructor(private readonly ledger: FactLedger) {}

  /** Append a cross-project fact (forced to the global scope). */
  append(fact: NewFact): Fact {
    return this.ledger.append({ ...fact, project: GLOBAL_PROJECT });
  }

  /** Resolved current view of all global facts. */
  resolved(options: ResolveOptions = {}): ResolveResult {
    return resolve(this.ledger.all(GLOBAL_PROJECT), options);
  }

  /** Record (or update) where a project's wiki lives. Append-only: a later
   *  registration supersedes an earlier one by date. */
  registerProject(project: string, wikiPath: string, createdAt: string): Fact {
    return this.append({
      project: GLOBAL_PROJECT,
      subject: `${ROSTER_PREFIX}${project}`,
      body: wikiPath,
      kind: 'pointer',
      source: 'roster',
      sourceHash: '',
      createdAt,
    });
  }

  /** The current project roster: what projects exist and where each wiki is. */
  roster(): RosterEntry[] {
    return this.resolved()
      .current.filter((f) => f.subject.startsWith(ROSTER_PREFIX))
      .map((f) => ({ project: f.subject.slice(ROSTER_PREFIX.length), wikiPath: f.body }));
  }
}
