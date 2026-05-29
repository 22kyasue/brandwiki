import { describe, it, expect } from 'vitest';
import { FactLedger, MemoryLedgerStore } from './ledger.js';
import type { NewFact } from './fact.js';

function newFact(over: Partial<NewFact> = {}): NewFact {
  return {
    project: 'airsync',
    subject: 'pricing-model',
    body: 'pricing is usage-based',
    kind: 'copied',
    source: 'commit:abc123',
    sourceHash: 'deadbeef',
    createdAt: '2026-05-01',
    ...over,
  };
}

function ledger(): FactLedger {
  return new FactLedger(new MemoryLedgerStore());
}

describe('FactLedger', () => {
  it('append returns a fact with a stable assigned id', () => {
    const l = ledger();
    const f = l.append(newFact());
    expect(f.id).toBeTruthy();
    expect(f.body).toBe('pricing is usage-based');
  });

  it('appending never mutates or removes prior facts', () => {
    const l = ledger();
    const first = l.append(newFact({ body: 'flat ¥9800/mo', createdAt: '2026-04-01' }));
    l.append(newFact({ body: 'usage-based', createdAt: '2026-05-01' }));

    const all = l.all('airsync');
    expect(all).toHaveLength(2);
    // the original fact survives verbatim
    const stillThere = all.find((x) => x.id === first.id);
    expect(stillThere).toBeDefined();
    expect(stillThere!.body).toBe('flat ¥9800/mo');
  });

  it('query returns all matching facts including superseded ones', () => {
    const l = ledger();
    l.append(newFact({ body: 'v1', createdAt: '2026-04-01' }));
    l.append(newFact({ body: 'v2', createdAt: '2026-05-01' }));
    l.append(newFact({ subject: 'ports', body: 'gateway 19589' }));

    const pricing = l.query({ project: 'airsync', subject: 'pricing-model' });
    expect(pricing.map((f) => f.body).sort()).toEqual(['v1', 'v2']);
  });

  it('query filters by project', () => {
    const l = ledger();
    l.append(newFact({ project: 'airsync' }));
    l.append(newFact({ project: 'yoyaku' }));
    expect(l.query({ project: 'yoyaku' })).toHaveLength(1);
  });

  it('returned objects cannot be used to corrupt stored state', () => {
    const l = ledger();
    l.append(newFact({ body: 'original' }));
    const got = l.all('airsync');
    // mutate the returned copy
    (got[0] as { body: string }).body = 'tampered';
    // re-read from the ledger — storage is untouched
    expect(l.all('airsync')[0].body).toBe('original');
  });

  it('identical facts appended twice both persist with distinct ids', () => {
    const l = ledger();
    const a = l.append(newFact());
    const b = l.append(newFact());
    expect(a.id).not.toBe(b.id);
    expect(l.all('airsync')).toHaveLength(2);
  });
});
