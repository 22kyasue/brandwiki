import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import {
  findProjectRoot,
  loadConfig,
  brandwikiDir,
  type ExternalSource,
  type BrandwikiConfig,
} from '../lib/config.js';
import { sendNotification } from '../lib/notify.js';

interface FetchOptions {
  force?: boolean;
  verbose?: boolean;
}

interface WikipediaExtract {
  title: string;
  pageid: number;
  extract: string;
  description?: string;
  categories: string[];
  links: string[];
}

async function fetchWikipediaArticle(
  title: string,
  lang: string
): Promise<WikipediaExtract | null> {
  const endpoint = `https://${lang}.wikipedia.org/w/api.php`;
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'extracts|pageprops|categories|links',
    explaintext: 'true',
    exlimit: '1',
    cllimit: '20',
    pllimit: '50',
    format: 'json',
    redirects: '1',
  });

  const res = await fetch(`${endpoint}?${params}`);
  if (!res.ok) return null;

  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) return null;

  const page = Object.values(pages)[0] as any;
  if (!page || page.missing !== undefined) return null;

  const categories = (page.categories ?? []).map((c: any) =>
    c.title.replace(/^Category:|^カテゴリ:/, '')
  );
  const links = (page.links ?? []).map((l: any) => l.title);

  let description: string | undefined;
  const summaryRes = await fetch(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`
  );
  if (summaryRes.ok) {
    const summary = await summaryRes.json();
    description = summary.description ?? summary.extract?.slice(0, 200);
  }

  return {
    title: page.title,
    pageid: page.pageid,
    extract: page.extract ?? '',
    description,
    categories,
    links,
  };
}

async function fetchUrl(url: string): Promise<{ title: string; body: string } | null> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'brandwiki-engine/0.2 (external-source-fetcher)' },
  });
  if (!res.ok) return null;

  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? new URL(url).hostname;

  // Strip HTML tags for plain text (simple approach)
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { title, body: body.slice(0, 40_000) };
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s/\\]+/g, '-')
    .replace(/[^\p{L}\p{N}\-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function formatWikipediaAsMarkdown(article: WikipediaExtract, source: ExternalSource): string {
  const tags = source.tags ?? [];
  const cat = source.category ?? '09-market';
  const now = new Date().toISOString();
  const wikiUrl = `https://ja.wikipedia.org/wiki/${encodeURIComponent(article.title)}`;

  const relatedCompanies = article.links
    .filter((l) => {
      const lower = l.toLowerCase();
      return (
        lower.includes('株式会社') ||
        lower.includes('グループ') ||
        lower.includes('ホールディングス') ||
        lower.includes('薬局') ||
        lower.includes('ドラッグ') ||
        lower.includes('pharmacy') ||
        lower.includes('inc.') ||
        lower.includes('corp')
      );
    })
    .slice(0, 20);

  let md = `<!-- Fetched from: ${wikiUrl} -->\n`;
  md += `<!-- FetchedAt: ${now} -->\n`;
  md += `<!-- Source: wikipedia -->\n`;
  md += `<!-- SuggestedCategory: ${cat} -->\n`;
  md += `<!-- Tags: ${tags.join(', ')} -->\n\n`;
  md += `# ${article.title}\n\n`;

  if (article.description) {
    md += `> ${article.description}\n\n`;
  }

  md += `**出典**: [Wikipedia](${wikiUrl})\n\n`;

  if (tags.length > 0) {
    md += `**分類**: ${tags.join(', ')}\n\n`;
  }

  if (relatedCompanies.length > 0) {
    md += `## 関連企業・組織\n\n`;
    for (const company of relatedCompanies) {
      md += `- [[${company}]]\n`;
    }
    md += '\n';
  }

  if (article.categories.length > 0) {
    md += `## Wikipedia カテゴリ\n\n`;
    md += article.categories.map((c) => `- ${c}`).join('\n') + '\n\n';
  }

  md += `## 概要\n\n`;
  md += article.extract.slice(0, 30_000) + '\n';

  return md;
}

