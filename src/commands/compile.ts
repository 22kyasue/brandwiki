import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import fg from 'fast-glob';
import pc from 'picocolors';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { loadManifest, saveManifest, hashFile } from '../lib/manifest.js';
import { callLLM } from '../lib/anthropic.js';
import { sendNotification } from '../lib/notify.js';

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

  // Post-compile: scan for link suggestions
  scanLinkSuggestions(bwDir);

  // === Brandbook Generation (2nd pass) ===
  await compileBrandbook(bwDir, config, provider, manifest);

  await sendNotification(config, 'compile', `Compiled ${written} articles for ${config.projectName}`);
}

const BRANDBOOK_SECTIONS = [
  { id: 'bb-brand-foundation', title: 'ブランド基盤', sections: [
    { slug: 'brand-dna', title: 'ブランドDNA', prompt: 'ミッション・ビジョン・バリューと、なぜそれを選んだか（原点ストーリー）を書いてください。' },
    { slug: 'brand-voice', title: 'ブランドボイス辞書', prompt: '「こう言う / こう言わない」のトーン＆マナー対照表を作成してください。実際の wiki 記事から口調や表現パターンを抽出し、ブランドに一貫したボイスガイドラインを整理してください。' },
    { slug: 'brand-storyline', title: 'ブランドストーリーライン', prompt: '創業から現在、そして未来へのブランドナラティブを一本のストーリーとして書いてください。' },
  ]},
  { id: 'bb-competitive', title: '競合・市場ポジション', sections: [
    { slug: 'competitor-matrix', title: '競合比較マトリクス', prompt: '自社 vs 競合の機能/価格/UX/ブランド力をマークダウンの表で整理してください。外部ソースから取得した競合データがあれば活用してください。' },
    { slug: 'positioning-statement', title: 'ポジショニングステートメント', prompt: '「我々は [ターゲット] のために [差別化] を提供する [カテゴリ] である」形式のポジショニングステートメントを生成してください。根拠となるデータも添えてください。' },
    { slug: 'differentiation-map', title: '差別化マップ', prompt: '競合と自社の「同じところ」と「違うところ」を視覚的に整理してください。マークダウンの表やリストを使って差別化ポイントを明確にしてください。' },
    { slug: 'whitespace-analysis', title: 'ホワイトスペース分析', prompt: '競合がカバーしていない領域（ホワイトスペース）を分析し、自社が狙える未開拓の機会を特定してください。' },
  ]},
  { id: 'bb-partnership', title: 'パートナーシップ戦略', sections: [
    { slug: 'partner-candidates', title: 'パートナー候補プロファイル', prompt: '提携候補となりうる企業を特定し、各企業について「組む理由 / シナジー / リスク」をプロファイル形式で書いてください。外部ソースの企業データがあれば活用してください。' },
    { slug: 'partnership-scenarios', title: '提携シナリオ', prompt: '有力な提携候補について「もし A 社と組んだ場合」のメリット/デメリットをストーリー形式で書いてください。' },
    { slug: 'value-chain', title: 'バリューチェーン補完分析', prompt: '自社のバリューチェーン上の弱点を特定し、それを補える企業はどこかを分析してください。' },
  ]},
  { id: 'bb-persona', title: 'ユーザー・ペルソナ', sections: [
    { slug: 'persona-cards', title: 'ペルソナカード', prompt: 'プロジェクトの主要ペルソナを特定し、各ペルソナの行動パターン、課題、ブランド接点を1枚のカード形式で書いてください。' },
    { slug: 'customer-journey', title: 'カスタマージャーニーマップ', prompt: '認知 → 検討 → 利用 → 推奨の各フェーズにおけるタッチポイントとブランド体験をマップ形式で書いてください。' },
    { slug: 'switching-analysis', title: 'ペルソナ × 競合スイッチング分析', prompt: 'どのペルソナが競合に流れやすいか、防ぐには何が必要かを分析してください。' },
  ]},
  { id: 'bb-design', title: 'デザイン・表現', sections: [
    { slug: 'visual-identity', title: 'ビジュアルアイデンティティガイド', prompt: 'ロゴ使用規定、カラーパレット、タイポグラフィなどのビジュアルアイデンティティガイドラインを wiki のデザインシステム情報から抽出して書いてください。' },
    { slug: 'ui-copy-guidelines', title: 'UIコピーガイドライン', prompt: 'ボタン文言、エラーメッセージ、通知テキストのトーン統一ルールを書いてください。実際のコードやi18nデータがあれば参照してください。' },
  ]},
  { id: 'bb-strategy', title: '未来戦略', sections: [
    { slug: 'brand-vision-3y', title: '3年後のブランドビジョン', prompt: '現在の wiki 情報と市場データから、3年後の理想的なブランドの姿を描写してください。具体的な目標や到達イメージを含めてください。' },
    { slug: 'expansion-scenarios', title: 'ブランド拡張シナリオ', prompt: '新しいカテゴリ、市場、ユーザー層に展開する場合の戦略シナリオを書いてください。' },
    { slug: 'risk-map', title: 'リスクマップ', prompt: 'ブランドにとっての脅威（規制変更、競合参入、技術変化など）とその対応策をマップ形式で整理してください。' },
    { slug: 'swot', title: 'SWOT 分析', prompt: 'wiki 全体の情報から、自社プロジェクトの Strengths / Weaknesses / Opportunities / Threats を網羅的に分析してください。' },
    { slug: 'kpi-dashboard', title: 'KPI ダッシュボード定義', prompt: 'ブランド健全性を測る指標（認知度、NPS、リテンション率など）を定義し、各 KPI の測定方法と目標値を書いてください。' },
  ]},
];

