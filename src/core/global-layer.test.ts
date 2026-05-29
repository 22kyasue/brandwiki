import { describe, it, expect } from 'vitest';
import { GlobalLayer, GLOBAL_PROJECT } from './global-layer.js';
import { FactLedger, MemoryLedgerStore } from './ledger.js';
import type { NewFact } from './fact.js';

function layer(): GlobalLayer {
  return new GlobalLayer(new FactLedger(new MemoryLedgerStore()));
}

function fact(over: Partial<NewFact> = {}): NewFact {
  return {
    project: GLOBAL_PROJECT,
    subject: 'gateway-port',
    body: 'mgr gateway on 19589',
    kind: 'copied',
    source: 'commit:x',
    sourceHash: 'h',
    createdAt: '2026-05-01',
    ...over,
  };
}

describe('GlobalLayer', () => {
  it('records cross-project facts under the global scope', () => {
    const g = layer();
    g.append(fact({ subject: 'gateway-port', body: 'mgr gateway on 19589' }));
    const { current } = g.resolved();
    expect(current.map((f) => f.body)).toContain('mgr gateway on 19589');
  });

  it('reuses the Resolver: latest-by-date and the Conflict-Gate apply globally', () => {
    const g = layer();
    g.append(fact({ subject: 'port', body: '19589', createdAt: '2026-01-01' }));
    g.append(fact({ subject: 'port', body: '19999', createdAt: '2026-05-01' }));
    const { current, unresolvedConflicts } = g.resolved();
    expect(unresolvedConflicts).toHaveLength(0);
    expect(current.find((f) => f.subject === 'port')!.body).toBe('19999');
  });

  it('registers projects into the roster and lists where each wiki lives', () => {
    const g = layer();
    g.registerProject('airsync', '~/githubproject/AirSync/.brandwiki', '2026-05-01');
    g.registerProject('yoyaku', '~/githubproject/yoyaku/.brandwiki', '2026-05-01');
    const roster = g.roster();
    expect(roster).toEqual([
      { project: 'airsync', wikiPath: '~/githubproject/AirSync/.brandwiki' },
      { project: 'yoyaku', wikiPath: '~/githubproject/yoyaku/.brandwiki' },
    ]);
  });

  it('a re-registered project updates to its latest path (append-only, latest wins)', () => {
    const g = layer();
    g.registerProject('airsync', '/old/path', '2026-01-01');
    g.registerProject('airsync', '/new/path', '2026-05-01');
    const roster = g.roster();
    expect(roster).toEqual([{ project: 'airsync', wikiPath: '/new/path' }]);
  });
});
