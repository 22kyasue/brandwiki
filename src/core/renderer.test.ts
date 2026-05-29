import { describe, it, expect, vi } from 'vitest';
import { renderArticles, parseRenderResponse, buildRenderPrompt } from './renderer.js';
import type { Fact } from './fact.js';

let counter = 0;
function fact(over: Partial<Fact> = {}): Fact {
  counter += 1;
  return {
    id: `f${counter}`,
    project: 'airsync',
    subject: 'pricing-model',
    body: 'pricing is usage-based',
    kind: 'copied',
    source: 'commit:abc',
    sourceHash: 'h',
    createdAt: '2026-05-01',
    ...over,
  };
}

const config = {
  projectName: 'AirSync',
  language: 'en' as const,
  categories: [
    { id: '01-overview', title: 'Overview', description: 'Mission and scope' },
    { id: '03-architecture', title: 'Architecture', description: 'System design' },
  ],
};

const SAMPLE_RESPONSE = `===ARTICLE===
META: category=01-overview | slug=pricing | title=Pricing Model
---BODY---
---
title: Pricing Model
category: 01-overview
---
AirSync pricing is usage-based.
===END===`;

describe('parseRenderResponse', () => {
  it('parses delimited articles into category/slug/title/content', () => {
    const articles = parseRenderResponse(SAMPLE_RESPONSE);
    expect(articles).toHaveLength(1);
    expect(articles[0].category).toBe('01-overview');
    expect(articles[0].slug).toBe('pricing');
    expect(articles[0].content).toContain('usage-based');
  });

  it('ignores malformed blocks without a body', () => {
    expect(parseRenderResponse('===ARTICLE===\nMETA: junk\n===END===')).toHaveLength(0);
  });
});

describe('buildRenderPrompt', () => {
  it('grounds the prompt in the facts and forbids inventing new ones', () => {
    const { system, user } = buildRenderPrompt(config, [fact({ body: 'uses Postgres' })], []);
    expect(user).toContain('uses Postgres');
    expect(system.toLowerCase()).toMatch(/do not invent|only.*fact|grounded/);
  });

  it('renders pointer facts as their live location, not a copied value', () => {
    const { user } = buildRenderPrompt(config, [fact({ kind: 'pointer', body: 'config/pricing.ts' })], []);
    expect(user).toContain('config/pricing.ts');
  });

  it('surfaces unresolved conflicts to the model', () => {
    const a = fact({ subject: 'port', body: '19589' });
    const b = fact({ subject: 'port', body: '19999' });
    const { user } = buildRenderPrompt(config, [], [{ subject: 'port', facts: [a, b] }]);
    expect(user.toLowerCase()).toContain('conflict');
    expect(user).toContain('19589');
    expect(user).toContain('19999');
  });
});

describe('renderArticles', () => {
  it('returns parsed articles from the LLM response', async () => {
    const llm = vi.fn().mockResolvedValue(SAMPLE_RESPONSE);
    const articles = await renderArticles(config, [fact()], [], llm);
    expect(llm).toHaveBeenCalledOnce();
    expect(articles[0].slug).toBe('pricing');
  });

  it('does not call the LLM when there is nothing to render', async () => {
    const llm = vi.fn().mockResolvedValue('');
    const articles = await renderArticles(config, [], [], llm);
    expect(llm).not.toHaveBeenCalled();
    expect(articles).toEqual([]);
  });
});
