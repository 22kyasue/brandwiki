import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import type { Fact, NewFact } from './fact.js';
import type { FactLedger } from './ledger.js';

/** An agent-proposed Fact, quarantined until a human accepts it. */
export interface Proposal {
  id: string;
  fact: NewFact;
}

/**
 * Persistence boundary for the Review Queue. Unlike the ledger this is a
 * mutable quarantine: proposals are removed on accept/reject. Nothing here is
 * trusted, so removal is correct (the Trusted Store stays append-only).
 */
export interface QueueStore {
  read(): Proposal[];
  write(proposals: Proposal[]): void;
}

export class MemoryQueueStore implements QueueStore {
  private proposals: Proposal[] = [];
  read(): Proposal[] {
    return this.proposals.map((p) => ({ ...p }));
  }
  write(proposals: Proposal[]): void {
    this.proposals = proposals.map((p) => ({ ...p }));
  }
}

/** File-backed queue as a single JSON array (small, mutable — not the ledger). */
export class JsonQueueStore implements QueueStore {
  constructor(private readonly path: string) {}
  read(): Proposal[] {
    if (!existsSync(this.path)) return [];
    return JSON.parse(readFileSync(this.path, 'utf-8')) as Proposal[];
  }
  write(proposals: Proposal[]): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(proposals, null, 2), 'utf-8');
  }
}

/**
 * The Review Queue (CONTEXT.md). The only path from an agent-proposed Fact to
 * the Trusted Store: proposals are quarantined here and never visible to the
 * ledger, a Render, or a Digest until a human `accept`s them.
 */
export class ReviewQueue {
  constructor(private readonly store: QueueStore, private readonly ledger: FactLedger) {}

  /** Quarantine a proposed Fact; returns its proposal id. */
  propose(fact: NewFact): string {
    const proposals = this.store.read();
    const id = this.makeId(fact, proposals.length);
    proposals.push({ id, fact });
    this.store.write(proposals);
    return id;
  }

  list(): Proposal[] {
    return this.store.read();
  }

  /** Promote a proposal into the ledger and remove it from the queue. */
  accept(id: string): Fact {
    const proposals = this.store.read();
    const match = proposals.find((p) => p.id === id);
    if (!match) throw new Error(`No proposal with id ${id}`);
    const fact = this.ledger.append(match.fact);
    this.store.write(proposals.filter((p) => p.id !== id));
    return fact;
  }

  /** Discard a proposal; it never reaches the Trusted Store. */
  reject(id: string): void {
    const proposals = this.store.read();
    if (!proposals.some((p) => p.id === id)) throw new Error(`No proposal with id ${id}`);
    this.store.write(proposals.filter((p) => p.id !== id));
  }

  private makeId(fact: NewFact, index: number): string {
    const basis = JSON.stringify([fact.project, fact.subject, fact.body, fact.createdAt, index]);
    return 'p-' + createHash('sha256').update(basis).digest('hex').slice(0, 12);
  }
}
