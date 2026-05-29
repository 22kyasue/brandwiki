import type { Fact } from './fact.js';

export interface Freshness {
  /** True when the live source no longer matches what the fact was captured
   *  from — the only staleness signal (ADR 0001 / PRD: hash, never mtime). */
  stale: boolean;
  /** Whole days since the fact was captured. Display hint only. */
  ageDays: number;
}

const MS_PER_DAY = 86_400_000;

/**
 * Assess a Fact's freshness against its live source.
 *
 * Pure. Staleness is decided *solely* by comparing the fact's stored
 * `sourceHash` to the source's current hash, so a `git pull` or branch switch
 * that changes mtime but not content never produces a false positive. A null
 * `liveSourceHash` means the source is gone — treated as stale.
 */
export function assess(fact: Fact, liveSourceHash: string | null, now: Date = new Date()): Freshness {
  const stale = liveSourceHash === null || liveSourceHash !== fact.sourceHash;
  const ageDays = Math.floor((now.getTime() - new Date(fact.createdAt).getTime()) / MS_PER_DAY);
  return { stale, ageDays };
}
