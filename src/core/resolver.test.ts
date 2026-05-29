import { describe, it, expect } from 'vitest';
import { resolve } from './resolver.js';
import type { Fact } from './fact.js';

let counter = 0;
function fact(over: Partial<Fact> = {}): Fact {
  counter += 1;
  return {
    id: `f${counter}`,
    project: 'airsync',
    subject: 'pricing-model',
    body: 'usage-based',
    kind: 'copied',
    source: 'commit:x',
    sourceHash: 'h',
    createdAt: '2026-05-01',
    ...over,
  };
}

describe('resolve', () => {
  it('picks latest-by-date as the current fact for a subject', () => {
    const old = fact({ body: 'flat', createdAt: '2026-01-01' });
    const recent = fact({ body: 'usage-based', createdAt: '2026-05-01' });
    const { current, unresolvedConflicts } = resolve([old, recent]);
    expect(unresolvedConflicts).toHaveLength(0);
    expect(current).toHaveLength(1);
    expect(current[0].body).toBe('usage-based');
  });

  it('excludes superseded facts from current (clean supersession beyond the window)', () => {
    const facts = [
      fact({ body: 'v1', createdAt: '2026-01-01' }),
      fact({ body: 'v2', createdAt: '2026-03-01' }),
      fact({ body: 'v3', createdAt: '2026-05-01' }),
    ];
    const { current, unresolvedConflicts } = resolve(facts);
    expect(unresolvedConflicts).toHaveLength(0);
    expect(current.map((f) => f.body)).toEqual(['v3']);
  });

  it('two recent facts that differ produce an unresolved conflict, not a silent pick', () => {
    const a = fact({ body: 'usage-based', createdAt: '2026-05-10' });
    const b = fact({ body: 'flat ¥9800', createdAt: '2026-05-15' });
    const { current, unresolvedConflicts } = resolve([a, b]);
    expect(current.find((f) => f.subject === 'pricing-model')).toBeUndefined();
    expect(unresolvedConflicts).toHaveLength(1);
    expect(unresolvedConflicts[0].subject).toBe('pricing-model');
    expect(unresolvedConflicts[0].facts.map((f) => f.body).sort()).toEqual(['flat ¥9800', 'usage-based']);
  });

  it('two recent facts with identical body are a re-affirmation, not a conflict', () => {
    const a = fact({ body: 'usage-based', createdAt: '2026-05-10' });
    const b = fact({ body: 'usage-based', createdAt: '2026-05-15' });
    const { current, unresolvedConflicts } = resolve([a, b]);
    expect(unresolvedConflicts).toHaveLength(0);
    expect(current).toHaveLength(1);
    expect(current[0].createdAt).toBe('2026-05-15');
  });

  it('facts far apart in time supersede even when bodies differ (outside the window)', () => {
    const a = fact({ body: 'flat', createdAt: '2026-01-01' });
    const b = fact({ body: 'usage-based', createdAt: '2026-05-01' });
    const { current, unresolvedConflicts } = resolve([a, b], { windowDays: 14 });
    expect(unresolvedConflicts).toHaveLength(0);
    expect(current[0].body).toBe('usage-based');
  });

  it('facts about different subjects never conflict', () => {
    const p = fact({ subject: 'pricing-model', body: 'usage-based', createdAt: '2026-05-15' });
    const port = fact({ subject: 'gateway-port', body: '19589', createdAt: '2026-05-15' });
    const { current, unresolvedConflicts } = resolve([p, port]);
    expect(unresolvedConflicts).toHaveLength(0);
    expect(current.map((f) => f.subject).sort()).toEqual(['gateway-port', 'pricing-model']);
  });

  it('respects a configurable window', () => {
    const a = fact({ body: 'a', createdAt: '2026-05-01' });
    const b = fact({ body: 'b', createdAt: '2026-05-20' }); // 19 days apart
    expect(resolve([a, b], { windowDays: 14 }).unresolvedConflicts).toHaveLength(0);
    expect(resolve([a, b], { windowDays: 30 }).unresolvedConflicts).toHaveLength(1);
  });
});
