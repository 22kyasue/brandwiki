import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import type { Fact, NewFact } from './fact.js';

/**
 * Persistence boundary for the ledger. Append-only by contract: implementations
 * must never expose a way to rewrite or remove a previously appended record.
 */
export interface LedgerStore {
  read(): Fact[];
  append(fact: Fact): void;
}

/** In-memory store for tests and ephemeral use. */
export class MemoryLedgerStore implements LedgerStore {
  private readonly records: Fact[] = [];
  read(): Fact[] {
    return this.records.slice();
  }
  append(fact: Fact): void {
    this.records.push(fact);
  }
}

/**
 * File-backed store: one JSON-encoded Fact per line (JSONL). Append is a pure
 * file-append — prior lines are never read-modified-written, which makes the
 * append-only invariant a property of the storage medium, not just the code.
 */
export class JsonlLedgerStore implements LedgerStore {
  constructor(private readonly path: string) {}

  read(): Fact[] {
    if (!existsSync(this.path)) return [];
    const text = readFileSync(this.path, 'utf-8');
    const facts: Fact[] = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) facts.push(JSON.parse(trimmed) as Fact);
    }
    return facts;
  }

  append(fact: Fact): void {
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, JSON.stringify(fact) + '\n', 'utf-8');
  }
}

export interface FactQuery {
  project: string;
  subject?: string;
}

/**
 * The append-only Fact Ledger (ADR 0001). The single source of truth for a
 * project. Reads return defensive copies so a caller can never reach back and
 * corrupt stored state; there is no update or delete operation by design.
 */
export class FactLedger {
  constructor(private readonly store: LedgerStore) {}

  /** Append a new Fact and return the stored Fact with its assigned id. */
  append(input: NewFact): Fact {
    const index = this.store.read().length;
    const fact: Fact = { ...input, id: this.makeId(input, index) };
    this.store.append(fact);
    return clone(fact);
  }

  /** All Facts for a project, in append order. */
  all(project: string): Fact[] {
    return this.store
      .read()
      .filter((f) => f.project === project)
      .map(clone);
  }

  /** Facts matching a query, *including* superseded ones (resolution is the
   *  Resolver's job, not the ledger's). */
  query(q: FactQuery): Fact[] {
    return this.store
      .read()
      .filter((f) => f.project === q.project && (q.subject === undefined || f.subject === q.subject))
      .map(clone);
  }

  /** Content-derived id; the append index disambiguates identical facts. */
  private makeId(input: NewFact, index: number): string {
    const basis = JSON.stringify([input.project, input.subject, input.body, input.kind, input.source, input.sourceHash, input.createdAt, index]);
    return createHash('sha256').update(basis).digest('hex').slice(0, 16);
  }
}

function clone(fact: Fact): Fact {
  return { ...fact };
}
