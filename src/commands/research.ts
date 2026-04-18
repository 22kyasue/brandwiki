import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import {
  findProjectRoot,
  loadConfig,
  brandwikiDir,
  type BrandwikiConfig,
  type Competitor,
} from '../lib/config.js';
import { callLLM } from '../lib/anthropic.js';
import { sendNotification } from '../lib/notify.js';
import { compileCommand } from './compile.js';

interface ResearchOptions {
  competitor?: string;
  since?: string;
  compile?: boolean;
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s/\\]+/g, '-')
    .replace(/[^\p{L}\p{N}\-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function todayStamp(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function findLatestReport(dir: string, slug: string): string | null {
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir).filter((f) => f.endsWith(`-${slug}.md`));
  if (entries.length === 0) return null;
  entries.sort();
  return join(dir, entries[entries.length - 1]!);
}

function ensureResearchSource(config: BrandwikiConfig, bwDir: string): void {
  const hasResearch = config.sources.some((s) => s.path === 'raw/competitors');
  if (!hasResearch) {
    config.sources.push({ path: 'raw/competitors', type: 'markdown', glob: '**/*.md' });
    const configPath = join(bwDir, 'config.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(pc.green('  Added "raw/competitors" to sources in config.json'));
  }
}

function buildSystemPrompt(config: BrandwikiConfig): string {
  const language = config.language === 'ja' ? '日本語' : 'English';
  const override = config.research?.promptOverride;
  if (override) return override;

  return [
    `You are a competitive intelligence analyst for the project "${config.projectName}".`,
    `Research the target competitor and produce a ${language} Markdown report suitable for a brand wiki.`,
    '',
    'The report MUST:',
    '- Be grounded in information you can reason about from the provided context, links, and your general knowledge.',
    '- State uncertainty explicitly when facts are unclear or could not be verified.',
    '- Focus on what changed recently (product launches, pricing, positioning shifts, funding, hiring, strategic moves).',
    '- Be structured with clear Markdown headings.',
    '- Avoid marketing fluff and repeat boilerplate.',
    '',
    'Required sections (use these exact H2 headings):',
    '## エグゼクティブサマリー / Executive summary (3-5 bullets)',
    '## 現状のポジショニング / Current positioning',
    '## 最近の動き / Recent moves',
    '## 自社への示唆 / Implications for us',
    '## 情報源 / Sources',
    '',
    `Target language: ${language}. Total length: 400-900 words.`,
  ].join('\n');
}

function buildUserPrompt(
  config: BrandwikiConfig,
  competitor: Competitor,
  since: string | null,
  previousReport: string | null
): string {
  const urls = competitor.urls ?? [];
  const focus = competitor.focus ?? [];
  const parts: string[] = [];

  parts.push(`# Competitor: ${competitor.name}`);
  if (competitor.description) parts.push(`\n${competitor.description}`);
  parts.push('');
  parts.push(`## Our project`);
  parts.push(`- Name: ${config.projectName}`);
  const ownCategories = (config.categories ?? []).map((c) => `${c.title}`).join(', ');
  if (ownCategories) parts.push(`- Categories we care about: ${ownCategories}`);
  parts.push('');

  if (urls.length > 0) {
    parts.push(`## Reference URLs`);
    for (const u of urls) parts.push(`- ${u}`);
    parts.push('');
  }

  if (focus.length > 0) {
    parts.push(`## Focus areas for this research`);
    for (const f of focus) parts.push(`- ${f}`);
    parts.push('');
  }

  if (since) {
    parts.push(`## Time window`);
    parts.push(`Prioritize news and changes since ${since}.`);
    parts.push('');
  }

  if (previousReport) {
    parts.push(`## Previous report (for delta comparison — only include what changed)`);
    parts.push('```markdown');
    parts.push(previousReport.slice(0, 12000));
    parts.push('```');
    parts.push('');
  }

  parts.push(
    `Now produce the competitor brief. Begin with the Executive summary H2. Do not repeat this prompt.`
  );

  return parts.join('\n');
}

function formatReport(
  competitor: Competitor,
  body: string,
  config: BrandwikiConfig,
  since: string | null
): string {
  const now = new Date().toISOString();
  const cat = competitor.category ?? config.research?.targetCategory ?? 'bb-competitive';
  const tags = competitor.tags ?? ['competitor'];

  let md = `<!-- Source: research -->\n`;
  md += `<!-- Competitor: ${competitor.name} -->\n`;
  md += `<!-- ResearchedAt: ${now} -->\n`;
  if (since) md += `<!-- Since: ${since} -->\n`;
  md += `<!-- SuggestedCategory: ${cat} -->\n`;
  md += `<!-- Tags: ${tags.join(', ')} -->\n\n`;
  md += `# ${competitor.name} — 競合分析 (${todayStamp()})\n\n`;
  if (competitor.description) md += `> ${competitor.description}\n\n`;
  if ((competitor.urls ?? []).length > 0) {
    md += `**参照URL**:\n`;
    for (const u of competitor.urls!) md += `- ${u}\n`;
    md += '\n';
  }
  md += body.trim() + '\n';
  return md;
}

export async function researchCommand(options: ResearchOptions): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);
  const outDir = join(bwDir, 'raw', 'competitors');

  const competitors = config.research?.competitors ?? [];
  if (competitors.length === 0) {
    console.log(pc.yellow('No competitors defined in config.research.competitors.'));
    console.log(pc.dim('Add a "research.competitors" array to .brandwiki/config.json.'));
    console.log(
      pc.dim(
        JSON.stringify(
          {
            research: {
              targetCategory: 'bb-competitive',
              cadenceDays: 1,
              competitors: [
                {
                  name: 'Acme Corp',
                  description: 'Primary competitor — booking platform for SMBs',
                  urls: ['https://acme.example.com', 'https://twitter.com/acme'],
                  focus: ['pricing', 'feature-launches'],
                },
              ],
            },
          },
          null,
          2
        )
      )
    );
    return;
  }

  const targets = options.competitor
    ? competitors.filter(
        (c) =>
          c.name.toLowerCase() === options.competitor!.toLowerCase() ||
          toSlug(c.name) === toSlug(options.competitor!)
      )
    : competitors;

  if (targets.length === 0) {
    console.log(pc.red(`No competitor matching "${options.competitor}".`));
    return;
  }

  mkdirSync(outDir, { recursive: true });
  ensureResearchSource(config, bwDir);

  const since = options.since ?? null;
  const model =
    config.model.research ??
    config.model.compile ??
    'claude-sonnet-4-6';

  let researched = 0;
  let skipped = 0;
  let failed = 0;

  console.log(
    pc.cyan(
      `Researching ${targets.length} competitor${targets.length === 1 ? '' : 's'} for ${config.projectName}...`
    )
  );
  if (options.dryRun) console.log(pc.dim('  (dry-run: no LLM calls, no files written)'));

  for (const competitor of targets) {
    const slug = toSlug(competitor.name);
    const stamp = todayStamp();
    const destPath = join(outDir, `${stamp}-${slug}.md`);

    if (!options.force && existsSync(destPath)) {
      skipped++;
      if (options.verbose) console.log(pc.dim(`  skip (today's report exists): ${competitor.name}`));
      continue;
    }

    const prev = findLatestReport(outDir, slug);
    const prevContent = prev ? readFileSync(prev, 'utf-8') : null;

    console.log(pc.dim(`  researching: ${competitor.name}${prev ? ' (with prior report)' : ''}...`));

    if (options.dryRun) {
      researched++;
      continue;
    }

    try {
      const system = buildSystemPrompt(config);
      const user = buildUserPrompt(config, competitor, since, prevContent);
      const body = await callLLM({
        model,
        system,
        user,
        maxTokens: 4096,
        provider: config.provider,
        webSearch: true,
      });

      if (!body.trim()) {
        console.log(pc.red(`  ✗ empty response: ${competitor.name}`));
        failed++;
        continue;
      }

      const md = formatReport(competitor, body, config, since);
      writeFileSync(destPath, md, 'utf-8');
      researched++;
      console.log(pc.green(`  ✓ ${competitor.name}`) + pc.dim(` (${body.length} chars → ${destPath})`));
    } catch (err: any) {
      console.log(pc.red(`  ✗ ${competitor.name}: ${err.message}`));
      failed++;
    }
  }

  console.log('');
  console.log(
    pc.green(`✓ Researched ${researched} competitor${researched === 1 ? '' : 's'}`) +
      pc.dim(` (${skipped} skipped, ${failed} failed)`)
  );

  if (researched > 0 && !options.dryRun) {
    await sendNotification(
      config,
      'fetch',
      `Researched ${researched} competitor${researched === 1 ? '' : 's'} for ${config.projectName}`
    );

    if (options.compile) {
      console.log('');
      console.log(pc.cyan('Compiling wiki to fold in new research...'));
      await compileCommand({ force: false });
    } else {
      console.log(
        pc.dim('\nRun `brandwiki compile` to fold these into wiki articles, or use --compile to do it now.')
      );
    }
  }
}
