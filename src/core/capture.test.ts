import { describe, it, expect, vi } from 'vitest';
import { captureFacts, parseProposedFacts, buildCapturePrompt } from './capture.js';
import type { Artifact } from './capture.js';

const ctx = { project: 'airsync', createdAt: '2026-05-12' };

function artifact(over: Partial<Artifact> = {}): Artifact {
  return {
    ref: 'commit:abc123',
    content: 'Switched pricing to usage-based billing.',
    sourceHash: 'hash-abc',
    ...over,
  };
}

describe('parseProposedFacts', () => {
  it('extracts a JSON array of proposed facts from the response', () => {
    const resp = 'Here are the facts:\n[{"subject":"pricing","body":"usage-based","kind":"copied"}]\nDone.';
    const facts = parseProposedFacts(resp);
    expect(facts).toEqual([{ subject: 'pricing', body: 'usage-based', kind: 'copied' }]);
  });

  it('defaults an unknown/missing kind to copied', () => {
    const facts = parseProposedFacts('[{"subject":"x","body":"y"}]');
    expect(facts[0].kind).toBe('copied');
  });

  it('returns nothing when no JSON array is present', () => {
    expect(parseProposedFacts('No facts here.')).toEqual([]);
    expect(parseProposedFacts('[]')).toEqual([]);
  });

  it('drops entries missing subject or body', () => {
    expect(parseProposedFacts('[{"subject":"only"}]')).toEqual([]);
  });
});

describe('buildCapturePrompt', () => {
  it('asks for atomic, sourced facts and the pointer-vs-copied distinction', () => {
    const { system, user } = buildCapturePrompt(artifact({ content: 'port is 19589' }), ctx);
    expect(user).toContain('port is 19589');
    expect(system.toLowerCase()).toMatch(/pointer/);
    expect(system.toLowerCase()).toMatch(/atomic|single/);
  });
});

describe('captureFacts', () => {
  it('stamps proposed facts with the artifact ref, hash, project and date', async () => {
    const llm = vi.fn().mockResolvedValue('[{"subject":"pricing","body":"usage-based","kind":"copied"}]');
    const facts = await captureFacts([artifact()], ctx, llm);
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      project: 'airsync',
      subject: 'pricing',
      body: 'usage-based',
      kind: 'copied',
      source: 'commit:abc123',
      sourceHash: 'hash-abc',
      createdAt: '2026-05-12',
    });
  });

  it('uses a per-artifact createdAt when present, else the batch date', async () => {
    const llm = vi.fn().mockResolvedValue('[{"subject":"x","body":"y"}]');
    const facts = await captureFacts([artifact({ createdAt: '2025-12-01' })], ctx, llm);
    expect(facts[0].createdAt).toBe('2025-12-01');
  });

  it('attributes each fact to its own artifact across multiple inputs', async () => {
    const llm = vi
      .fn()
      .mockResolvedValueOnce('[{"subject":"a","body":"one"}]')
      .mockResolvedValueOnce('[{"subject":"b","body":"two"}]');
    const facts = await captureFacts(
      [artifact({ ref: 'commit:1', sourceHash: 'h1' }), artifact({ ref: 'adr:0003', sourceHash: 'h2' })],
      ctx,
      llm,
    );
    expect(facts.map((f) => [f.source, f.sourceHash])).toEqual([
      ['commit:1', 'h1'],
      ['adr:0003', 'h2'],
    ]);
  });
});