function formatUrlAsMarkdown(
  title: string,
  body: string,
  url: string,
  source: ExternalSource
): string {
  const tags = source.tags ?? [];
  const cat = source.category ?? '09-market';
  const now = new Date().toISOString();

  let md = `<!-- Fetched from: ${url} -->\n`;
  md += `<!-- FetchedAt: ${now} -->\n`;
  md += `<!-- Source: url -->\n`;
  md += `<!-- SuggestedCategory: ${cat} -->\n`;
  md += `<!-- Tags: ${tags.join(', ')} -->\n\n`;
  md += `# ${title}\n\n`;
  md += `**出典**: [${new URL(url).hostname}](${url})\n\n`;

  if (tags.length > 0) {
    md += `**分類**: ${tags.join(', ')}\n\n`;
  }

  md += `## 内容\n\n${body}\n`;
  return md;
}

function ensureExternalSource(config: BrandwikiConfig, bwDir: string): void {
  const hasExternal = config.sources.some((s) => s.path === 'raw/external');
  if (!hasExternal) {
    config.sources.push({ path: 'raw/external', type: 'markdown', glob: '**/*.md' });
    const configPath = join(bwDir, 'config.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(pc.green('  Added "raw/external" to sources in config.json'));
  }
}

export async function fetchCommand(options: FetchOptions): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);
  const extDir = join(bwDir, 'raw', 'external');

  const sources = config.externalSources ?? [];
  if (sources.length === 0) {
    console.log(pc.yellow('No externalSources defined in config.json.'));
    console.log(pc.dim('Add an "externalSources" array to .brandwiki/config.json.'));
    console.log(pc.dim('Example:'));
    console.log(
      pc.dim(
        JSON.stringify(
          {
            externalSources: [
              {
                type: 'wikipedia',
                articles: ['ツルハドラッグ', 'マツモトキヨシ'],
                language: 'ja',
                category: '09-market',
                tags: ['competitor'],
              },
            ],
          },
          null,
          2
        )
      )
    );
    return;
  }

  mkdirSync(extDir, { recursive: true });
  ensureExternalSource(config, bwDir);

  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  console.log(pc.cyan(`Fetching external sources (${sources.length} rules)...`));

  for (const source of sources) {
    if (source.type === 'wikipedia') {
      const lang = source.language ?? config.language ?? 'ja';
      const articles = source.articles ?? [];

      for (const articleTitle of articles) {
        const slug = toSlug(articleTitle);
        const destPath = join(extDir, `wiki-${slug}.md`);

        if (!options.force && existsSync(destPath)) {
          skipped++;
          if (options.verbose) console.log(pc.dim(`  skip (exists): ${articleTitle}`));
          continue;
        }

        console.log(pc.dim(`  fetching: ${articleTitle} (Wikipedia ${lang})...`));
        const article = await fetchWikipediaArticle(articleTitle, lang);

        if (!article) {
          console.log(pc.red(`  ✗ not found: ${articleTitle}`));
          failed++;
          continue;
        }

        const md = formatWikipediaAsMarkdown(article, source);
        writeFileSync(destPath, md, 'utf-8');
        fetched++;
        console.log(
          pc.green(`  ✓ ${article.title}`) +
            pc.dim(` (${article.extract.length} chars, ${article.links.length} links)`)
        );
      }
    } else if (source.type === 'url') {
      const urls = source.urls ?? [];

      for (const url of urls) {
        const slug = toSlug(new URL(url).hostname + '-' + new URL(url).pathname);
        const destPath = join(extDir, `url-${slug}.md`);

        if (!options.force && existsSync(destPath)) {
          skipped++;
          if (options.verbose) console.log(pc.dim(`  skip (exists): ${url}`));
          continue;
        }

        console.log(pc.dim(`  fetching: ${url}...`));
        const result = await fetchUrl(url);

        if (!result) {
          console.log(pc.red(`  ✗ failed: ${url}`));
          failed++;
          continue;
        }

        const md = formatUrlAsMarkdown(result.title, result.body, url, source);
        writeFileSync(destPath, md, 'utf-8');
        fetched++;
        console.log(pc.green(`  ✓ ${result.title}`) + pc.dim(` (${result.body.length} chars)`));
      }
    } else {
      console.log(pc.yellow(`  unknown source type: ${(source as any).type}`));
    }
  }

  console.log('');
  console.log(
    pc.green(`✓ Fetched ${fetched} sources`) +
      pc.dim(` (${skipped} skipped, ${failed} failed)`)
  );

  if (fetched > 0) {
    console.log(pc.dim('\nRun `brandwiki compile --force` to incorporate external sources into wiki articles.'));
    await sendNotification(config, 'fetch', `Fetched ${fetched} external sources for ${config.projectName}`);
  }
}
