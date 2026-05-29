import { describe, it, expect } from 'vitest';
import { resolvePointer } from './pointer-resolver.js';
import type { Fact } from './fact.js';

function pointer(over: Partial<Fact> = {}): Fact {
  return {
    id: 'f1',
    project: 'airsync',
    subject: 'pricing',
    body: 'config/pricing.ts',
    kind: 'pointer',
    source: 'commit:x',
    sourceHash: 'h',
    createdAt: '2026-05-01',
    ...over,
  };
}

function reader(map: Record<string, string>) {
  return (target: string): string | null => (target in map ? map[target] : null);
}

describe('resolvePointer', () => {
  it('reads the referenced live source and returns its current value', () => {
    const r = resolvePointer(pointer({ body: 'config/pricing.ts' }), reader({ 'config/pricing.ts': 'export const PRICE = 9800;' }));
    expect(r.found).toBe(true);
    expect(r.target).toBe('config/pricing.ts');
    expect(r.value).toBe('export const PRICE = 9800;');
  });

  it('reports not-found when the live source is missing', () => {
    const r = resolvePointer(pointer({ body: 'config/gone.ts' }), reader({}));
    expect(r.found).toBe(false);
    expect(r.value).toBeNull();
  });

  it('refuses to resolve a copied fact (only pointer facts point at a source)', () => {
    expect(() => resolvePointer(pointer({ kind: 'copied' }), reader({}))).toThrow();
  });
});