async function compileBrandbook(
  bwDir: string,
  config: any,
  provider: 'claude-cli' | 'api',
  manifest: any
): Promise<void> {
  // Load all existing wiki articles as context
  const wikiDir = join(bwDir, 'wiki');
  if (!existsSync(wikiDir)) return;

  const wikiFiles = await fg('**/*.md', { cwd: wikiDir, dot: false });
  const filteredFiles = wikiFiles.filter((f) => !f.endsWith('README.md'));

  if (filteredFiles.length === 0) {
    console.log(pc.dim('  (no wiki articles yet — skipping brandbook generation)'));
    return;
  }

  let wikiContext = '';
  let contextSize = 0;
  const MAX_CONTEXT = 120000;
  for (const f of filteredFiles) {
    const content = readFileSync(join(wikiDir, f), 'utf-8');
    const block = `\n### WIKI ARTICLE: ${f}\n${content}\n`;
    if (contextSize + block.length > MAX_CONTEXT) break;
    wikiContext += block;
    contextSize += block.length;
  }

  // Also include external sources if available
  const extDir = join(bwDir, 'raw', 'external');
  if (existsSync(extDir)) {
    const extFiles = await fg('**/*.md', { cwd: extDir, dot: false });
    for (const f of extFiles) {
      const content = readFileSync(join(extDir, f), 'utf-8');
      const block = `\n### EXTERNAL SOURCE: ${f}\n${content}\n`;
      if (contextSize + block.length > MAX_CONTEXT) break;
      wikiContext += block;
      contextSize += block.length;
    }
  }

  // Ensure brandbook categories exist in config
  const configPath = join(bwDir, 'config.json');
  let configUpdated = false;
  for (const group of BRANDBOOK_SECTIONS) {
    if (!config.categories.some((c: any) => c.id === group.id)) {
      config.categories.push({
        id: group.id,
        title: group.title,
        description: `Brandbook: ${group.title}`,
      });
      configUpdated = true;
    }
  }
  if (configUpdated) {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(pc.green('  Added brandbook categories to config.json'));
  }

  console.log(pc.cyan(`\nGenerating brandbook sections...`));
  console.log(pc.dim(`  wiki context: ${filteredFiles.length} articles (${Math.round(contextSize / 1024)}KB)`));

  const langLabel = config.language === 'ja' ? '日本語' : 'English';

  // Generate brandbook sections GROUP BY GROUP to avoid timeout
  const today = new Date().toISOString().split('T')[0];
  let totalGenerated = 0;

  for (const group of BRANDBOOK_SECTIONS) {
    const sectionPrompts = group.sections
      .map((s) => `### ${s.title}\nCategory ID: ${group.id}\nSlug: ${s.slug}\nInstructions: ${s.prompt}`)
      .join('\n\n');

    const bbSystem = `You are a strategic brand consultant and brand book author. Based on the project wiki and external research data provided, generate comprehensive brandbook sections for the "${group.title}" category.

Rules:
1. Write ALL content in ${langLabel}.
2. Each section must start with YAML frontmatter:
---
title: <section title>
category: ${group.id}
status: draft
confidence: medium
updated: ${today}
sources: [wiki]
---
3. Use wiki-style [[backlinks]] to reference related wiki articles.
4. Be strategic and actionable — this is a real brand book, not a summary.
5. Use tables, bullet lists, and structured prose. Include concrete examples from the wiki data.
6. When competitive/external data is available, incorporate it with citations.
7. Each section should be 300-800 words — substantive but focused.

OUTPUT FORMAT:
===ARTICLE===
META: category=${group.id} | slug=<slug> | title=<title>
---BODY---
<full markdown with frontmatter>
===END===

Generate these sections:

${sectionPrompts}`;

    const bbUser = `Generate the "${group.title}" brandbook sections for:

PROJECT: ${config.projectName}

${wikiContext}`;

    try {
      console.log(pc.cyan(`  [${group.title}] Generating ${group.sections.length} sections...`));
      const response = await callLLM({
        model: config.model.compile,
        system: bbSystem,
        user: bbUser,
        maxTokens: 8000,
        provider,
      });

      const bbArticles = parseArticles(response);
      if (bbArticles.length === 0) {
        console.log(pc.yellow(`  ⚠ [${group.title}] No sections generated`));
        continue;
      }

      for (const article of bbArticles) {
        const catDir = join(bwDir, 'wiki', article.category);
        mkdirSync(catDir, { recursive: true });
        const filePath = join(catDir, `${article.slug}.md`);
        writeFileSync(filePath, article.content, 'utf-8');
        const words = article.content.split(/\s+/).length;
        manifest.articles[`${article.category}/${article.slug}`] = {
          sourceHashes: ['brandbook'],
          updatedAt: new Date().toISOString(),
          words,
        };
        console.log(pc.dim(`    wrote ${article.category}/${article.slug}.md`));
      }
      totalGenerated += bbArticles.length;
      console.log(pc.green(`  ✓ [${group.title}] ${bbArticles.length} sections`));

    } catch (err: any) {
      console.log(pc.red(`  ✗ [${group.title}] Error: ${err.message}`));
      console.log(pc.dim('    (skipping this group, continuing with next)'));
    }
  }

  if (totalGenerated > 0) {
    manifest.lastCompile = new Date().toISOString();
    saveManifest(bwDir, manifest);
    console.log(pc.green(`\n✓ Brandbook: ${totalGenerated} sections generated across ${BRANDBOOK_SECTIONS.length} categories`));
  } else {
    console.log(pc.yellow('\n⚠ No brandbook sections were generated'));
  }
}

