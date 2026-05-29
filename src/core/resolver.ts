import type { Fact, ConflictPair, ResolveResult } from './fact.js';

export interface ResolveOptions {
  /** How close in time (days) two differing facts on a subject must be to
   *  trigger the Conflict-Gate instead of clean latest-by-date supersession. */
  windowDays?: number;
}

const DEFAULT_WINDOW_DAYS = 14;
const MS_PER_DAY = 86_400_000;

/**
 * Resolve an append-only set of Facts into the current view (ADR 0001).
 *
 * Pure: same input → same output, no LLM, no IO. For each subject the latest
 * Fact by date is current. When the newest facts cluster within `windowDays`
 * of each other *and* disagree, neither clearly supersedes the other, so the
 * Conflict-Gate fires: that subject is surfaced as an unresolved conflict and
 * deliberately left out of `current` rather than silently picked.
 */
export function resolve(facts: Fact[], options: ResolveOptions = {}): ResolveResult {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;

  const bySubject = new Map<string, Fact[]>();
  for (const fact of facts) {
    const group = bySubject.get(fact.subject) ?? [];
    group.push(fact);
    bySubject.set(fact.subject, group);
  }

  const current: Fact[] = [];
  const unresolvedConflicts: ConflictPair[] = [];

  for (const [subject, group] of bySubject) {
    const sorted = group.slice().sort((a, b) => date(b) - date(a));
    const latest = sorted[0];

    // The "recent cluster": facts within the window of the newest fact.
    const cluster = sorted.filter((f) => date(latest) - date(f) <= windowDays * MS_PER_DAY);
    const distinctBodies = new Set(cluster.map((f) => f.body));

    if (cluster.length > 1 && distinctBodies.size > 1) {
      unresolvedConflicts.push({ subject, facts: cluster });
    } else {
      current.push(latest);
    }
  }

  return { current, unresolvedConflicts };
}

function date(fact: Fact): number {
  return new Date(fact.createdAt).getTime();
}
