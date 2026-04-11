import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import fg from 'fast-glob';
import pc from 'picocolors';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { loadManifest, saveManifest, hashFile } from '../lib/manifest.js';
import { callLLM } from '../lib/anthropic.js';

interface CompileOptions {
  force?: boolean;
  dryRun?: boolean;
}

interface RawFile {
  path: string;
  relKey: string;
  content: string;
  hash: string;
  mtime: number;
}

const MAX_RAW_CHARS_PER_FILE = 40000;
const MAX_TOTAL_RAW_CHARS = 180000;

export async function compileCommand(options: CompileOptions): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);
  const manifest = loadManifest(bwDir);

  console.log(pc.cyan(`Compiling wiki for ${config.projectName}`));

  const rawFiles: RawFile[] = [];
  for (const source of config.sources) {
    const sourceDir = join(bwDir, source.path);
    if (!existsSync(sourceDir)) continue;
    const pattern = source.glob ?? '**/*';
    const files = await fg(pattern, { cwd: sourceDir, absolute: true, dot: false });
    for (const abs of files) {
      const stat = statSync(abs);
      if (!stat.isFile()) continue;
      if (stat.size > 500000) {
        console.log(pc.dim(`  skip (too large): ${relative(bwDir, abs)}`));
        continue;
      }
      let content = readFileSync(abs, 'utf-8');
      if (content.length > MAX_RAW_CHARS_PER_FILE) {
        content = content.slice(0, MAX_RAW_CHARS_PER_FILE) + '\n\n[... truncated ...]';
      }
      const relKey = relative(bwDir, abs).replaceAll('\\', '/');
      rawFiles.push({
        path: abs,
        relKey,
        content,
        hash: hashFile(abs),
        mtime: stat.mtimeMs,
      });
    }
  }

  console.log(pc.dim(`  raw files: ${rawFiles.length}`));

  if (rawFiles.length === 0) {
    console.log(pc.yellow('No raw files found. Drop content into .brandwiki/raw/ first.'));
    return;
  }

  const changed = options.force
    ? rawFiles
    : rawFiles.filter((f) => {
        const entry = manifest.rawFiles[f.relKey];
        return !entry || entry.hash !== f.hash;
      });

  console.log(pc.dim(`  changed: ${changed.length}`));

  if (changed.length === 0 && !options.force) {
    console.log(pc.green('✓ Wiki is up to date.'));
    return;
  }

  let raw = '';
  let used = 0;
  for (const f of rawFiles) {
    const block = `\n\n### SOURCE: ${f.relKey}\n\n${f.content}\n`;
    if (used + block.length > MAX_TOTAL_RAW_CHARS) {
      raw += `\n\n[... ${rawFiles.length - rawFiles.indexOf(f)} more source files omitted for size ...]\n`;
      break;
    }
    raw += block;
    used += block.length;
  }

  const langLabel = config.language === 'ja' ? '日本語' : 'English';
  const categoryList = config.categories
    .map((c) => `- ${c.id}: ${c.title} — ${c.description}`)
    .join('\n');

  const system = `You are a brand wiki compiler. Your job is to read raw source material and produce a structured Markdown knowledge base for the project "${config.projectName}".

Rules:
1. Write ALL article content in ${langLabel}.
2. Each article body must start with YAML frontmatter:
---
title: <article title>
category: <category-id>
status: draft
confidence: low | medium | high
updated: ${new Date().toISOString().split('T')[0]}
sources: [list of source file paths]
---
3. Use wiki-style [[backlinks]] to reference related articles.
4. Be factual — only write what the sources support. When uncertain, set confidence: low.
5. Organize information by CONCEPT, not by source file. Multiple sources should merge into one coherent article.
6. Prefer concise, structured prose (headings, bullet lists, tables).

OUTPUT FORMAT: Use this exact delimiter format. No JSON. No prose before or after.

===ARTICLE===
META: category=<category-id> | slug=<kebab-case-slug> | title=<human readable title>
---BODY---
<full markdown content including frontmatter>
===END===
===ARTICLE===
META: category=... | slug=... | title=...
---BODY---
...
===END===

Generate 8-15 high-value articles covering the most important concepts.

Available categories:
${categoryList}`;

  const user = `Compile the following raw sources into wiki articles. Focus on information that would help an AI agent or new team member deeply understand this project.

${raw}`;

  if (options.dryRun) {
    console.log(pc.yellow('--dry-run: would call LLM with:'));
    console.log(pc.dim(`  model: ${config.model.compile}`));
    console.log(pc.dim(`  system prompt: ${system.length} chars`));
    console.log(pc.dim(`  user prompt: ${user.length} chars`));
    return;
  }

  const provider = config.provider ?? 'claude-cli';
  console.log(pc.cyan(`Calling LLM (provider: ${provider}, model: ${config.model.compile})...`));
  const response = await callLLM({
    model: config.model.compile,
    system,
    user,
    maxTokens: 16000,
    provider,
  });

  const articles = parseArticles(response);
  if (articles.length === 0) {
    writeFileSync(join(bwDir, 'outputs', 'compile-error.txt'), response, 'utf-8');
    throw new Error('No articles parsed from LLM response. Raw saved to outputs/compile-error.txt');
  }

  console.log(pc.green(`✓ Received ${articles.length} articles`));

  let written = 0;
  for (const article of articles) {
    const catDir = join(bwDir, 'wiki', article.category);
    mkdirSync(catDir, { recursive: true });
    const filePath = join(catDir, `${article.slug}.md`);
    writeFileSync(filePath, article.content, 'utf-8');
    const words = article.content.split(/\s+/).length;
    manifest.articles[`${article.category}/${article.slug}`] = {
      sourceHashes: rawFiles.map((f) => f.hash),
      updatedAt: new Date().toISOString(),
      words,
    };
    written++;
    console.log(pc.dim(`  wrote ${article.category}/${article.slug}.md`));
  }

  for (const f of rawFiles) {
    manifest.rawFiles[f.relKey] = {
      path: f.relKey,
      hash: f.hash,
      mtime: f.mtime,
      processedAt: new Date().toISOString(),
    };
  }
  manifest.lastCompile = new Date().toISOString();
  saveManifest(bwDir, manifest);

  const indexContent = generateIndex(config, manifest);
  writeFileSync(join(bwDir, 'wiki', 'README.md'), indexContent, 'utf-8');

  console.log(pc.green(`✓ Compiled ${written} articles`));
}

