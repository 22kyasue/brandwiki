import { describe, it, expect } from 'vitest';
import { assess } from './freshness.js';
import type { Fact } from './fact.js';

function fact(over: Partial<Fact> = {}): Fact {
  return {
    id: 'f1',
    project: 'airsync',
    subject: 's',
    body: 'b',
    kind: 'copied',
    source: 'config/pricing.ts',
    sourceHash: 'abc123',
    createdAt: '2026-05-01',
    ...over,
  };
}

const now = new Date('2026-05-15T00:00:00Z');

describe('assess', () => {
  it('a fact whose stored hash matches the live hash is fresh', () => {
    const r = assess(fact({ sourceHash: 'abc123' }), 'abc123', now);
    expect(r.stale).toBe(false);
  });

  it('a changed live hash marks the fact stale', () => {
    const r = assess(fact({ sourceHash: 'abc123' }), 'different', now);
    expect(r.stale).toBe(true);
  });

  it('a missing live source (null hash) is stale', () => {
    const r = assess(fact({ sourceHash: 'abc123' }), null, now);
    expect(r.stale).toBe(true);
  });

  it('computes age in whole days from createdAt to now', () => {
    const r = assess(fact({ createdAt: '2026-05-01' }), 'abc123', now);
    expect(r.ageDays).toBe(14);
  });

  it('staleness depends ONLY on the hash, never on dates/mtime (git-pull case)', () => {
    // Same content hash but the fact is months old and "now" is far away —
    // a mtime-based check would scream stale; the hash check must not.
    const old = fact({ sourceHash: 'same', createdAt: '2025-01-01' });
    const r = assess(old, 'same', now);
    expect(r.stale).toBe(false);
    expect(r.ageDays).toBeGreaterThan(400);
  });
});
