import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import fg from 'fast-glob';
import pc from 'picocolors';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { callLLM } from '../lib/anthropic.js';

export async function lintCommand(): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);

  const wikiDir = join(bwDir, 'wiki');
  const files = await fg('**/*.md', { cwd: wikiDir, absolute: true });
  const articles = files
    .filter((f) => !f.endsWith('README.md'))
    .map((f) => ({ path: f, content: readFileSync(f, 'utf-8') }));

  if (articles.length === 0) {
    console.log(pc.yellow('No articles to lint. Run `brandwiki compile` first.'));
    return;
  }

  console.log(pc.cyan(`Linting ${articles.length} articles...`));

  const combined = articles
    .map((a) => `\n\n### ARTICLE: ${a.path.split(/[\\/]/).slice(-2).join('/')}\n\n${a.content}`)
    .join('\n')
    .slice(0, 150000);

  const langLabel = config.language === 'ja' ? '日本語' : 'English';

  const system = `You are a wiki health inspector. Review the provided Markdown articles and report issues.

Report in ${langLabel}. Check for:
1. CONTRADICTIONS: facts that conflict across articles
2. MISSING DATA: claims without sources or key info gaps
3. STALE INFO: content that may be outdated
4. NEW ARTICLE CANDIDATES: topics implied but not covered
5. FRONTMATTER: missing or invalid frontmatter fields

Output format: Markdown report with sections for each category above. Be concise and actionable.`;

  const user = `Review these wiki articles:\n\n${combined}`;

  const provider = config.provider ?? 'claude-cli';
  const report = await callLLM({
    model: config.model.lint,
    system,
    user,
    maxTokens: 4096,
    provider,
  });

  const reportPath = join(bwDir, 'outputs', `lint-${new Date().toISOString().split('T')[0]}.md`);
  writeFileSync(reportPath, report, 'utf-8');
  console.log(pc.green(`✓ Lint report saved to ${reportPath}`));
  console.log();
  console.log(report);
}