function parseArticles(response: string): Array<{ category: string; slug: string; title: string; content: string }> {
  const articles: Array<{ category: string; slug: string; title: string; content: string }> = [];
  const blocks = response.split('===ARTICLE===').slice(1);
  for (const block of blocks) {
    const endIdx = block.indexOf('===END===');
    const section = endIdx === -1 ? block : block.slice(0, endIdx);
    const bodyIdx = section.indexOf('---BODY---');
    if (bodyIdx === -1) continue;
    const meta = section.slice(0, bodyIdx).trim();
    const body = section.slice(bodyIdx + '---BODY---'.length).trim();
    const metaLine = meta.replace(/^META:\s*/, '');
    const parts: Record<string, string> = {};
    for (const kv of metaLine.split('|')) {
      const [k, ...rest] = kv.trim().split('=');
      if (k && rest.length) parts[k.trim()] = rest.join('=').trim();
    }
    if (!parts.category || !parts.slug || !body) continue;
    articles.push({
      category: parts.category,
      slug: parts.slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
      title: parts.title ?? parts.slug,
      content: body,
    });
  }
  return articles;
}

function generateIndex(config: any, manifest: any): string {
  const lines = [`# ${config.projectName} Wiki`, '', `Last compiled: ${manifest.lastCompile}`, ''];
  const byCategory: Record<string, string[]> = {};
  for (const key of Object.keys(manifest.articles)) {
    const [cat, slug] = key.split('/');
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(slug);
  }
  for (const cat of config.categories) {
    const items = byCategory[cat.id] ?? [];
    if (items.length === 0) continue;
    lines.push(`## ${cat.title}`);
    lines.push(`_${cat.description}_`);
    lines.push('');
    for (const slug of items) {
      lines.push(`- [${slug}](./${cat.id}/${slug}.md)`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
