import { describe, it, expect } from 'vitest';
import { ReviewQueue, MemoryQueueStore } from './review-queue.js';
import { FactLedger, MemoryLedgerStore } from './ledger.js';
import type { NewFact } from './fact.js';

function newFact(over: Partial<NewFact> = {}): NewFact {
  return {
    project: 'airsync',
    subject: 'pricing-model',
    body: 'usage-based',
    kind: 'copied',
    source: 'conversation',
    sourceHash: 'h',
    createdAt: '2026-05-01',
    ...over,
  };
}

function setup() {
  const ledger = new FactLedger(new MemoryLedgerStore());
  const queue = new ReviewQueue(new MemoryQueueStore(), ledger);
  return { ledger, queue };
}

describe('ReviewQueue', () => {
  it('proposed facts never appear in ledger queries until accepted', () => {
    const { ledger, queue } = setup();
    queue.propose(newFact());
    expect(ledger.query({ project: 'airsync' })).toHaveLength(0);
    expect(queue.list()).toHaveLength(1);
  });

  it('accept moves exactly one fact into the ledger and clears it from the queue', () => {
    const { ledger, queue } = setup();
    const id1 = queue.propose(newFact({ body: 'a' }));
    queue.propose(newFact({ body: 'b' }));

    const accepted = queue.accept(id1);
    expect(accepted.body).toBe('a');
    expect(accepted.id).toBeTruthy();

    expect(ledger.query({ project: 'airsync' }).map((f) => f.body)).toEqual(['a']);
    expect(queue.list().map((p) => p.fact.body)).toEqual(['b']);
  });

  it('reject discards a proposal with no trace in the Trusted Store', () => {
    const { ledger, queue } = setup();
    const id = queue.propose(newFact());
    queue.reject(id);
    expect(queue.list()).toHaveLength(0);
    expect(ledger.query({ project: 'airsync' })).toHaveLength(0);
  });

  it('accept and reject throw on an unknown proposal id', () => {
    const { queue } = setup();
    expect(() => queue.accept('nope')).toThrow();
    expect(() => queue.reject('nope')).toThrow();
  });
});
