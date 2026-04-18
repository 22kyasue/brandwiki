import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import fg from 'fast-glob';
import pc from 'picocolors';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { callLLM } from '../lib/anthropic.js';
import { sendNotification } from '../lib/notify.js';

export interface LintIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  articles: string[];
  description: string;
  suggestion: string;
}

export interface LintResult {
  issues: LintIssue[];
  rawReport: string;
  timestamp: string;
  articleCount: number;
}

function parseMarkdownReport(report: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const lines = report.split('\n');
  let currentCategory = '';
  let currentSeverity: 'critical' | 'warning' | 'info' = 'info';

  const severityMap: Record<string, 'critical' | 'warning' | 'info'> = {
    contradiction: 'critical',
    contradictions: 'critical',
    missing: 'warning',
    'missing data': 'warning',
    stale: 'warning',
    'stale info': 'warning',
    'new article': 'info',
    'new article candidates': 'info',
    frontmatter: 'warning',
  };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+\d*\.?\s*(.+)/);
    if (headingMatch) {
      currentCategory = headingMatch[1].trim();
      const lowerCat = currentCategory.toLowerCase();
      for (const [key, sev] of Object.entries(severityMap)) {
        if (lowerCat.includes(key)) {
          currentSeverity = sev;
          break;
        }
      }
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch && currentCategory) {
      const text = bulletMatch[1].trim();
      const articleMatches = text.match(/`([^`]+)`/g);
      const articles = articleMatches
        ? articleMatches.map((m) => m.replace(/`/g, ''))
        : [];

      // Split on common suggestion patterns
      const suggestionSplit = text.split(/[.。]\s*(?:suggest|recomm|fix|対策|提案|修正)/i);
      const description = suggestionSplit[0].replace(/`[^`]*`/g, '').trim() || text;
      const suggestion = suggestionSplit.length > 1
        ? suggestionSplit.slice(1).join('. ').trim()
        : '';

      issues.push({
        severity: currentSeverity,
        category: currentCategory,
        articles,
        description: description.replace(/^[-*]\s*/, ''),
        suggestion,
      });
    }
  }

  // If parsing produced no issues but report has content, create a single info issue
  if (issues.length === 0 && report.trim().length > 0) {
    issues.push({
      severity: 'info',
      category: 'General',
      articles: [],
      description: 'Lint report generated. See raw report for details.',
      suggestion: 'Review the raw markdown report below.',
    });
  }

  return issues;
}

export async function runLint(bwDirPath: string): Promise<LintResult> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = bwDirPath;

  const wikiDir = join(bwDir, 'wiki');
  const files = await fg('**/*.md', { cwd: wikiDir, absolute: true });
  const articles = files
    .filter((f) => !f.endsWith('README.md'))
    .map((f) => ({ path: f, content: readFileSync(f, 'utf-8') }));

  if (articles.length === 0) {
    return {
      issues: [],
      rawReport: 'No articles to lint.',
      timestamp: new Date().toISOString(),
      articleCount: 0,
    };
  }

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

  const issues = parseMarkdownReport(report);
  const result: LintResult = {
    issues,
    rawReport: report,
    timestamp: new Date().toISOString(),
    articleCount: articles.length,
  };

  // Save structured results
  const outputsDir = join(bwDir, 'outputs');
  mkdirSync(outputsDir, { recursive: true });
  writeFileSync(join(outputsDir, 'lint-results.json'), JSON.stringify(result, null, 2), 'utf-8');

  return result;
}

export async function lintCommand(): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);

  const result = await runLint(bwDir);

  if (result.articleCount === 0) {
    console.log(pc.yellow('No articles to lint. Run `brandwiki compile` first.'));
    return;
  }

  console.log(pc.cyan(`Linting ${result.articleCount} articles...`));

  const reportPath = join(bwDir, 'outputs', `lint-${new Date().toISOString().split('T')[0]}.md`);
  writeFileSync(reportPath, result.rawReport, 'utf-8');
  console.log(pc.green(`✓ Lint report saved to ${reportPath}`));
  console.log(pc.green(`✓ Structured results saved to outputs/lint-results.json`));
  console.log(`  Found ${result.issues.length} issues`);
  console.log();
  console.log(result.rawReport);

  await sendNotification(
    config,
    'lint',
    `Lint completed for ${config.projectName}: ${result.issues.length} issues found`
  );
}
