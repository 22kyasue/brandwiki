import { marked } from 'marked';
import { escapeHtml, t, type Lang } from './site-template.js';

export interface ArticleIndexEntry {
  category: string;
  slug: string;
  title: string;
}

export interface Heading {
  level: number;
  text: string;
  id: string;
}

let idCounter = 0;
function slugifyHeading(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return base || `heading-${++idCounter}`;
}

function resolveBacklinks(body: string, index: ArticleIndexEntry[]): string {
  return body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, alias) => {
    const display = (alias ?? target).trim();
    const search = target.trim().toLowerCase();
    const match = index.find(
      (a) =>
        a.title.toLowerCase() === search ||
        a.slug.toLowerCase() === search ||
        a.title.toLowerCase().includes(search) ||
        search.includes(a.title.toLowerCase())
    );
    if (match) {
      return `[${display}](/article/${match.category}/${match.slug})`;
    }
    return `<span class="bw-redlink">${escapeHtml(display)}</span>`;
  });
}

export interface ProcessedArticle {
  html: string;
  toc: Heading[];
  tocHtml: string;
}

export function processArticleBody(params: {
  body: string;
  articleIndex: ArticleIndexEntry[];
}): ProcessedArticle {
  const withLinks = resolveBacklinks(params.body, params.articleIndex);

  const renderer = new marked.Renderer();
  const headings: Heading[] = [];
  const usedIds = new Set<string>();

  const originalHeading = renderer.heading.bind(renderer);
  renderer.heading = function ({ tokens, depth }: any) {
    const text = this.parser.parseInline(tokens);
    const plainText = text.replace(/<[^>]+>/g, '');
    let id = slugifyHeading(plainText);
    let dedupe = 1;
    while (usedIds.has(id)) {
      id = `${slugifyHeading(plainText)}-${++dedupe}`;
    }
    usedIds.add(id);
    if (depth === 2 || depth === 3) {
      headings.push({ level: depth, text: plainText, id });
    }
    const editLink = depth <= 3 ? ` <span class="bw-edit-section">[<a href="#${id}">edit</a>]</span>` : '';
    return `<h${depth} id="${id}"><span class="mw-headline">${text}</span>${editLink}</h${depth}>\n`;
  };

  renderer.code = function ({ text, lang }: any) {
    const language = (lang ?? '').trim();
    if (language === 'mermaid') {
      return `<div class="mermaid">${text}</div>\n`;
    }
    const langClass = language ? ` class="language-${language}"` : '';
    return `<pre><code${langClass}>${escapeHtml(text)}</code></pre>\n`;
  };

  const html = marked.parse(withLinks, { async: false, renderer }) as string;
  const tocHtml = renderTOC(headings);

  return { html, toc: headings, tocHtml };
}

function renderTOC(headings: Heading[]): string {
  if (headings.length === 0) return '';
  let h2Count = 0;
  let h3Count = 0;
  let lastLevel = 2;
  const items: string[] = [];
  for (const h of headings) {
    if (h.level === 2) {
      h2Count++;
      h3Count = 0;
      if (lastLevel === 3) items.push('</ul></li>');
      items.push(`<li><a href="#${h.id}"><span class="bw-toc-num">${h2Count}</span> ${escapeHtml(h.text)}</a>`);
      lastLevel = 2;
    } else if (h.level === 3) {
      h3Count++;
      if (lastLevel === 2) items.push('<ul class="bw-toc-sub">');
      items.push(
        `<li><a href="#${h.id}"><span class="bw-toc-num">${h2Count}.${h3Count}</span> ${escapeHtml(h.text)}</a></li>`
      );
      lastLevel = 3;
    }
  }
  if (lastLevel === 3) items.push('</ul></li>');

  return `<div class="bw-toc" id="toc">
    <div class="bw-toc-header">
      <span class="bw-toc-title">Contents</span>
      <span class="bw-toc-toggle">[<a href="javascript:void(0)" onclick="document.getElementById('toc').classList.toggle('collapsed')">hide</a>]</span>
    </div>
    <ul class="bw-toc-list">${items.join('')}</ul>
  </div>`;
}

export function buildSidebarToc(headings: Heading[]): string {
  if (headings.length === 0) return '';
  let h2Count = 0;
  let h3Count = 0;
  let lastLevel = 2;
  const items: string[] = [];
  for (const h of headings) {
    if (h.level === 2) {
      h2Count++;
      h3Count = 0;
      if (lastLevel === 3) items.push('</ul></li>');
      items.push(
        `<li><a href="#${h.id}"><span class="bw-toc-sidebar-num">${h2Count}</span>${escapeHtml(h.text)}</a>`
      );
      lastLevel = 2;
    } else if (h.level === 3) {
      h3Count++;
      if (lastLevel === 2) items.push('<ul>');
      items.push(
        `<li><a href="#${h.id}"><span class="bw-toc-sidebar-num">${h2Count}.${h3Count}</span>${escapeHtml(h.text)}</a></li>`
      );
      lastLevel = 3;
    }
  }
  if (lastLevel === 3) items.push('</ul></li>');

  return `<aside class="bw-toc-sidebar">
    <div class="bw-toc-sidebar-header">Contents</div>
    <ul>${items.join('')}</ul>
  </aside>`;
}

export function buildInfobox(article: {
  title: string;
  category: string;
  status: string;
  confidence: string;
  confidenceDetail?: string;
  updated: string;
  sources: string[];
  words: number;
}, categoryTitle: string, lang: Lang = 'ja'): string {
  const badge = (type: string, val: string) =>
    `<span class="bw-badge ${type}-${val}">${escapeHtml(val)}</span>`;
  const caption = lang === 'ja'
    ? `${escapeHtml(categoryTitle)}の記事`
    : `${escapeHtml(categoryTitle)} article`;
  const confidenceCell = article.confidenceDetail
    ? `${badge('conf', article.confidence)}<div style="font-size: 11px; color: #72777d; margin-top: 2px;">(${escapeHtml(article.confidenceDetail)})</div>`
    : badge('conf', article.confidence);
  return `<aside class="bw-infobox">
    <div class="bw-infobox-title">${escapeHtml(article.title)}</div>
    <div class="bw-infobox-caption">${caption}</div>
    <table>
      <tr><th>${t(lang, 'category')}</th><td><a href="/category/${article.category}">${escapeHtml(categoryTitle)}</a></td></tr>
      <tr><th>${t(lang, 'status')}</th><td>${badge('status', article.status)}</td></tr>
      <tr><th>${t(lang, 'confidence')}</th><td>${confidenceCell}</td></tr>
      <tr><th>${t(lang, 'updated')}</th><td>${escapeHtml(article.updated)}</td></tr>
      <tr><th>${t(lang, 'words')}</th><td>${article.words.toLocaleString()}</td></tr>
      <tr><th>${t(lang, 'sources')}</th><td>${article.sources.length}</td></tr>
    </table>
  </aside>`;
}

export function buildReferences(sources: string[]): string {
  if (sources.length === 0) return '';
  const items = sources
    .map((s, i) => `<li id="cite-${i + 1}"><span class="bw-cite-num">${i + 1}.</span> <code>${escapeHtml(s)}</code></li>`)
    .join('');
  return `<h2 id="references"><span class="mw-headline">References</span></h2>
    <ol class="bw-references">${items}</ol>`;
}

export function buildCategoriesFooter(categoryId: string, categoryTitle: string): string {
  return `<div class="bw-cat-footer">
    <strong>Categories:</strong>
    <a class="bw-cat-tag" href="/category/${categoryId}">${escapeHtml(categoryTitle)}</a>
  </div>`;
}