interface LinkSuggestion {
  sourceArticle: string;
  sourceTitle: string;
  targetArticle: string;
  targetTitle: string;
  context: string;
}

async function scanLinkSuggestions(bwDir: string): Promise<void> {
  const wikiDir = join(bwDir, 'wiki');
  if (!existsSync(wikiDir)) return;

  // Collect all articles
  const articleFiles: Array<{ key: string; title: string; slug: string; body: string }> = [];
  const categories = (await fg('**/*.md', { cwd: wikiDir, dot: false }))
    .filter((f: string) => !f.endsWith('README.md'));

  for (const relPath of categories) {
    const fullPath = join(wikiDir, relPath);
    const raw = readFileSync(fullPath, 'utf-8');
    // Extract title from frontmatter manually (avoid importing gray-matter)
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    let title = '';
    if (fmMatch) {
      const titleMatch = fmMatch[1].match(/^title:\s*(.+)$/m);
      if (titleMatch) title = titleMatch[1].trim().replace(/^["']|["']$/g, '');
    }
    const [cat, fname] = relPath.replace(/\\/g, '/').split('/');
    if (!cat || !fname) continue;
    const slug = fname.replace(/\.md$/, '');
    const key = `${cat}/${slug}`;
    const body = fmMatch ? raw.slice(fmMatch[0].length) : raw;
    articleFiles.push({ key, title: title || slug, slug, body });
  }

  const suggestions: LinkSuggestion[] = [];

  for (const source of articleFiles) {
    // Extract existing backlinks from this article
    const existingLinks = new Set<string>();
    const linkMatches = source.body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
    for (const m of linkMatches) {
      existingLinks.add(m[1].trim().toLowerCase());
    }

    for (const target of articleFiles) {
      if (target.key === source.key) continue;
      // Skip if already linked
      if (existingLinks.has(target.title.toLowerCase())) continue;
      if (existingLinks.has(target.slug.toLowerCase())) continue;

      // Check if the target title or slug appears in the source body text (case-insensitive)
      const titleLc = target.title.toLowerCase();
      const bodyLc = source.body.toLowerCase();
      const idx = bodyLc.indexOf(titleLc);
      if (idx === -1) continue;

      // Extract context around the mention
      const contextStart = Math.max(0, idx - 40);
      const contextEnd = Math.min(source.body.length, idx + titleLc.length + 40);
      const context = source.body.slice(contextStart, contextEnd).replace(/\n/g, ' ').trim();

      suggestions.push({
        sourceArticle: source.key,
        sourceTitle: source.title,
        targetArticle: target.key,
        targetTitle: target.title,
        context: (contextStart > 0 ? '...' : '') + context + (contextEnd < source.body.length ? '...' : ''),
      });
    }
  }

  // Write suggestions
  const outputsDir = join(bwDir, 'outputs');
  mkdirSync(outputsDir, { recursive: true });
  const suggestionsPath = join(outputsDir, 'link-suggestions.json');
  writeFileSync(suggestionsPath, JSON.stringify(suggestions, null, 2), 'utf-8');

  if (suggestions.length > 0) {
    console.log(pc.cyan(`  ${suggestions.length} link suggestions written to outputs/link-suggestions.json`));
    for (const s of suggestions.slice(0, 5)) {
      console.log(pc.dim(`    "${s.sourceTitle}" mentions "${s.targetTitle}" — consider adding [[${s.targetTitle}]]`));
    }
    if (suggestions.length > 5) {
      console.log(pc.dim(`    ... and ${suggestions.length - 5} more`));
    }
  }
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
