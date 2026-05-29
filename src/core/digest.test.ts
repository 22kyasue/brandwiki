import { describe, it, expect } from 'vitest';
import { buildDigest } from './digest.js';
import type { Fact } from './fact.js';

let counter = 0;
function fact(over: Partial<Fact> = {}): Fact {
  counter += 1;
  return {
    id: `f${counter}`,
    project: 'airsync',
    subject: 'subject',
    body: 'body',
    kind: 'copied',
    source: 'commit:x',
    sourceHash: 'h',
    createdAt: '2026-05-01',
    ...over,
  };
}

const now = new Date('2026-05-15T00:00:00Z');

describe('buildDigest', () => {
  it('is stamped do-not-edit / generated', () => {
    const d = buildDigest('airsync', { facts: [], memoryRules: [], now });
    expect(d.toLowerCase()).toContain('do not edit');
    expect(d.toLowerCase()).toContain('generated');
  });

  it('includes resolved durable (copied) facts', () => {
    const d = buildDigest('airsync', {
      facts: [fact({ kind: 'copied', subject: 'pricing', body: 'pricing is usage-based' })],
      memoryRules: [],
      now,
    });
    expect(d).toContain('pricing is usage-based');
  });

  it('renders Pointer Facts as live-source references, not inline copies', () => {
    const d = buildDigest('airsync', {
      facts: [fact({ kind: 'pointer', subject: 'pricing', body: 'config/pricing.ts' })],
      memoryRules: [],
      now,
    });
    expect(d).toContain('config/pricing.ts');
    // it tells the agent where to look, rather than presenting a value as fact
    expect(d.toLowerCase()).toMatch(/live truth|lives (at|in)|pointer/);
  });

  it('carries freshness dates inline', () => {
    const d = buildDigest('airsync', {
      facts: [fact({ body: 'a decision', createdAt: '2026-05-01' })],
      memoryRules: [],
      now,
    });
    expect(d).toContain('2026-05-01');
  });

  it('marks facts flagged stale', () => {
    const f = fact({ body: 'a decision', id: 'stale-one' });
    const d = buildDigest('airsync', {
      facts: [f],
      memoryRules: [],
      now,
      staleIds: new Set(['stale-one']),
    });
    expect(d.toLowerCase()).toContain('stale');
  });

  it('surfaces unresolved conflicts rather than silently picking', () => {
    const a = fact({ subject: 'pricing', body: 'usage-based', createdAt: '2026-05-10' });
    const b = fact({ subject: 'pricing', body: 'flat ¥9800', createdAt: '2026-05-15' });
    const d = buildDigest('airsync', { facts: [a, b], memoryRules: [], now });
    expect(d.toLowerCase()).toContain('conflict');
    expect(d).toContain('usage-based');
    expect(d).toContain('flat ¥9800');
  });

  it('composes in MEMORY behavior rules', () => {
    const d = buildDigest('airsync', {
      facts: [],
      memoryRules: ['Plain language, no jargon', 'Never ask, always proceed'],
      now,
    });
    expect(d).toContain('Plain language, no jargon');
    expect(d).toContain('Never ask, always proceed');
  });
});
