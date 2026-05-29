import type { Fact, ConflictPair } from './fact.js';
import type { LLMFn } from './llm.js';

export interface RenderConfig {
  projectName: string;
  language: 'ja' | 'en';
  categories: Array<{ id: string; title: string; description: string }>;
}

export interface RenderArticle {
  category: string;
  slug: string;
  title: string;
  content: string;
}

/**
 * The Renderer (ADR 0001): turns the resolved Fact Ledger into readable wiki
 * pages. One direction only — it is given facts and an LLM, and *cannot* reach
 * the ledger, so a bad render can never corrupt a Fact. It replaces the
 * destructive `compile` (which read raw/, invented articles, and overwrote
 * wiki/). The LLM here only *organizes and phrases* the supplied facts; it is
 * forbidden from inventing claims not present in them.
 */
export async function renderArticles(
  config: RenderConfig,
  facts: Fact[],
  conflicts: ConflictPair[],
  llm: LLMFn,
): Promise<RenderArticle[]> {
  if (facts.length === 0 && conflicts.length === 0) return [];
  const { system, user } = buildRenderPrompt(config, facts, conflicts);
  const response = await llm({ system, user });
  return parseRenderResponse(response);
}

export function buildRenderPrompt(
  config: RenderConfig,
  facts: Fact[],
  conflicts: ConflictPair[],
): { system: string; user: string } {
  const langLabel = config.language === 'ja' ? '日本語' : 'English';
  const categoryList = config.categories.map((c) => `- ${c.id}: ${c.title} — ${c.description}`).join('\n');

  const system = `You are the brandwiki Renderer for the project "${config.projectName}".

You are given a set of TRUSTED FACTS — atomic, sourced, dated claims — and must
organize them into a readable Markdown knowledge base. This is a *render* of an
append-only Fact Ledger, not an authoring task.

Hard rules:
1. Write ALL content in ${langLabel}.
2. Ground every statement in the supplied Facts. DO NOT invent, infer, or add
   any claim that is not present in the Facts. If the Facts don't cover a
   category, omit it — never pad.
3. A Pointer Fact gives a *location* where live truth lives (e.g. a config
   file). Render it as "see <location>", never copy a value as if it were fixed.
4. For any UNRESOLVED CONFLICT, present both claims side by side and label them
   unresolved — never silently pick one.
5. Organize by concept into the categories below; merge related Facts into one
   coherent article. Use [[backlinks]] between articles.

Each article body must start with YAML frontmatter:
---
title: <title>
category: <category-id>
updated: <the latest source date among the facts in this article>
sources: [source refs of the facts used]
---

OUTPUT FORMAT — use this exact delimiter, no prose before or after:

===ARTICLE===
META: category=<category-id> | slug=<kebab-case-slug> | title=<title>
---BODY---
<full markdown including frontmatter>
===END===

Available categories:
${categoryList}`;

  const user = `Render these trusted facts into wiki articles.

${formatFacts(facts)}${formatConflicts(conflicts)}`;

  return { system, user };
}

function formatFacts(facts: Fact[]): string {
  if (facts.length === 0) return 'TRUSTED FACTS: (none)\n';
  const lines = facts.map((f) => {
    const where = f.kind === 'pointer' ? `live truth lives at \`${f.body}\`` : f.body;
    return `- [${f.subject}] ${where}  (source: ${f.source}, dated ${f.createdAt})`;
  });
  return `TRUSTED FACTS:\n${lines.join('\n')}\n`;
}

function formatConflicts(conflicts: ConflictPair[]): string {
  if (conflicts.length === 0) return '';
  const blocks = conflicts.map((c) => {
    const options = c.facts.map((f) => `    - ${f.body} (source: ${f.source}, dated ${f.createdAt})`).join('\n');
    return `  [${c.subject}] UNRESOLVED CONFLICT — present both:\n${options}`;
  });
  return `\nUNRESOLVED CONFLICTS:\n${blocks.join('\n')}\n`;
}

/** Parse the delimited Renderer response. Tolerant of malformed blocks. */
export function parseRenderResponse(response: string): RenderArticle[] {
  const articles: RenderArticle[] = [];
  const blocks = response.split('===ARTICLE===').slice(1);
  for (const block of blocks) {
    const endIdx = block.indexOf('===END===');
    const section = endIdx === -1 ? block : block.slice(0, endIdx);
    const bodyIdx = section.indexOf('---BODY---');
    if (bodyIdx === -1) continue;
    const meta = section.slice(0, bodyIdx).trim().replace(/^META:\s*/, '');
    const body = section.slice(bodyIdx + '---BODY---'.length).trim();
    if (!body) continue;
    const parts: Record<string, string> = {};
    for (const kv of meta.split('|')) {
      const [k, ...rest] = kv.trim().split('=');
      if (k && rest.length) parts[k.trim()] = rest.join('=').trim();
    }
    if (!parts.category || !parts.slug) continue;
    articles.push({
      category: parts.category,
      slug: parts.slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
      title: parts.title ?? parts.slug,
      content: body,
    });
  }
  return articles;
}
