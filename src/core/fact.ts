/**
 * The Fact model — the atomic unit of the append-only ledger.
 *
 * A Fact is a single, sourced, dated claim about a project or system. Once
 * written it is never edited or deleted; newer Facts supersede older ones by
 * date (see Resolver). See CONTEXT.md for the canonical vocabulary.
 */

/**
 * `copied`  — the value itself is stored (durable "why" decisions, reasoning).
 * `pointer` — only *where the live truth lives* is stored (volatile values:
 *             prices, ports, config, API shapes). Cannot go stale because no
 *             copy of the volatile value exists in the ledger.
 */
export type FactKind = 'copied' | 'pointer';

export interface Fact {
  /** Stable, content-derived id assigned by the ledger on append. */
  id: string;
  /** Project scope; the literal `"global"` for the Global Layer. */
  project: string;
  /** Topic key used to group facts for conflict resolution. */
  subject: string;
  /**
   * For `copied` facts: the claim itself.
   * For `pointer` facts: where the live truth lives (e.g. `config/pricing.ts`).
   */
  body: string;
  kind: FactKind;
  /** Artifact this fact came from: a commit sha, an ADR id, a doc path. */
  source: string;
  /** Content hash of `source` at capture time — the staleness signal. */
  sourceHash: string;
  /** ISO-8601 date used for latest-by-date resolution and freshness display. */
  createdAt: string;
}

/** A Fact before the ledger assigns its `id`. */
export type NewFact = Omit<Fact, 'id'>;

/** Two or more recent, differing Facts about one subject that the Resolver
 *  refuses to silently collapse — surfaced for a human to settle. */
export interface ConflictPair {
  subject: string;
  facts: Fact[];
}

export interface ResolveResult {
  /** One current Fact per non-conflicted subject (latest-by-date). */
  current: Fact[];
  /** Subjects where the Conflict-Gate fired; absent from `current`. */
  unresolvedConflicts: ConflictPair[];
}
