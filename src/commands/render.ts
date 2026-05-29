import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { openLedger, projectKey, makeLLM } from '../lib/stores.js';
import { resolve } from '../core/resolver.js';
import { renderArticles, type RenderArticle } from '../core/renderer.js';

interface RenderOptions {
  dryRun?: boolean;
}

/**
 * Render the Fact Ledger into wiki/ pages (ADR 0001). Replaces the destructive
 * `compile`: it reads facts and writes Renders, and never writes back to the
 * ledger. wiki/ is fully regenerated — Renders are disposable by design.
 */
export async function renderCommand(options: RenderOptions): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);
  const ledger = openLedger(bwDir);

  const facts = ledger.all(projectKey(config));
  const { current, unresolvedConflicts } = resolve(facts, { windowDays: config.conflictWindowDays });

  console.log(pc.cyan(`Rendering ${config.projectName} from ${facts.length} facts (${current.length} current, ${unresolvedConflicts.length} unresolved conflicts)`));

  if (facts.length === 0) {
    console.log(pc.yellow('Ledger is empty — nothing to render. Capture facts first (`brandwiki capture`).'));
    return;
  }

  if (options.dryRun) {
    console.log(pc.dim('  --dry-run: would call the LLM to render the facts above; no files written.'));
    return;
  }

  const articles = await renderArticles(config, current, unresolvedConflicts, makeLLM(config, config.model.compile));
  if (articles.length === 0) {
    throw new Error('Renderer produced no articles from a non-empty ledger — inspect the LLM output.');
  }

  const wikiDir = join(bwDir, 'wiki');
  if (existsSync(wikiDir)) rmSync(wikiDir, { recursive: true, force: true });
  mkdirSync(wikiDir, { recursive: true });

  for (const article of articles) {
    const catDir = join(wikiDir, article.category);
    mkdirSync(catDir, { recursive: true });
    writeFileSync(join(catDir, `${article.slug}.md`), article.content, 'utf-8');
    console.log(pc.dim(`  wrote ${article.category}/${article.slug}.md`));
  }
  writeFileSync(join(wikiDir, 'README.md'), buildIndex(config.projectName, articles), 'utf-8');

  console.log(pc.green(`✓ Rendered ${articles.length} articles`));
}

function buildIndex(projectName: string, articles: RenderArticle[]): string {
  const lines = [`# ${projectName} Wiki`, '', '_Generated from the Fact Ledger — do not edit._', ''];
  const byCategory = new Map<string, RenderArticle[]>();
  for (const a of articles) {
    const group = byCategory.get(a.category) ?? [];
    group.push(a);
    byCategory.set(a.category, group);
  }
  for (const [category, group] of byCategory) {
    lines.push(`## ${category}`);
    for (const a of group) lines.push(`- [${a.title}](./${category}/${a.slug}.md)`);
    lines.push('');
  }
  return lines.join('\n');
}
