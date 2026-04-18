import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import fg from 'fast-glob';
import matter from 'gray-matter';
import pc from 'picocolors';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { loadManifest, type Manifest } from '../lib/manifest.js';
import { runLint, type LintResult } from './lint.js';
import {
  htmlShell,
  escapeHtml,
  formatJST,
  categoryColor,
  readingTimeJa,
  relativeTimeJa,
} from '../lib/site-template.js';
import {
  processArticleBody,
  buildInfobox,
  buildSidebarToc,
  buildReferences,
  buildCategoriesFooter,
  type ArticleIndexEntry,
} from '../lib/article-processor.js';
interface ServeOptions {
  port?: string;
  noLiveReload?: boolean;
}

const sseClients = new Set<import('node:http').ServerResponse>();

// In-memory caches. Invalidated via invalidateCache() when wiki files change.
let cachedArticles: any[] | null = null;
let cachedManifestMtime = 0;
const htmlCache = new Map<string, string>();

let serverMode: 'serve' | 'watch' = 'serve';
let serverStartedAt = Date.now();
let lastBroadcastAt: number | null = null;
let lastBroadcastReason: string | null = null;
let broadcastCount = 0;

export function setServerMode(mode: 'serve' | 'watch'): void {
  serverMode = mode;
}

export function invalidateCache(): void {
  cachedArticles = null;
  htmlCache.clear();
}

export function broadcastReload(): void {
  invalidateCache();
  lastBroadcastAt = Date.now();
  lastBroadcastReason = 'reload';
  broadcastCount++;
  const payload = `event: reload\ndata: ${Date.now()}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

interface Article {
  category: string;
  slug: string;
  title: string;
  status: string;
  confidence: string;
  confidenceDetail: string;
  updated: string;
  updatedAtIso: string;
  sources: string[];
  body: string;
  words: number;
  path: string;
}

function calculateConfidence(
  sourceCount: number,
  wordCount: number,
  backlinkCount: number
): { level: string; detail: string } {
  const scoreSource = sourceCount === 0 ? 1 : sourceCount <= 2 ? 2 : 3;
  const scoreWords = wordCount < 200 ? 1 : wordCount <= 800 ? 2 : 3;
  const scoreRefs = backlinkCount === 0 ? 1 : backlinkCount <= 2 ? 2 : 3;
  const avg = (scoreSource + scoreWords + scoreRefs) / 3;
  const level = avg >= 2.5 ? 'high' : avg >= 1.5 ? 'medium' : 'low';
  const detail = `sources: ${sourceCount}, words: ${wordCount}, refs: ${backlinkCount}`;
  return { level, detail };
}

export async function startServer(options: ServeOptions): Promise<void> {
  await serveCommand(options);
}

export async function serveCommand(options: ServeOptions): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);
  const port = parseInt(options.port ?? '8787', 10);

  const liveReloadScript = options.noLiveReload ? '' : `<script>
    (function(){
      function init(){
        try {
          _run();
        } catch (e) {}
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
      function _run(){
        var el = document.getElementById('bw-live');
        var timeEl = document.getElementById('bw-live-time');
        var STORAGE_KEY = 'bw-last-update';

        function pad(n){ return n < 10 ? '0' + n : '' + n; }
        function formatTime(ms){
          var d = new Date(ms);
          return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
        }
        function formatFull(ms){
          var d = new Date(ms);
          return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
            + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
        }
        function setStatus(connected, lastUpdateMs){
          if (!el) return;
          el.classList.toggle('connected', !!connected);
          el.classList.toggle('disconnected', !connected);
          var textEl = el.querySelector('.bw-live-text');
          if (textEl) textEl.textContent = connected ? 'Live' : 'Offline';
          if (timeEl){
            if (lastUpdateMs){
              timeEl.textContent = formatTime(lastUpdateMs);
              el.title = (connected ? 'Watch モードに接続中' : '切断中')
                + ' · 最終更新: ' + formatFull(lastUpdateMs);
            } else if (connected){
              timeEl.textContent = 'ready';
              el.title = 'Watch モードに接続中 (まだ更新なし)';
            } else {
              timeEl.textContent = '—';
              el.title = 'Watch モードに未接続';
            }
          }
        }

        // 起動時: 直近の更新時刻を復元 (ページリロードまたいでも残す)
        var storedRaw;
        try { storedRaw = sessionStorage.getItem(STORAGE_KEY); } catch(e) {}
        var storedMs = storedRaw ? parseInt(storedRaw, 10) : 0;
        setStatus(false, storedMs || 0);

        var es, closed = false;
        function killSSE(){
          if (closed) return;
          closed = true;
          try { es && es.close(); } catch(e) {}
        }

        try {
          es = new EventSource('/_events');
          es.onopen = function(){ setStatus(true, storedMs || 0); };
          // サーバーは接続直後に 'connected' イベントを送る
          es.addEventListener('connected', function(){ setStatus(true, storedMs || 0); });
          es.addEventListener('reload', function(ev){
            var ts = parseInt(ev.data, 10) || Date.now();
            try { sessionStorage.setItem(STORAGE_KEY, String(ts)); } catch(e) {}
            setStatus(true, ts);
            killSSE();
            location.reload();
          });
          es.onerror = function(){
            // ブラウザが自動リトライするので 'offline' に落とすだけ
            setStatus(false, storedMs || 0);
          };
        } catch (e) {
          setStatus(false, storedMs || 0);
        }

        window.addEventListener('pagehide', killSSE);
        window.addEventListener('beforeunload', killSSE);
      }
    })();
  </script>`;

  async function loadArticles(): Promise<Article[]> {
    if (cachedArticles) return cachedArticles as Article[];
    const wikiDir = join(bwDir, 'wiki');
    const files = await fg('**/*.md', { cwd: wikiDir, absolute: true });
    const manifest = loadManifest(bwDir);
    const articles: Article[] = [];
    for (const file of files) {
      if (file.endsWith('README.md')) continue;
      const raw = readFileSync(file, 'utf-8');
      const parsed = matter(raw);
      const rel = relative(wikiDir, file).replaceAll('\\', '/');
      const [cat, fname] = rel.split('/');
      if (!cat || !fname) continue;
      const slug = fname.replace(/\.md$/, '');
      const toStr = (v: unknown): string => {
        if (v == null) return '';
        if (v instanceof Date) return v.toISOString().split('T')[0];
        return String(v);
      };
      const toStrArray = (v: unknown): string[] => {
        if (!Array.isArray(v)) return [];
        return v.map(toStr);
      };
      const articleKey = `${toStr(parsed.data.category) || cat}/${slug}`;
      const manifestEntry = manifest.articles[articleKey];
      const updatedAtIso = manifestEntry?.updatedAt ?? toStr(parsed.data.updated);
      articles.push({
        category: toStr(parsed.data.category) || cat,
        slug,
        title: toStr(parsed.data.title) || slug,
        status: toStr(parsed.data.status) || 'draft',
        confidence: toStr(parsed.data.confidence) || 'medium',
        confidenceDetail: '',
        updated: formatJST(updatedAtIso) || toStr(parsed.data.updated),
        updatedAtIso,
        sources: toStrArray(parsed.data.sources),
        body: parsed.content,
        words: parsed.content.split(/\s+/).filter(Boolean).length,
        path: file,
      });
    }

    // Auto-calculate confidence scores based on metadata
    const backlinkCounts = new Map<string, number>();
    for (const a of articles) {
      backlinkCounts.set(`${a.category}/${a.slug}`, 0);
    }
    for (const a of articles) {
      const linkMatches = a.body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
      const seen = new Set<string>();
      for (const m of linkMatches) {
        const target = m[1].trim().toLowerCase();
        const found = articles.find(
          (x) =>
            x.title.toLowerCase() === target ||
            x.slug.toLowerCase() === target ||
            x.title.toLowerCase().includes(target)
        );
        if (!found) continue;
        const foundKey = `${found.category}/${found.slug}`;
        if (foundKey === `${a.category}/${a.slug}`) continue;
        if (seen.has(foundKey)) continue;
        seen.add(foundKey);
        backlinkCounts.set(foundKey, (backlinkCounts.get(foundKey) ?? 0) + 1);
      }
    }
    for (const a of articles) {
      const key = `${a.category}/${a.slug}`;
      const refs = backlinkCounts.get(key) ?? 0;
      const calc = calculateConfidence(a.sources.length, a.words, refs);
      a.confidence = calc.level;
      a.confidenceDetail = calc.detail;
    }

    cachedArticles = articles;
    return articles;
  }

  function extractExcerpt(body: string, maxLen = 220): string {
    const cleaned = body
      .replace(/^---[\s\S]*?---/, '')
      .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
      .replace(/`([^`]+)`/g, '$1');
    const paragraphs = cleaned.split(/\n\n+/).map((p) => p.trim());
    const firstProse = paragraphs.find((p) => {
      if (!p) return false;
      if (p.startsWith('#')) return false;
      if (p.startsWith('>')) return false;
      if (p.startsWith('|')) return false;
      if (p.startsWith('-') || p.startsWith('*')) return false;
      if (p.startsWith('```')) return false;
      return true;
    });
    const text = (firstProse ?? paragraphs[0] ?? '').replace(/[#*_`]/g, '').trim();
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '…';
  }

  function firstChar(title: string): string {
    const c = title.trim().charAt(0);
    if (!c) return '#';
    if (/[あ-お]/.test(c) || 'アイウエオ'.includes(c)) return 'あ';
    if (/[か-ご]/.test(c) || 'カキクケコガギグゲゴ'.includes(c)) return 'か';
    if (/[さ-ぞ]/.test(c) || 'サシスセソザジズゼゾ'.includes(c)) return 'さ';
    if (/[た-ど]/.test(c) || 'タチツテトダヂヅデド'.includes(c)) return 'た';
    if (/[な-の]/.test(c) || 'ナニヌネノ'.includes(c)) return 'な';
    if (/[は-ぽ]/.test(c) || 'ハヒフヘホバビブベボパピプペポ'.includes(c)) return 'は';
    if (/[ま-も]/.test(c) || 'マミムメモ'.includes(c)) return 'ま';
    if (/[や-よ]/.test(c) || 'ヤユヨ'.includes(c)) return 'や';
    if (/[ら-ろ]/.test(c) || 'ラリルレロ'.includes(c)) return 'ら';
    if (/[わ-ん]/.test(c) || 'ワヲン'.includes(c)) return 'わ';
    if (/[A-Za-z]/.test(c)) return c.toUpperCase();
    if (/[0-9]/.test(c)) return '0-9';
    return '他';
  }

  function buildIndex(articles: Article[]): ArticleIndexEntry[] {
    return articles.map((a) => ({ category: a.category, slug: a.slug, title: a.title }));
  }

  function renderContextNav(articles: Article[], currentCat?: string, section = true): string {
    const byCategory: Record<string, number> = {};
    for (const a of articles) byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
    const catItems = config.categories
      .filter((c) => (byCategory[c.id] ?? 0) > 0)
      .map((c) => {
        const count = byCategory[c.id] ?? 0;
        const active = c.id === currentCat;
        const color = categoryColor(c.id);
        return `<li><a href="/category/${c.id}" class="${active ? 'active' : ''}" style="--cat-color: ${color}">
          ${escapeHtml(c.title)}<span class="bw-context-nav-count">${count}</span>
        </a></li>`;
      })
      .join('');

    const navItems = `<li><a href="/">🏠 Main Page</a></li>
      <li><a href="/all">📄 All Articles</a></li>
      <li><a href="/special/recent-changes">🕒 Recent</a></li>
      <li><a href="/random">🎲 Random</a></li>`;

    const sectionOpen = section ? '<div class="bw-context-nav-section">' : '';
    const sectionClose = section ? '</div>' : '';
    return `${sectionOpen}
      <div class="bw-context-nav-header">Navigation</div>
      <ul>${navItems}</ul>
    ${sectionClose}
    ${sectionOpen}
      <div class="bw-context-nav-header">Categories</div>
      <ul>${catItems}</ul>
    ${sectionClose}`;
  }

  function detectRelationshipType(body: string, matchIndex: number): string {
    const contextRadius = 100;
    const start = Math.max(0, matchIndex - contextRadius);
    const end = Math.min(body.length, matchIndex + contextRadius);
    const context = body.slice(start, end).toLowerCase();
    const competitorKeywords = ['競合', 'competitor', 'rival'];
    const partnerKeywords = ['提携', 'partner', '協力', 'alliance'];
    const investmentKeywords = ['出資', '投資', '子会社', 'subsidiary', 'parent'];
    for (const kw of competitorKeywords) {
      if (context.includes(kw)) return 'competitor';
    }
    for (const kw of partnerKeywords) {
      if (context.includes(kw)) return 'partner';
    }
    for (const kw of investmentKeywords) {
      if (context.includes(kw)) return 'investment';
    }
    return 'reference';
  }

  function buildBacklinkGraph(articles: Article[]): { nodes: any[]; links: any[] } {
    const idOf = (a: Article) => `${a.category}/${a.slug}`;
    const nodeMap = new Map<string, any>();
    for (const a of articles) {
      nodeMap.set(idOf(a), {
        id: idOf(a),
        label: a.title,
        category: a.category,
        url: `/article/${a.category}/${a.slug}`,
        degree: 0,
      });
    }
    const links: Array<{ source: string; target: string; type: string }> = [];
    const seen = new Set<string>();
    for (const a of articles) {
      const sourceId = idOf(a);
      const matches = a.body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
      for (const m of matches) {
        const target = m[1].trim().toLowerCase();
        const found = articles.find(
          (x) =>
            x.title.toLowerCase() === target ||
            x.slug.toLowerCase() === target ||
            x.title.toLowerCase().includes(target)
        );
        if (!found || idOf(found) === sourceId) continue;
        const key = `${sourceId}->${idOf(found)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const relType = detectRelationshipType(a.body, m.index ?? 0);
        links.push({ source: sourceId, target: idOf(found), type: relType });
        nodeMap.get(sourceId)!.degree++;
        nodeMap.get(idOf(found))!.degree++;
      }
    }
    return { nodes: Array.from(nodeMap.values()), links };
  }

  function renderMainPage(articles: Article[], manifest: Manifest): string {
    const byCategory: Record<string, Article[]> = {};
    for (const a of articles) {
      if (!byCategory[a.category]) byCategory[a.category] = [];
      byCategory[a.category].push(a);
    }
    const totalWords = articles.reduce((sum, a) => sum + a.words, 0);

    // Featured = highest confidence × words
    const scored = [...articles].sort((x, y) => {
      const score = (a: Article) => (a.confidence === 'high' ? 3 : a.confidence === 'medium' ? 2 : 1) * 1000 + a.words;
      return score(y) - score(x);
    });
    const featured = scored[0];
    let featuredCard = '';
    if (featured) {
      const firstPara = featured.body
        .replace(/^---[\s\S]*?---/, '')
        .split(/\n\n/)
        .map((p) => p.trim())
        .find((p) => p && !p.startsWith('#') && !p.startsWith('>') && !p.startsWith('|'));
      const snippet = (firstPara ?? '').replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1').slice(0, 240);
      const firstChar = featured.title.trim().charAt(0);
      const cat = config.categories.find((c) => c.id === featured.category);
      featuredCard = `<div class="bw-dash-card">
        <div class="bw-dash-card-header green">Featured article</div>
        <div class="bw-dash-card-body">
          <div class="bw-dash-featured">
            <div class="bw-dash-featured-avatar" style="color: ${categoryColor(featured.category)}">${escapeHtml(firstChar)}</div>
            <div class="bw-dash-featured-body">
              <div class="bw-dash-featured-title"><a href="/article/${featured.category}/${featured.slug}">${escapeHtml(featured.title)}</a></div>
              <div class="bw-dash-featured-tag">(${escapeHtml(cat?.title ?? featured.category)})</div>
              <div class="bw-dash-featured-excerpt">${escapeHtml(snippet)}${snippet.length >= 240 ? '…' : ''}</div>
              <div class="bw-dash-read-more"><a href="/article/${featured.category}/${featured.slug}">Read more →</a></div>
            </div>
          </div>
        </div>
      </div>`;
    }

    // Recently updated — top 6 by manifest updatedAt
    const recentEntries = Object.entries(manifest.articles)
      .map(([key, meta]) => {
        const [cat, slug] = key.split('/');
        const article = articles.find((a) => a.category === cat && a.slug === slug);
        return { cat, slug, meta, article };
      })
      .filter((e) => e.article)
      .sort((x, y) => (y.meta.updatedAt > x.meta.updatedAt ? 1 : -1))
      .slice(0, 6);
    const recentList = recentEntries
      .map(
        (e) => `<li>
        <a href="/article/${e.cat}/${e.slug}">${escapeHtml(e.article!.title)}</a>
        <span class="bw-date">(${e.meta.updatedAt.slice(0, 10)})</span>
      </li>`
      )
      .join('');
    const recentCard = `<div class="bw-dash-card">
      <div class="bw-dash-card-header blue">Recently updated</div>
      <div class="bw-dash-card-body">
        <ul class="bw-dash-list">${recentList}</ul>
      </div>
    </div>`;

    // About card
    const aboutCard = `<div class="bw-dash-card">
      <div class="bw-dash-card-header purple">About</div>
      <div class="bw-dash-card-body">
        <p>${escapeHtml(config.projectName)} Brand Wiki は、プロジェクトのコーディング、ドキュメント、
          会議ログ、コード片を AI がコンパイルして構築した構造化知識ベースです。</p>
        <p>各記事は生ソースから抽出された知識パターンであり、Raw な転写ではありません。
          ソースは frontmatter に記録され、<strong>ingest → compile → wiki</strong> のパイプラインが
          プロジェクトの進化に合わせて自動更新されます。</p>
      </div>
    </div>`;

    // Wiki health
    const highConfCount = articles.filter((a) => a.confidence === 'high').length;
    const healthScore = Math.round((highConfCount / Math.max(1, articles.length)) * 100);
    const healthCard = `<div class="bw-dash-card">
      <div class="bw-dash-card-header yellow">Wiki health</div>
      <div class="bw-dash-card-body">
        <div class="bw-health-grid">
          <div class="bw-health-item">
            <div class="bw-health-value">${articles.length}</div>
            <div class="bw-health-label">Articles</div>
          </div>
          <div class="bw-health-item">
            <div class="bw-health-value">${totalWords.toLocaleString()}</div>
            <div class="bw-health-label">Words</div>
          </div>
          <div class="bw-health-item">
            <div class="bw-health-value">${healthScore}%</div>
            <div class="bw-health-label">Health score</div>
          </div>
          <div class="bw-health-item">
            <div class="bw-health-value">${highConfCount}/${articles.length}</div>
            <div class="bw-health-label">High confidence</div>
          </div>
        </div>
      </div>
    </div>`;

    // Browse by category — featured with rich cards
    const browseItems = config.categories
      .filter((c) => (byCategory[c.id] ?? []).length > 0)
      .map((c) => {
        const count = (byCategory[c.id] ?? []).length;
        const color = categoryColor(c.id);
        return `<a class="bw-browse-card" href="/category/${c.id}" style="--cat-color: ${color};">
          <div class="bw-browse-card-title"><span class="bw-browse-card-mark">◆</span>${escapeHtml(c.title)}</div>
          <div class="bw-browse-card-desc">${escapeHtml(c.description)}</div>
          <div class="bw-browse-card-count">${count} articles</div>
        </a>`;
      })
      .join('');
    const browseCard = `<div class="bw-dash-card full-width">
      <div class="bw-dash-card-header green">Browse by category</div>
      <div class="bw-dash-card-body">
        <div class="bw-browse-featured">${browseItems}</div>
      </div>
    </div>`;

    // Article connections graph
    const graph = buildBacklinkGraph(articles);
    const graphLegend = config.categories
      .filter((c) => (byCategory[c.id] ?? []).length > 0)
      .map(
        (c) =>
          `<span class="bw-legend-item"><span class="bw-legend-dot" style="background: ${categoryColor(c.id)}"></span>${escapeHtml(c.title)}</span>`
      )
      .join('');
    const graphCard = `<div class="bw-dash-card full-width">
      <div class="bw-dash-card-header blue">Article connections</div>
      <div class="bw-dash-card-body" style="padding: 0;">
        <div class="bw-graph-legend" id="bw-graph-legend">
          <span class="bw-legend-label">Backlink Graph</span>
          <span style="color: #a2a9b1;">|</span>
          ${graphLegend}
        </div>
        <div class="bw-edge-legend">
          <span class="bw-edge-legend-label">Edge types:</span>
          <span class="bw-edge-legend-item"><span class="bw-edge-line" style="background:#a0aac8;"></span> reference</span>
          <span class="bw-edge-legend-item"><span class="bw-edge-line" style="background:#ef4444;"></span> competitor</span>
          <span class="bw-edge-legend-item"><span class="bw-edge-line" style="background:#22c55e;"></span> partner</span>
          <span class="bw-edge-legend-item"><span class="bw-edge-line" style="background:#f59e0b;"></span> investment</span>
        </div>
        <div class="bw-graph-container" id="bw-graph-container">
          <svg id="bw-graph-svg"></svg>
          <div class="bw-graph-mini-search">
            <input type="search" id="bw-graph-search" placeholder="Search..." />
          </div>
          <div class="bw-graph-zoom">
            <button id="bw-zoom-out" title="Zoom out (-)">−</button>
            <div class="bw-graph-zoom-level" id="bw-zoom-level">100%</div>
            <button id="bw-zoom-in" title="Zoom in (+)">＋</button>
            <button id="bw-zoom-reset" title="Reset (0)">⊙</button>
          </div>
          <div class="bw-graph-mini-hint">
            <kbd>ctrl+scroll</kbd> zoom · <kbd>+/−</kbd> step · <kbd>0</kbd> reset · <kbd>f</kbd> fit
          </div>
          <div class="bw-graph-tooltip" id="bw-graph-tooltip"></div>
        </div>
      </div>
    </div>`;

    const catColorMap: Record<string, string> = {};
    const catTitleMap: Record<string, string> = {};
    for (const c of config.categories) {
      catColorMap[c.id] = categoryColor(c.id);
      catTitleMap[c.id] = c.title;
    }
    const graphScript = `<script>
(function(){
  if (!window.d3) return;
  var data = ${JSON.stringify(graph)};
  var colors = ${JSON.stringify(catColorMap)};
  var catTitles = ${JSON.stringify(catTitleMap)};
  var container = document.getElementById('bw-graph-container');
  var svgEl = document.getElementById('bw-graph-svg');
  var tooltipEl = document.getElementById('bw-graph-tooltip');
  if (!container || !svgEl) return;

  var width = container.clientWidth;
  var height = container.clientHeight || 720;
  var svg = d3.select(svgEl).attr('viewBox', '0 0 ' + width + ' ' + height);
  var g = svg.append('g').attr('class', 'zoom-layer');

  // Build adjacency for hover highlight
  var adjacency = {};
  data.nodes.forEach(function(n){ adjacency[n.id] = new Set([n.id]); });
  data.links.forEach(function(l){
    var s = typeof l.source === 'string' ? l.source : l.source.id;
    var t = typeof l.target === 'string' ? l.target : l.target.id;
    adjacency[s].add(t);
    adjacency[t].add(s);
  });

  // Simulation — Obsidian-like spacing
  var linkDist = 140;
  var chargeStr = -380;
  function atomRadius(d){ return 5 + Math.min(14, d.degree * 1.6); }
  var simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.links).id(function(d){ return d.id; }).distance(linkDist).strength(0.55))
    .force('charge', d3.forceManyBody().strength(chargeStr).distanceMax(500))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius(function(d){ return atomRadius(d) + 8; }))
    .force('x', d3.forceX(width / 2).strength(0.035))
    .force('y', d3.forceY(height / 2).strength(0.035));

  // Links (render below nodes)
  var link = g.append('g').attr('class', 'links').selectAll('line')
    .data(data.links).enter().append('line').attr('class', 'link')
    .attr('data-type', function(d){ return d.type || 'reference'; });

  // Mark top-N by degree as permanent anchors (labels always visible)
  var topN = Math.min(7, Math.ceil(data.nodes.length * 0.35));
  var anchorIds = new Set(
    data.nodes.slice().sort(function(a, b){ return b.degree - a.degree; }).slice(0, topN).map(function(n){ return n.id; })
  );

  // Nodes
  var node = g.append('g').attr('class', 'nodes').selectAll('g')
    .data(data.nodes).enter().append('g')
    .attr('class', function(d){ return 'node' + (anchorIds.has(d.id) ? ' anchor' : ''); });

  // Flat solid circle (Obsidian style)
  node.append('circle')
    .attr('class', 'atom')
    .attr('r', function(d){ return atomRadius(d); })
    .attr('fill', function(d){ return colors[d.category] || '#888888'; });

  // Pin ring (shown when pinned)
  node.append('circle')
    .attr('class', 'atom-ring')
    .attr('r', function(d){ return atomRadius(d) + 4; })
    .attr('fill', 'none');

  // Label below the node
  node.append('text')
    .attr('class', 'label')
    .attr('dy', function(d){ return atomRadius(d) + 15; })
    .text(function(d){ return d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label; });

  // Entry animation
  node.style('opacity', 0).transition().duration(800).delay(function(_,i){ return i * 30; }).style('opacity', 1);
  link.style('opacity', 0).transition().duration(600).delay(400).style('opacity', 1);

  // Drag
  var drag = d3.drag()
    .on('start', function(event, d){
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    })
    .on('drag', function(event, d){
      d.fx = event.x; d.fy = event.y;
    })
    .on('end', function(event, d){
      if (!event.active) simulation.alphaTarget(0);
      // Hold shift to pin on drop; otherwise release
      if (!event.sourceEvent || !event.sourceEvent.shiftKey) {
        d.fx = null; d.fy = null;
      } else {
        d3.select(this).classed('pinned', true);
      }
    });
  node.call(drag);

  // Zoom & pan — wheel zoom only with Ctrl/Cmd; slower wheel delta for control
  var zoomLevelEl = document.getElementById('bw-zoom-level');
  var zoom = d3.zoom()
    .scaleExtent([0.25, 5])
    .wheelDelta(function(event){
      // ~2x slower than d3 default for finer control
      return -event.deltaY * (event.deltaMode === 1 ? 0.025 : event.deltaMode ? 0.5 : 0.0009);
    })
    .filter(function(event){
      if (event.type === 'wheel') return event.ctrlKey || event.metaKey;
      if (event.type === 'mousedown' || event.type === 'touchstart') {
        return event.target === svgEl || event.target.tagName === 'svg';
      }
      return !event.button;
    })
    .on('zoom', function(event){
      g.attr('transform', event.transform);
      svg.classed('zoomed-in', event.transform.k > 1.3);
      if (zoomLevelEl) zoomLevelEl.textContent = Math.round(event.transform.k * 100) + '%';
    });
  svg.call(zoom).on('dblclick.zoom', null);

  // Zoom buttons — discrete steps with smooth transition
  function zoomStep(factor){
    svg.transition().duration(220).ease(d3.easeCubicOut).call(zoom.scaleBy, factor);
  }
  function zoomReset(){
    svg.transition().duration(360).ease(d3.easeCubicOut).call(zoom.transform, d3.zoomIdentity);
  }
  var btnIn = document.getElementById('bw-zoom-in');
  var btnOut = document.getElementById('bw-zoom-out');
  var btnReset = document.getElementById('bw-zoom-reset');
  if (btnIn) btnIn.addEventListener('click', function(){ zoomStep(1.4); });
  if (btnOut) btnOut.addEventListener('click', function(){ zoomStep(0.7); });
  if (btnReset) btnReset.addEventListener('click', zoomReset);

  // Tooltip
  function showTooltip(d, evt){
    tooltipEl.classList.add('visible');
    tooltipEl.style.setProperty('--tt-color', colors[d.category] || '#72777d');
    tooltipEl.innerHTML =
      '<div class="tt-cat">' + (catTitles[d.category] || d.category) + '</div>' +
      '<div class="tt-title">' + escapeHTML(d.label) + '</div>' +
      '<div class="tt-meta">' + d.degree + ' connections</div>' +
      '<div class="tt-hint">click to pin · dbl-click to open</div>';
    moveTooltip(evt);
  }
  function moveTooltip(evt){
    var x = evt.clientX + 14;
    var y = evt.clientY + 14;
    var w = tooltipEl.offsetWidth;
    var h = tooltipEl.offsetHeight;
    if (x + w > window.innerWidth - 10) x = evt.clientX - w - 14;
    if (y + h > window.innerHeight - 10) y = evt.clientY - h - 14;
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
  }
  function hideTooltip(){ tooltipEl.classList.remove('visible'); }
  function escapeHTML(s){ var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // Hover highlight — connected nodes stay, others dim
  node.on('mouseenter', function(event, d){
    var connected = adjacency[d.id] || new Set([d.id]);
    node.classed('dim', function(n){ return !connected.has(n.id); });
    // Highlight hovered AND its connected neighbors so their labels appear
    node.classed('highlight', function(n){ return connected.has(n.id); });
    link.classed('dim', function(l){
      var s = typeof l.source === 'object' ? l.source.id : l.source;
      var t = typeof l.target === 'object' ? l.target.id : l.target;
      return !(s === d.id || t === d.id);
    });
    link.classed('highlight', function(l){
      var s = typeof l.source === 'object' ? l.source.id : l.source;
      var t = typeof l.target === 'object' ? l.target.id : l.target;
      return s === d.id || t === d.id;
    });
    showTooltip(d, event);
  });
  node.on('mousemove', function(event){ moveTooltip(event); });
  node.on('mouseleave', function(){
    node.classed('dim', false).classed('highlight', false);
    link.classed('dim', false).classed('highlight', false);
    hideTooltip();
  });

  // Click toggle pin, double-click navigate
  node.on('click', function(event, d){
    event.stopPropagation();
    var sel = d3.select(this);
    if (sel.classed('pinned')) {
      sel.classed('pinned', false);
      d.fx = null; d.fy = null;
    } else {
      sel.classed('pinned', true);
      d.fx = d.x; d.fy = d.y;
    }
    simulation.alpha(0.3).restart();
  });
  node.on('dblclick', function(event, d){
    event.stopPropagation();
    window.location.href = d.url;
  });

  // Background dblclick reheat
  svg.on('dblclick', function(){
    simulation.alpha(0.7).restart();
    setHudStatus('REHEAT');
    setTimeout(function(){ setHudStatus('LIVE'); }, 1200);
  });

  function setHudStatus(_s){ /* HUD removed; no-op */ }

  // Tick
  simulation.on('tick', function(){
    link.attr('x1', function(d){ return d.source.x; })
        .attr('y1', function(d){ return d.source.y; })
        .attr('x2', function(d){ return d.target.x; })
        .attr('y2', function(d){ return d.target.y; });
    node.attr('transform', function(d){ return 'translate(' + d.x + ',' + d.y + ')'; });
  });

  // Search
  var searchInput = document.getElementById('bw-graph-search');
  searchInput.addEventListener('input', function(){
    var q = this.value.trim().toLowerCase();
    node.classed('hit', function(d){ return q && d.label.toLowerCase().indexOf(q) !== -1; });
    node.classed('dim', function(d){ return q && d.label.toLowerCase().indexOf(q) === -1; });
    link.classed('dim', function(l){
      if (!q) return false;
      var s = typeof l.source === 'object' ? l.source.label : '';
      var t = typeof l.target === 'object' ? l.target.label : '';
      return s.toLowerCase().indexOf(q) === -1 && t.toLowerCase().indexOf(q) === -1;
    });
  });

  // Mode (force/radial/grid) — still available via keyboard 1/2/3
  var mode = 'force';
  function applyMode(){
    // Release any pins
    data.nodes.forEach(function(n){ n.fx = null; n.fy = null; });
    node.classed('pinned', false);
    if (mode === 'force') {
      simulation.force('r', null).force('gridX', null).force('gridY', null);
      simulation.force('x', d3.forceX(width/2).strength(0.04));
      simulation.force('y', d3.forceY(height/2).strength(0.04));
    } else if (mode === 'radial') {
      var cats = Object.keys(colors);
      simulation.force('x', null).force('y', null);
      simulation.force('r', d3.forceRadial(function(d){
        var idx = cats.indexOf(d.category);
        return 80 + (idx % 4) * 60;
      }, width/2, height/2).strength(0.8));
    } else if (mode === 'grid') {
      var cats = Object.keys(colors).filter(function(c){
        return data.nodes.some(function(n){ return n.category === c; });
      });
      var cols = Math.ceil(Math.sqrt(cats.length));
      var cellW = width / (cols + 1);
      var cellH = height / (cols + 1);
      var catPos = {};
      cats.forEach(function(c, i){
        catPos[c] = { x: cellW * ((i % cols) + 1), y: cellH * (Math.floor(i / cols) + 1) };
      });
      simulation.force('r', null);
      simulation.force('x', d3.forceX(function(d){ return (catPos[d.category] || {x: width/2}).x; }).strength(0.5));
      simulation.force('y', d3.forceY(function(d){ return (catPos[d.category] || {y: height/2}).y; }).strength(0.5));
    }
    simulation.alpha(0.7).restart();
  }

  // Pause / Fit / Unpin — no UI, callable via keyboard shortcut
  var paused = false;
  function togglePause(){
    paused = !paused;
    if (paused) simulation.stop(); else simulation.restart();
  }
  function fitView(){
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
  }
  function unpinAll(){
    data.nodes.forEach(function(n){ n.fx = null; n.fy = null; });
    node.classed('pinned', false);
    simulation.alpha(0.5).restart();
  }

  // Legend clickable filter
  var hidden = new Set();
  document.querySelectorAll('#bw-graph-legend .bw-legend-item').forEach(function(el, idx){
    var catId = Object.keys(catTitles)[idx];
    el.addEventListener('click', function(){
      if (hidden.has(catId)) hidden.delete(catId); else hidden.add(catId);
      el.classList.toggle('disabled');
      node.style('display', function(d){ return hidden.has(d.category) ? 'none' : null; });
      link.style('display', function(l){
        var s = typeof l.source === 'object' ? l.source.category : null;
        var t = typeof l.target === 'object' ? l.target.category : null;
        return (hidden.has(s) || hidden.has(t)) ? 'none' : null;
      });
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e){
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === 'f' || e.key === 'F') { fitView(); }
    else if (e.key === '+' || e.key === '=') { zoomStep(1.4); }
    else if (e.key === '-' || e.key === '_') { zoomStep(0.7); }
    else if (e.key === '0') { zoomReset(); }
    else if (e.key === 'Escape') {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      unpinAll();
    }
  });

  // Resize handling
  window.addEventListener('resize', function(){
    width = container.clientWidth;
    height = container.clientHeight || 600;
    svg.attr('viewBox', '0 0 ' + width + ' ' + height);
    simulation.force('center', d3.forceCenter(width / 2, height / 2));
    simulation.alpha(0.3).restart();
  });
})();
</script>`;

    // Link suggestions banner
    const suggestionsPath = join(bwDir, 'outputs', 'link-suggestions.json');
    let suggestionsCard = '';
    if (existsSync(suggestionsPath)) {
      try {
        const suggestionsData = JSON.parse(readFileSync(suggestionsPath, 'utf-8'));
        if (Array.isArray(suggestionsData) && suggestionsData.length > 0) {
          suggestionsCard = `<div class="bw-dash-card full-width">
            <div class="bw-dash-card-header yellow">Link suggestions</div>
            <div class="bw-dash-card-body">
              <p>${suggestionsData.length} link suggestion${suggestionsData.length === 1 ? '' : 's'} available</p>
              <a href="/suggestions" style="color: #3366cc; text-decoration: none; font-weight: 500;">View suggestions &rarr;</a>
            </div>
          </div>`;
        }
      } catch {
        // ignore parse errors
      }
    }

    const body = `
      <div class="bw-welcome-header">
        <div class="bw-welcome-title">Welcome to <em>${escapeHtml(config.projectName)}</em> Wiki</div>
        <div class="bw-welcome-sub">the brand intelligence base compiled from ${Object.keys(manifest.rawFiles).length} raw sources</div>
        <div class="bw-welcome-stats">${articles.length} articles across ${config.categories.length} categories · ${totalWords.toLocaleString()} words</div>
      </div>
      <div class="bw-dashboard">
        ${suggestionsCard}
        ${browseCard}
        ${featuredCard}
        ${recentCard}
        ${aboutCard}
        ${healthCard}
        ${graphCard}
      </div>
    `;

    return htmlShell({
      title: 'Main Page',
      projectName: config.projectName,
      categories: config.categories,
      body,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
      extraBodyEnd: graphScript,
      needsD3: true,
    });
  }

  function renderCategoryPage(
    catId: string,
    articles: Article[],
    manifest: Manifest,
    view: 'cards' | 'list' | 'alpha' = 'cards'
  ): string {
    const cat = config.categories.find((c) => c.id === catId);
    if (!cat) return render404(manifest);
    const items = articles.filter((a) => a.category === catId);

    const toggle = `<div class="bw-view-toggle">
      <a href="/category/${catId}?view=cards" class="${view === 'cards' ? 'active' : ''}">Cards</a>
      <a href="/category/${catId}?view=list" class="${view === 'list' ? 'active' : ''}">List</a>
      <a href="/category/${catId}?view=alpha" class="${view === 'alpha' ? 'active' : ''}">A-Z</a>
    </div>`;

    let viewBody = '';

    if (view === 'cards') {
      const scoreArticle = (a: Article): number => {
        const confScore = a.confidence === 'high' ? 3 : a.confidence === 'medium' ? 2 : 1;
        return confScore * 1000 + a.words;
      };
      const sorted = [...items].sort((x, y) => scoreArticle(y) - scoreArticle(x));
      const topId = sorted.length > 0 ? `${sorted[0].category}/${sorted[0].slug}` : null;
      const color = categoryColor(catId);

      const cards = sorted
        .map((a, idx) => {
          const excerpt = extractExcerpt(a.body, idx === 0 ? 320 : 220);
          const isFeatured = idx === 0 && sorted.length > 1;
          const isKey = `${a.category}/${a.slug}` === topId;
          const relTime = relativeTimeJa(a.updatedAtIso);
          const readTime = readingTimeJa(a.words);
          const keyBadge = isKey ? `<span class="bw-key-badge">★ KEY</span>` : '';
          const corners = `<span class="bw-corner tl"></span><span class="bw-corner tr"></span><span class="bw-corner bl"></span><span class="bw-corner br"></span>`;
          return `<a class="bw-article-card${isFeatured ? ' featured' : ''}" href="/article/${a.category}/${a.slug}" style="--cat-color: ${color}; text-decoration: none;">
            ${corners}
            <div class="bw-article-card-eyebrow">
              ${escapeHtml(cat.title)}
              ${keyBadge}
            </div>
            <div class="bw-article-card-title">${escapeHtml(a.title)}</div>
            <div class="bw-article-card-excerpt">${escapeHtml(excerpt)}</div>
            <div class="bw-article-card-meta">
              <span><strong>${escapeHtml(a.confidence)}</strong></span>
              <span class="bw-dot"></span>
              <span>${escapeHtml(readTime)}</span>
              <span class="bw-dot"></span>
              <span>${String(a.sources.length).padStart(2, '0')} SRC</span>
              <span class="bw-dot"></span>
              <span title="${escapeHtml(a.updated)}">${escapeHtml(relTime)}</span>
            </div>
          </a>`;
        })
        .join('');
      viewBody = `<div class="bw-article-cards">${cards}</div>`;
    } else if (view === 'list') {
      const rows = items
        .map(
          (a) => `<tr>
            <td><a href="/article/${a.category}/${a.slug}">${escapeHtml(a.title)}</a><div class="bw-search-meta">${escapeHtml(extractExcerpt(a.body, 110))}</div></td>
            <td><span class="bw-badge conf-${a.confidence}">${escapeHtml(a.confidence)}</span></td>
            <td>${a.words.toLocaleString()}</td>
            <td>${escapeHtml(a.updated)}</td>
          </tr>`
        )
        .join('');
      viewBody = `<table class="bw-cat-table">
        <thead>
          <tr><th>Article</th><th>Confidence</th><th>Words</th><th>Updated</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
    } else if (view === 'alpha') {
      const groups: Record<string, Article[]> = {};
      for (const a of items) {
        const key = firstChar(a.title);
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
      }
      const order = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ', '0-9', '他'];
      const otherKeys = Object.keys(groups).filter((k) => !order.includes(k)).sort();
      const sortedKeys = [...order.filter((k) => groups[k]), ...otherKeys];
      viewBody = sortedKeys
        .map((k) => {
          const sorted = groups[k].sort((x, y) => x.title.localeCompare(y.title, 'ja'));
          const lis = sorted
            .map(
              (a) => `<li>
              <a href="/article/${a.category}/${a.slug}">${escapeHtml(a.title)}</a>
              <span class="bw-conf-dot ${a.confidence}" title="${escapeHtml(a.confidence)}"></span>
            </li>`
            )
            .join('');
          return `<div class="bw-alpha-group">
            <div class="bw-alpha-header">${escapeHtml(k)}</div>
            <ul class="bw-alpha-list">${lis}</ul>
          </div>`;
        })
        .join('');
    }

    const nav = renderContextNav(articles, catId);
    const body = `
      <div class="bw-page-layout">
        <aside class="bw-context-nav">${nav}</aside>
        <div>
          <div class="bw-breadcrumb"><a href="/">Main Page</a> › Category</div>
          <h1 class="bw-title">Category: ${escapeHtml(cat.title)}</h1>
          <div class="bw-subtitle">${escapeHtml(cat.description)}</div>
          <p>This category contains <b>${items.length}</b> article${items.length === 1 ? '' : 's'}.</p>
          ${toggle}
          ${viewBody}
        </div>
      </div>
    `;

    return htmlShell({
      title: `Category: ${cat.title}`,
      projectName: config.projectName,
      categories: config.categories,
      currentCategory: catId,
      body,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
    });
  }

  function renderArticlePage(catId: string, slug: string, articles: Article[], manifest: Manifest): string {
    const article = articles.find((a) => a.category === catId && a.slug === slug);
    if (!article) return render404(manifest);
    const cat = config.categories.find((c) => c.id === catId);
    const catTitle = cat?.title ?? catId;

    // Brandbook articles → consulting report style
    if (catId.startsWith('bb-')) {
      return renderBrandbookReport(article, catId, catTitle, articles, manifest);
    }

    const processed = processArticleBody({
      body: article.body,
      articleIndex: buildIndex(articles),
    });

    const infobox = buildInfobox(article, catTitle);
    const references = buildReferences(article.sources);
    const catFooter = buildCategoriesFooter(catId, catTitle);
    const sidebarTocInner = buildSidebarToc(processed.toc);
    const contextNavInner = renderContextNav(articles, catId);

    // Combine context nav + TOC into one sticky sidebar
    const combinedSidebar = `<aside class="bw-toc-sidebar">
      ${contextNavInner}
      ${sidebarTocInner ? `<div class="bw-toc-divider"></div>${sidebarTocInner.replace('<aside class="bw-toc-sidebar">', '<div>').replace(/<\/aside>$/, '</div>')}` : ''}
    </aside>`;

    const layoutClass =
      'bw-article-layout' + (!infobox ? ' no-infobox' : '');
    const escapedMarkdown = escapeHtml(article.body);
    const body = `
      <div class="${layoutClass}">
        ${combinedSidebar}
        <div class="bw-article-main">
          <button class="bw-edit-btn" id="bw-edit-btn" data-category="${escapeHtml(catId)}" data-slug="${escapeHtml(slug)}">Edit</button>
          <div class="bw-breadcrumb">
            <a href="/">Main Page</a> ›
            <a href="/category/${catId}">${escapeHtml(catTitle)}</a>
          </div>
          <h1 class="bw-title">${escapeHtml(article.title)}</h1>
          <div class="bw-subtitle">From ${escapeHtml(config.projectName)} Brand Wiki</div>
          <div class="bw-article" id="bw-article-view">${processed.html}</div>
          <div id="bw-editor-container" style="display:none;">
            <div class="bw-editor-toolbar">
              <button type="button" id="bw-tb-bold" title="Bold">B</button>
              <button type="button" id="bw-tb-link" title="Wiki Link">[[Link]]</button>
              <button type="button" id="bw-tb-heading" title="Heading"># H</button>
            </div>
            <textarea class="bw-editor-textarea" id="bw-editor-textarea">${escapedMarkdown}</textarea>
            <div class="bw-edit-actions">
              <button type="button" class="bw-save-btn" id="bw-save-btn">Save</button>
              <button type="button" class="bw-cancel-btn" id="bw-cancel-btn">Cancel</button>
            </div>
          </div>
          ${references}
          ${catFooter}
          <div class="bw-comments" id="bw-comments" data-category="${escapeHtml(catId)}" data-slug="${escapeHtml(slug)}">
            <div class="bw-comments-header">Notes &amp; Comments <span id="bw-comment-count"></span></div>
            <div id="bw-comments-list"></div>
            <div class="bw-comment-form">
              <textarea id="bw-comment-text" placeholder="Add a note or comment..."></textarea>
              <div class="bw-comment-form-row">
                <input type="text" id="bw-comment-author" placeholder="Name (optional)">
                <button type="submit" id="bw-comment-submit">Add Note</button>
              </div>
            </div>
          </div>
        </div>
        <aside class="bw-article-infobox-col">${infobox}</aside>
      </div>
    `;

    const scrollSpyScript = `<script>
    (function(){
      var toc = document.querySelector('.bw-toc-sidebar');
      if (!toc) return;
      var headings = Array.prototype.slice.call(document.querySelectorAll('.bw-article h2[id], .bw-article h3[id]'));
      if (headings.length === 0) return;
      var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
      var linkById = {};
      links.forEach(function(a){
        var id = decodeURIComponent(a.getAttribute('href').slice(1));
        linkById[id] = a;
      });
      var ticking = false;
      function update() {
        var scrollY = window.scrollY + 140;
        var current = null;
        for (var i = 0; i < headings.length; i++) {
          if (headings[i].offsetTop <= scrollY) current = headings[i];
          else break;
        }
        var activeId = current ? current.id : headings[0].id;
        links.forEach(function(a){ a.classList.remove('active'); });
        if (linkById[activeId]) linkById[activeId].classList.add('active');
        ticking = false;
      }
      window.addEventListener('scroll', function(){
        if (!ticking) { requestAnimationFrame(update); ticking = true; }
      }, { passive: true });
      update();
    })();
    </script>`;

    return htmlShell({
      title: article.title,
      projectName: config.projectName,
      categories: config.categories,
      currentCategory: catId,
      body,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
      extraBodyEnd: scrollSpyScript + buildEditorScript() + buildCommentsScript(),
      needsMermaid: processed.html.includes('class="mermaid"'),
      needsHighlight: processed.html.includes('<code class="language-'),
    });
  }


  function buildEditorScript(): string {
    return `<script>
(function(){
  var editBtn = document.getElementById('bw-edit-btn');
  var articleView = document.getElementById('bw-article-view');
  var editorContainer = document.getElementById('bw-editor-container');
  var textarea = document.getElementById('bw-editor-textarea');
  var saveBtn = document.getElementById('bw-save-btn');
  var cancelBtn = document.getElementById('bw-cancel-btn');
  if (!editBtn || !articleView || !editorContainer || !textarea) return;
  var category = editBtn.getAttribute('data-category');
  var slug = editBtn.getAttribute('data-slug');
  editBtn.addEventListener('click', function(){
    articleView.style.display = 'none';
    editorContainer.style.display = 'block';
    editBtn.style.display = 'none';
  });
  cancelBtn.addEventListener('click', function(){
    articleView.style.display = '';
    editorContainer.style.display = 'none';
    editBtn.style.display = '';
  });
  function insertAround(before, after){
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var text = textarea.value;
    var selected = text.substring(start, end) || 'text';
    textarea.value = text.substring(0, start) + before + selected + after + text.substring(end);
    textarea.focus();
    textarea.selectionStart = start + before.length;
    textarea.selectionEnd = start + before.length + selected.length;
  }
  document.getElementById('bw-tb-bold').addEventListener('click', function(){ insertAround('**', '**'); });
  document.getElementById('bw-tb-link').addEventListener('click', function(){ insertAround('[[', ']]'); });
  document.getElementById('bw-tb-heading').addEventListener('click', function(){
    var start = textarea.selectionStart;
    var text = textarea.value;
    var lineStart = text.lastIndexOf('\\n', start - 1) + 1;
    textarea.value = text.substring(0, lineStart) + '## ' + text.substring(lineStart);
    textarea.focus();
  });
  saveBtn.addEventListener('click', function(){
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    fetch('/article/' + encodeURIComponent(category) + '/' + encodeURIComponent(slug), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: textarea.value })
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (data.ok) {
        var toast = document.createElement('div');
        toast.className = 'bw-toast';
        toast.textContent = 'Saved!';
        document.body.appendChild(toast);
        setTimeout(function(){ toast.remove(); }, 2200);
        setTimeout(function(){ location.reload(); }, 600);
      } else {
        alert('Save failed: ' + (data.error || 'unknown error'));
      }
    })
    .catch(function(err){ alert('Save failed: ' + err.message); })
    .finally(function(){ saveBtn.disabled = false; saveBtn.textContent = 'Save'; });
  });
})();
<\/script>`;
  }

  function buildCommentsScript(): string {
    return `<script>
(function(){
  var container = document.getElementById('bw-comments');
  var list = document.getElementById('bw-comments-list');
  var countEl = document.getElementById('bw-comment-count');
  var textEl = document.getElementById('bw-comment-text');
  var authorEl = document.getElementById('bw-comment-author');
  var submitBtn = document.getElementById('bw-comment-submit');
  if (!container || !list) return;
  var category = container.getAttribute('data-category');
  var slug = container.getAttribute('data-slug');
  var baseUrl = '/_comments/' + encodeURIComponent(category) + '/' + encodeURIComponent(slug);
  function escHtml(s){ var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function renderComments(comments){
    countEl.textContent = '(' + comments.length + ')';
    if (comments.length === 0){
      list.innerHTML = '<p style="color:#999;font-size:13px;">No comments yet.</p>';
      return;
    }
    list.innerHTML = comments.map(function(c){
      var date = new Date(c.createdAt);
      var dateStr = isNaN(date.getTime()) ? c.createdAt : date.toLocaleString();
      return '<div class="bw-comment" data-id="' + escHtml(c.id) + '">' +
        '<button class="bw-comment-delete" title="Delete">&times;</button>' +
        '<div class="bw-comment-meta">' + escHtml(c.author || 'anonymous') + ' &middot; ' + escHtml(dateStr) + '</div>' +
        '<div class="bw-comment-text">' + escHtml(c.text) + '</div></div>';
    }).join('');
    list.querySelectorAll('.bw-comment-delete').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.parentElement.getAttribute('data-id');
        if (!confirm('Delete this comment?')) return;
        fetch(baseUrl + '/' + encodeURIComponent(id), { method: 'DELETE' })
          .then(function(r){ return r.json(); })
          .then(function(data){ renderComments(data); })
          .catch(function(err){ alert('Delete failed: ' + err.message); });
      });
    });
  }
  fetch(baseUrl).then(function(r){ return r.json(); }).then(renderComments).catch(function(){ renderComments([]); });
  submitBtn.addEventListener('click', function(){
    var text = textEl.value.trim();
    if (!text) return;
    submitBtn.disabled = true;
    fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, author: authorEl.value.trim() || undefined })
    })
    .then(function(r){ return r.json(); })
    .then(function(data){ renderComments(data); textEl.value = ''; })
    .catch(function(err){ alert('Failed: ' + err.message); })
    .finally(function(){ submitBtn.disabled = false; });
  });
})();
<\/script>`;
  }

  function renderAllPage(articles: Article[], manifest: Manifest): string {
    const sorted = [...articles].sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
    const rows = sorted
      .map(
        (a) => `<tr>
          <td><a href="/category/${a.category}">${escapeHtml(config.categories.find((c) => c.id === a.category)?.title ?? a.category)}</a></td>
          <td><a href="/article/${a.category}/${a.slug}">${escapeHtml(a.title)}</a></td>
          <td><span class="bw-badge status-${a.status}">${escapeHtml(a.status)}</span></td>
          <td><span class="bw-badge conf-${a.confidence}">${escapeHtml(a.confidence)}</span></td>
          <td>${a.words.toLocaleString()}</td>
        </tr>`
      )
      .join('');
    const nav = renderContextNav(articles);
    const body = `
      <div class="bw-page-layout">
        <aside class="bw-context-nav">${nav}</aside>
        <div>
          <div class="bw-breadcrumb"><a href="/">Main Page</a> › All Articles</div>
          <h1 class="bw-title">All Articles</h1>
          <div class="bw-subtitle">Complete list of ${articles.length} articles across ${config.categories.length} categories</div>
          <table class="bw-cat-table">
            <thead><tr><th>Category</th><th>Article</th><th>Status</th><th>Confidence</th><th>Words</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
    return htmlShell({
      title: 'All Articles',
      projectName: config.projectName,
      categories: config.categories,
      body,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
    });
  }

  function renderSearchPage(query: string, articles: Article[], manifest: Manifest): string {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return htmlShell({
        title: 'Search',
        projectName: config.projectName,
        categories: config.categories,
        body: `<h1 class="bw-title">Search</h1><p>Enter a query in the sidebar to search all wiki articles.</p>`,
        lastCompile: manifest.lastCompile,
        extraHead: liveReloadScript,
      });
    }

    const hits: Array<{ article: Article; snippet: string; score: number }> = [];
    for (const a of articles) {
      const titleLc = a.title.toLowerCase();
      const bodyLc = a.body.toLowerCase();
      const titleHit = titleLc.includes(needle);
      const bodyIdx = bodyLc.indexOf(needle);
      if (!titleHit && bodyIdx === -1) continue;
      let snippet = '';
      if (bodyIdx !== -1) {
        const start = Math.max(0, bodyIdx - 80);
        const end = Math.min(a.body.length, bodyIdx + needle.length + 140);
        snippet = (start > 0 ? '…' : '') + a.body.slice(start, end) + (end < a.body.length ? '…' : '');
      } else {
        snippet = a.body.slice(0, 200);
      }
      hits.push({ article: a, snippet, score: titleHit ? 2 : 1 });
    }
    hits.sort((x, y) => y.score - x.score);

    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const highlightRe = new RegExp(escapeRe(needle), 'gi');
    const results = hits
      .slice(0, 50)
      .map((h) => {
        const cat = config.categories.find((c) => c.id === h.article.category);
        const hlSnippet = escapeHtml(h.snippet).replace(highlightRe, (m) => `<mark>${m}</mark>`);
        const hlTitle = escapeHtml(h.article.title).replace(highlightRe, (m) => `<mark>${m}</mark>`);
        return `<div class="bw-search-result">
          <div class="bw-search-result-title"><a href="/article/${h.article.category}/${h.article.slug}">${hlTitle}</a></div>
          <div class="bw-search-meta">${escapeHtml(cat?.title ?? h.article.category)} · ${h.article.words.toLocaleString()} words</div>
          <div class="bw-search-snippet">${hlSnippet}</div>
        </div>`;
      })
      .join('');

    const nav = renderContextNav(articles);
    const body = `
      <div class="bw-page-layout">
        <aside class="bw-context-nav">${nav}</aside>
        <div>
          <div class="bw-breadcrumb"><a href="/">Main Page</a> › Search</div>
          <h1 class="bw-title">Search results</h1>
          <div class="bw-subtitle">${hits.length} result${hits.length === 1 ? '' : 's'} for <strong>${escapeHtml(query)}</strong></div>
          ${results || '<p>No results found.</p>'}
        </div>
      </div>
    `;
    return htmlShell({
      title: `Search: ${query}`,
      projectName: config.projectName,
      categories: config.categories,
      body,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
    });
  }

  function renderRecentChangesPage(articles: Article[], manifest: Manifest): string {
    const entries = Object.entries(manifest.articles)
      .map(([key, meta]) => {
        const [cat, slug] = key.split('/');
        const article = articles.find((a) => a.category === cat && a.slug === slug);
        return { cat, slug, meta, article };
      })
      .filter((e) => e.article)
      .sort((x, y) => (y.meta.updatedAt > x.meta.updatedAt ? 1 : -1));

    const rows = entries
      .map((e) => {
        const catTitle = config.categories.find((c) => c.id === e.cat)?.title ?? e.cat;
        const date = formatJST(e.meta.updatedAt);
        return `<li>
          <span class="bw-recent-date">${escapeHtml(date)}</span>
          <a href="/article/${e.cat}/${e.slug}">${escapeHtml(e.article!.title)}</a>
          <span class="bw-search-meta"> — ${escapeHtml(catTitle)}, ${e.meta.words.toLocaleString()} words</span>
        </li>`;
      })
      .join('');

    const nav = renderContextNav(articles);
    const body = `
      <div class="bw-page-layout">
        <aside class="bw-context-nav">${nav}</aside>
        <div>
          <div class="bw-breadcrumb"><a href="/">Main Page</a> › Special</div>
          <h1 class="bw-title">Recent Changes</h1>
          <div class="bw-subtitle">Articles in order of most recent compile</div>
          <ul class="bw-recent-list">${rows || '<li>No articles yet.</li>'}</ul>
        </div>
      </div>
    `;
    return htmlShell({
      title: 'Recent Changes',
      projectName: config.projectName,
      categories: config.categories,
      body,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
    });
  }

  function renderLintPage(manifest: Manifest): string {
    const lintResultsPath = join(bwDir, 'outputs', 'lint-results.json');
    let lintResult: LintResult | null = null;
    if (existsSync(lintResultsPath)) {
      try {
        lintResult = JSON.parse(readFileSync(lintResultsPath, 'utf-8')) as LintResult;
      } catch {
        lintResult = null;
      }
    }
    let bodyHtml = '<h1 class="bw-title">Wiki Quality Check</h1>';
    if (!lintResult) {
      bodyHtml += '<div class="bw-lint-run-section">' +
        '<p>No lint results found. Run a quality check to analyze wiki articles for contradictions, missing data, and other issues.</p>' +
        '<p style="margin-bottom:24px;color:var(--bw-text-muted);font-size:13px;">This uses the LLM and may take a minute or two.</p>' +
        '<button class="bw-lint-run-btn" id="bw-lint-run" onclick="runLintCheck()">Run Lint Check</button>' +
        '<div id="bw-lint-status" style="margin-top:16px;color:var(--bw-text-muted);"></div>' +
        '</div>' +
        '<script>function runLintCheck(){var btn=document.getElementById("bw-lint-run"),status=document.getElementById("bw-lint-status");btn.disabled=true;btn.textContent="Running...";status.textContent="Analyzing articles with LLM... This may take a few minutes.";fetch("/_lint/run",{method:"POST"}).then(function(r){return r.json()}).then(function(d){if(d.success){location.reload()}else{status.textContent="Error: "+(d.error||"Unknown");btn.disabled=false;btn.textContent="Run Lint Check"}}).catch(function(e){status.textContent="Error: "+e.message;btn.disabled=false;btn.textContent="Run Lint Check"})}</script>';
    } else {
      const lr = lintResult!;
      const issues = lr.issues;
      const criticalCount = issues.filter((i: { severity: string }) => i.severity === 'critical').length;
      const warningCount = issues.filter((i: { severity: string }) => i.severity === 'warning').length;
      const infoCount = issues.filter((i: { severity: string }) => i.severity === 'info').length;
      bodyHtml += '<p style="color:var(--bw-text-muted);margin-bottom:16px;">Last run: ' + escapeHtml(formatJST(lr.timestamp)) + ' | ' + lr.articleCount + ' articles analyzed</p>';
      bodyHtml += '<div class="bw-lint-summary">' +
        '<div class="bw-lint-stat total"><div class="bw-lint-stat-value">' + issues.length + '</div><div class="bw-lint-stat-label">Total Issues</div></div>' +
        '<div class="bw-lint-stat critical"><div class="bw-lint-stat-value">' + criticalCount + '</div><div class="bw-lint-stat-label">Critical</div></div>' +
        '<div class="bw-lint-stat warning"><div class="bw-lint-stat-value">' + warningCount + '</div><div class="bw-lint-stat-label">Warning</div></div>' +
        '<div class="bw-lint-stat info"><div class="bw-lint-stat-value">' + infoCount + '</div><div class="bw-lint-stat-label">Info</div></div>' +
        '</div>';
      const sevIcon: Record<string, string> = { critical: '\uD83D\uDD34', warning: '\uD83D\uDFE1', info: '\uD83D\uDD35' };
      for (const issue of issues) {
        const icon = sevIcon[issue.severity] ?? '\uD83D\uDD35';
        const artLinks = issue.articles.map((a: string) => '<a href="/search?q=' + encodeURIComponent(a) + '">' + escapeHtml(a) + '</a>').join('');
        bodyHtml += '<div class="bw-lint-card ' + issue.severity + '">' +
          '<div class="bw-lint-card-header"><span class="bw-lint-card-severity">' + icon + '</span><span class="bw-lint-card-category">' + escapeHtml(issue.category) + '</span></div>' +
          '<div class="bw-lint-card-desc">' + escapeHtml(issue.description) + '</div>' +
          (issue.suggestion ? '<div class="bw-lint-card-suggestion">' + escapeHtml(issue.suggestion) + '</div>' : '') +
          (artLinks ? '<div class="bw-lint-card-articles">' + artLinks + '</div>' : '') +
          '</div>';
      }
      bodyHtml += '<div style="margin-top:24px;">' +
        '<button class="bw-lint-run-btn" id="bw-lint-run" onclick="runLintCheck()">Re-run Lint</button>' +
        '<div id="bw-lint-status" style="margin-top:12px;color:var(--bw-text-muted);"></div>' +
        '</div>' +
        '<script>function runLintCheck(){var btn=document.getElementById("bw-lint-run"),status=document.getElementById("bw-lint-status");btn.disabled=true;btn.textContent="Running...";status.textContent="Analyzing articles with LLM... This may take a few minutes.";fetch("/_lint/run",{method:"POST"}).then(function(r){return r.json()}).then(function(d){if(d.success){location.reload()}else{status.textContent="Error: "+(d.error||"Unknown");btn.disabled=false;btn.textContent="Re-run Lint"}}).catch(function(e){status.textContent="Error: "+e.message;btn.disabled=false;btn.textContent="Re-run Lint"})}</script>' +
        '<details style="margin-top:24px;"><summary style="cursor:pointer;color:var(--bw-text-muted);font-size:13px;">Show raw report</summary>' +
        '<div class="bw-lint-raw">' + escapeHtml(lintResult.rawReport) + '</div></details>';
    }
    return htmlShell({ title: 'Wiki Quality Check', projectName: config.projectName, categories: config.categories, body: bodyHtml, lastCompile: manifest.lastCompile, extraHead: liveReloadScript });
  }

  function renderSuggestionsPage(articles: Article[], manifest: Manifest): string {
    const suggestionsFilePath = join(bwDir, 'outputs', 'link-suggestions.json');
    let suggestions: Array<{
      sourceArticle: string;
      sourceTitle: string;
      targetArticle: string;
      targetTitle: string;
      context: string;
    }> = [];
    if (existsSync(suggestionsFilePath)) {
      try {
        const rawData = JSON.parse(readFileSync(suggestionsFilePath, 'utf-8'));
        if (Array.isArray(rawData)) suggestions = rawData;
      } catch {
        // ignore
      }
    }

    const rows = suggestions.map((s) => {
      return `<div style="padding: 12px 16px; border-bottom: 1px solid #eaecf0; display: flex; align-items: flex-start; gap: 12px;">
        <div style="flex: 1;">
          <div style="font-size: 14px; margin-bottom: 4px;">
            In <a href="/article/${escapeHtml(s.sourceArticle)}" style="font-weight: 600;">${escapeHtml(s.sourceTitle)}</a>,
            the text mentions <a href="/article/${escapeHtml(s.targetArticle)}" style="font-weight: 600;">${escapeHtml(s.targetTitle)}</a>
          </div>
          <div style="font-size: 12px; color: #72777d; font-style: italic;">${escapeHtml(s.context)}</div>
        </div>
        <div style="flex-shrink: 0;">
          <span class="bw-badge conf-medium" style="cursor: default;" title="Suggest adding a link">Suggest: [[${escapeHtml(s.targetTitle)}]]</span>
        </div>
      </div>`;
    }).join('');

    const nav = renderContextNav(articles);
    const body = `
      <div class="bw-page-layout">
        <aside class="bw-context-nav">${nav}</aside>
        <div>
          <div class="bw-breadcrumb"><a href="/">Main Page</a> &rsaquo; Link Suggestions</div>
          <h1 class="bw-title">Link Suggestions</h1>
          <div class="bw-subtitle">${suggestions.length} potential cross-reference${suggestions.length === 1 ? '' : 's'} found</div>
          <p style="color: #72777d; font-size: 13px; margin-bottom: 16px;">Articles that mention other articles by name without linking to them.</p>
          <div style="border: 1px solid #eaecf0; border-radius: 6px; overflow: hidden;">
            ${rows || '<div style="padding: 16px; color: #72777d;">No suggestions available. Run <code>brandwiki compile</code> to generate.</div>'}
          </div>
        </div>
      </div>
    `;

    return htmlShell({
      title: 'Link Suggestions',
      projectName: config.projectName,
      categories: config.categories,
      body,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
    });
  }

  function renderBrandbookReport(article: Article, catId: string, catTitle: string, articles: Article[], manifest: Manifest): string {
    const processed = processArticleBody({
      body: article.body,
      articleIndex: buildIndex(articles),
    });

    // Detect content types for special rendering
    const html = processed.html;

    // Enhance tables with report styling
    const enhancedHtml = html
      .replace(/<table>/g, '<table class="bb-table">')
      .replace(/<h2/g, '<h2 class="bb-section-title"')
      .replace(/<h3/g, '<h3 class="bb-subsection-title"')
      .replace(/<blockquote>/g, '<blockquote class="bb-callout">');

    // Determine report type based on slug for special layouts
    const slugLower = article.slug.toLowerCase();
    let specialSection = '';

    // SWOT → 2x2 quadrant (detect from content)
    if (slugLower.includes('swot')) {
      specialSection = `<div class="bb-swot-grid">
        <div class="bb-swot-cell bb-swot-s"><div class="bb-swot-label">S</div><div class="bb-swot-title">Strengths</div></div>
        <div class="bb-swot-cell bb-swot-w"><div class="bb-swot-label">W</div><div class="bb-swot-title">Weaknesses</div></div>
        <div class="bb-swot-cell bb-swot-o"><div class="bb-swot-label">O</div><div class="bb-swot-title">Opportunities</div></div>
        <div class="bb-swot-cell bb-swot-t"><div class="bb-swot-label">T</div><div class="bb-swot-title">Threats</div></div>
      </div>`;
    }

    // KPI → metric cards
    if (slugLower.includes('kpi')) {
      specialSection = `<div class="bb-kpi-hint">📊 KPIs are extracted from the analysis below</div>`;
    }

    const groupLabel = catTitle;
    const groupIcon = catId === 'bb-brand-foundation' ? '📕'
      : catId === 'bb-competitive' ? '📊'
      : catId === 'bb-partnership' ? '🤝'
      : catId === 'bb-persona' ? '👤'
      : catId === 'bb-design' ? '🎨'
      : catId === 'bb-strategy' ? '🔮' : '📋';

    // Related reports in same category
    const relatedReports = articles
      .filter((a) => a.category === catId && a.slug !== article.slug)
      .map((a) => `<a href="/article/${a.category}/${a.slug}" class="bb-related-link">${escapeHtml(a.title)}</a>`)
      .join('');

    const body = `
      <div class="bb-report">
        <div class="bb-report-header">
          <div class="bb-report-badge">${groupIcon} ${escapeHtml(groupLabel)}</div>
          <h1 class="bb-report-title">${escapeHtml(article.title)}</h1>
          <div class="bb-report-meta">
            <span>${escapeHtml(config.projectName)}</span>
            <span class="bb-separator">·</span>
            <span>${article.updatedAtIso ? formatJST(article.updatedAtIso) : ''}</span>
            <span class="bb-separator">·</span>
            <span>${article.words} words</span>
            <span class="bb-separator">·</span>
            <span class="bb-confidence bb-conf-${article.confidence}">${article.confidence.toUpperCase()}</span>
          </div>
        </div>

        ${specialSection}

        <div class="bb-report-body">
          ${enhancedHtml}
        </div>

        ${relatedReports ? `<div class="bb-related">
          <div class="bb-related-title">Related Reports</div>
          <div class="bb-related-grid">${relatedReports}</div>
        </div>` : ''}

        <div class="bb-report-footer">
          <div class="bb-disclaimer">
            This report was auto-generated by brandwiki-engine from project data and external sources.
            Generated for ${escapeHtml(config.projectName)} · ${new Date().toLocaleDateString('ja-JP')}
          </div>
          <a href="/" class="bb-back-link">← Back to Wiki</a>
        </div>
      </div>
    `;

    return htmlShell({
      title: `${article.title} — ${groupLabel}`,
      projectName: config.projectName,
      categories: config.categories,
      currentCategory: catId,
      body,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
    });
  }

  function renderChatPage(manifest: Manifest): string {
    const langLabel = config.language === 'ja' ? '日本語で回答してください' : 'Answer in English';
    const placeholder = config.language === 'ja' ? 'Wiki について質問...' : 'Ask about the wiki...';
    return htmlShell({
      title: 'Chat',
      projectName: config.projectName,
      categories: config.categories,
      body: `
        <div style="max-width:800px;margin:0 auto;display:flex;flex-direction:column;height:calc(100vh - 120px);">
          <h1 class="bw-title">Chat with ${escapeHtml(config.projectName)} Wiki</h1>
          <div id="bw-chat-messages" style="flex:1;overflow-y:auto;padding:16px 0;display:flex;flex-direction:column;gap:12px;"></div>
          <div style="padding:12px 0;border-top:1px solid var(--bw-border, #ddd);display:flex;gap:8px;">
            <input id="bw-chat-input" type="text" placeholder="${placeholder}" style="flex:1;padding:10px 14px;border:1px solid var(--bw-border, #ddd);border-radius:6px;font-size:14px;background:var(--bw-input-bg, #f8f9fa);color:var(--bw-text, #202122);" />
            <button id="bw-chat-send" style="padding:10px 20px;background:#3366cc;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Send</button>
          </div>
        </div>
        <script>
        (function(){
          var msgs = document.getElementById('bw-chat-messages');
          var input = document.getElementById('bw-chat-input');
          var btn = document.getElementById('bw-chat-send');
          function addMsg(role, text) {
            var div = document.createElement('div');
            div.style.cssText = role === 'user'
              ? 'align-self:flex-end;background:#3366cc;color:#fff;padding:10px 14px;border-radius:12px 12px 2px 12px;max-width:70%;'
              : 'align-self:flex-start;background:var(--bw-card-bg, #f0f0f0);padding:10px 14px;border-radius:12px 12px 12px 2px;max-width:80%;white-space:pre-wrap;';
            div.textContent = text;
            msgs.appendChild(div);
            msgs.scrollTop = msgs.scrollHeight;
            return div;
          }
          function send() {
            var q = input.value.trim();
            if (!q) return;
            addMsg('user', q);
            input.value = '';
            var loading = addMsg('ai', 'Thinking...');
            fetch('/_chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) })
              .then(function(r){ return r.json(); })
              .then(function(d){ loading.textContent = d.answer || d.error || 'No response'; })
              .catch(function(e){ loading.textContent = 'Error: ' + e.message; });
          }
          btn.addEventListener('click', send);
          input.addEventListener('keydown', function(e){ if (e.key === 'Enter') send(); });
        })();
        </script>`,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
    });
  }

  function renderGraphPage(articles: Article[], manifest: Manifest): string {
    const graph = buildBacklinkGraph(articles);
    const catColorMap: Record<string, string> = {};
    const catTitleMap: Record<string, string> = {};
    for (const c of config.categories) { catColorMap[c.id] = categoryColor(c.id); catTitleMap[c.id] = c.title; }
    const graphLegend = config.categories
      .filter((c) => articles.some((a) => a.category === c.id))
      .map((c) => `<span class="bw-legend-item"><span class="bw-legend-dot" style="background:${categoryColor(c.id)}"></span>${escapeHtml(c.title)}</span>`)
      .join('');
    const fullGraphScript = `<script>
(function(){
  if (!window.d3) return;
  var data = ${JSON.stringify(graph)};
  var colors = ${JSON.stringify(catColorMap)};
  var catTitles = ${JSON.stringify(catTitleMap)};
  var container = document.getElementById('bw-graph-container');
  var svgEl = document.getElementById('bw-graph-svg');
  var tooltipEl = document.getElementById('bw-graph-tooltip');
  if (!container || !svgEl) return;
  var width = container.clientWidth;
  var height = container.clientHeight || 720;
  var svg = d3.select(svgEl).attr('viewBox', '0 0 ' + width + ' ' + height);
  var g = svg.append('g').attr('class', 'zoom-layer');
  var adjacency = {};
  data.nodes.forEach(function(n){ adjacency[n.id] = new Set([n.id]); });
  data.links.forEach(function(l){
    var s = typeof l.source === 'string' ? l.source : l.source.id;
    var t = typeof l.target === 'string' ? l.target : l.target.id;
    adjacency[s].add(t); adjacency[t].add(s);
  });
  function atomRadius(d){ return 5 + Math.min(14, d.degree * 1.6); }
  var simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.links).id(function(d){ return d.id; }).distance(100).strength(0.7))
    .force('charge', d3.forceManyBody().strength(-260).distanceMax(350))
    .force('center', d3.forceCenter(width/2, height/2))
    .force('collide', d3.forceCollide().radius(function(d){ return atomRadius(d)+6; }))
    .force('x', d3.forceX(width/2).strength(0.08))
    .force('y', d3.forceY(height/2).strength(0.08))
    .alphaTarget(0.008);
  var link = g.append('g').attr('class','links').selectAll('line').data(data.links).enter().append('line').attr('class','link').attr('data-type', function(d){ return d.type || 'reference'; });
  var node = g.append('g').attr('class','nodes').selectAll('g').data(data.nodes).enter().append('g').attr('class','node');
  node.append('circle').attr('class','atom').attr('r', atomRadius).attr('fill', function(d){ return colors[d.category]||'#888'; });
  node.append('text').attr('class','label').attr('dy', function(d){ return atomRadius(d)+15; }).text(function(d){ return d.label.length>14?d.label.slice(0,13)+'…':d.label; });
  var drag = d3.drag().on('start',function(e,d){ if(!e.active) simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; }).on('drag',function(e,d){ d.fx=e.x; d.fy=e.y; }).on('end',function(e,d){ if(!e.active) simulation.alphaTarget(0.008); d.fx=null; d.fy=null; });
  node.call(drag);
  var zoom = d3.zoom().scaleExtent([0.25,5]).on('zoom',function(e){ g.attr('transform',e.transform); });
  svg.call(zoom);
  node.on('mouseenter',function(e,d){
    var c = adjacency[d.id]||new Set([d.id]);
    node.classed('dim',function(n){return !c.has(n.id);}).classed('highlight',function(n){return c.has(n.id);});
    link.classed('dim',function(l){ var s=typeof l.source==='object'?l.source.id:l.source; var t=typeof l.target==='object'?l.target.id:l.target; return !(s===d.id||t===d.id); });
    link.classed('highlight',function(l){ var s=typeof l.source==='object'?l.source.id:l.source; var t=typeof l.target==='object'?l.target.id:l.target; return s===d.id||t===d.id; });
    tooltipEl.classList.add('visible'); tooltipEl.innerHTML='<div class="tt-title">'+d.label+'</div><div class="tt-meta">'+d.degree+' connections</div>';
    tooltipEl.style.left=(e.clientX+14)+'px'; tooltipEl.style.top=(e.clientY+14)+'px';
  });
  node.on('mouseleave',function(){ node.classed('dim',false).classed('highlight',false); link.classed('dim',false).classed('highlight',false); tooltipEl.classList.remove('visible'); });
  node.on('dblclick',function(e,d){ e.stopPropagation(); window.location.href=d.url; });
  simulation.on('tick',function(){
    link.attr('x1',function(d){return d.source.x;}).attr('y1',function(d){return d.source.y;}).attr('x2',function(d){return d.target.x;}).attr('y2',function(d){return d.target.y;});
    node.attr('transform',function(d){return 'translate('+d.x+','+d.y+')';});
  });
  var searchInput = document.getElementById('bw-graph-search');
  if(searchInput) searchInput.addEventListener('input',function(){
    var q = this.value.trim().toLowerCase();
    node.classed('hit',function(d){return q&&d.label.toLowerCase().indexOf(q)!==-1;});
    node.classed('dim',function(d){return q&&d.label.toLowerCase().indexOf(q)===-1;});
  });
  var btnIn=document.getElementById('bw-zoom-in'); var btnOut=document.getElementById('bw-zoom-out'); var btnReset=document.getElementById('bw-zoom-reset');
  if(btnIn) btnIn.addEventListener('click',function(){ svg.transition().duration(220).call(zoom.scaleBy,1.4); });
  if(btnOut) btnOut.addEventListener('click',function(){ svg.transition().duration(220).call(zoom.scaleBy,0.7); });
  if(btnReset) btnReset.addEventListener('click',function(){ svg.transition().duration(360).call(zoom.transform,d3.zoomIdentity); });
})();
</script>`;
    return htmlShell({
      title: 'Graph',
      projectName: config.projectName,
      categories: config.categories,
      body: `
        <div class="bw-graph-legend" id="bw-graph-legend">
          <span class="bw-legend-label"><a href="/" style="color:inherit;">← Back</a> | Backlink Graph</span>
          <span style="color:#a2a9b1;">|</span>
          ${graphLegend}
        </div>
        <div class="bw-graph-container" id="bw-graph-container" style="height:calc(100vh - 105px);">
          <svg id="bw-graph-svg"></svg>
          <div class="bw-graph-mini-search"><input type="search" id="bw-graph-search" placeholder="Search..." /></div>
          <div class="bw-graph-zoom">
            <button id="bw-zoom-out" title="Zoom out">−</button>
            <div class="bw-graph-zoom-level" id="bw-zoom-level">100%</div>
            <button id="bw-zoom-in" title="Zoom in">＋</button>
            <button id="bw-zoom-reset" title="Reset">⊙</button>
          </div>
          <div class="bw-graph-tooltip" id="bw-graph-tooltip"></div>
        </div>
        ${fullGraphScript}`,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
      needsD3: true,
    });
  }

  function renderTimelinePage(articles: Article[], manifest: Manifest): string {
    const sorted = [...articles].sort((a, b) => {
      const da = a.updatedAtIso || ''; const db = b.updatedAtIso || '';
      return db.localeCompare(da);
    });
    const groups: Record<string, Article[]> = {};
    for (const a of sorted) {
      const d = a.updatedAtIso ? new Date(a.updatedAtIso) : new Date();
      const key = d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    let timeline = '<div style="max-width:800px;margin:0 auto;padding:20px;">';
    timeline += '<h1 class="bw-title">Timeline</h1>';
    for (const [month, arts] of Object.entries(groups)) {
      timeline += `<h2 style="margin-top:24px;font-size:16px;color:var(--bw-text-secondary,#555);">${escapeHtml(month)}</h2>`;
      timeline += '<div style="border-left:2px solid var(--bw-border,#ddd);margin-left:8px;padding-left:20px;">';
      for (const a of arts) {
        const color = categoryColor(a.category);
        const catTitle = config.categories.find(c => c.id === a.category)?.title || a.category;
        const date = a.updatedAtIso ? new Date(a.updatedAtIso).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : '';
        timeline += `<div style="margin:12px 0;position:relative;">
          <div style="position:absolute;left:-27px;top:4px;width:12px;height:12px;border-radius:50%;background:${color};border:2px solid var(--bw-bg, #fff);"></div>
          <a href="/article/${a.category}/${a.slug}" style="font-weight:600;">${escapeHtml(a.title)}</a>
          <div style="font-size:11px;color:var(--bw-text-muted,#888);">${escapeHtml(catTitle)} · ${a.words} words · ${a.confidence} · ${date}</div>
        </div>`;
      }
      timeline += '</div>';
    }
    timeline += '</div>';
    return htmlShell({ title: 'Timeline', projectName: config.projectName, categories: config.categories, body: timeline, lastCompile: manifest.lastCompile, extraHead: liveReloadScript });
  }

  function renderChangesPage(articles: Article[], manifest: Manifest): string {
    const lastCompile = manifest.lastCompile;
    const recent = lastCompile ? articles.filter(a => a.updatedAtIso && a.updatedAtIso.startsWith(lastCompile.slice(0, 10))) : [];
    let body = '<div style="max-width:800px;margin:0 auto;padding:20px;">';
    body += '<h1 class="bw-title">Recent Changes</h1>';
    if (recent.length === 0) {
      body += '<p>No articles were updated in the most recent compile.</p>';
    } else {
      body += `<p>${recent.length} articles updated (last compile: ${lastCompile ? formatJST(lastCompile) : 'never'})</p><ul>`;
      for (const a of recent) {
        body += `<li><a href="/article/${a.category}/${a.slug}">${escapeHtml(a.title)}</a> <span style="color:var(--bw-text-muted,#888);font-size:12px;">${a.updatedAtIso || ''}</span></li>`;
      }
      body += '</ul>';
    }
    body += '</div>';
    return htmlShell({ title: 'Changes', projectName: config.projectName, categories: config.categories, body, lastCompile: manifest.lastCompile, extraHead: liveReloadScript });
  }

  function renderPdfExport(articles: Article[], manifest: Manifest): string {
    let body = `<div style="max-width:900px;margin:0 auto;padding:20px;font-family:serif;">`;
    body += `<h1>${escapeHtml(config.projectName)} — Brand Wiki</h1>`;
    body += `<p>Exported on ${new Date().toLocaleString('ja-JP')} · ${articles.length} articles</p><hr>`;
    const byCategory: Record<string, Article[]> = {};
    for (const a of articles) { if (!byCategory[a.category]) byCategory[a.category] = []; byCategory[a.category].push(a); }
    body += '<h2>Table of Contents</h2><ul>';
    for (const cat of config.categories) {
      const arts = byCategory[cat.id] || [];
      if (arts.length === 0) continue;
      body += `<li><strong>${escapeHtml(cat.title)}</strong><ul>`;
      for (const a of arts) body += `<li><a href="#${a.category}-${a.slug}">${escapeHtml(a.title)}</a></li>`;
      body += '</ul></li>';
    }
    body += '</ul><hr>';
    for (const cat of config.categories) {
      const arts = byCategory[cat.id] || [];
      if (arts.length === 0) continue;
      body += `<h2>${escapeHtml(cat.title)}</h2>`;
      for (const a of arts) {
        body += `<h3 id="${a.category}-${a.slug}">${escapeHtml(a.title)}</h3>`;
        body += `<div>${a.body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div><hr>`;
      }
    }
    body += '</div><style>@media print { body { font-size: 11pt; } a { color: inherit; text-decoration: none; } }</style>';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(config.projectName)} PDF Export</title></head><body>${body}</body></html>`;
  }

  function render404(manifest: Manifest): string {
    return htmlShell({
      title: '404',
      projectName: config.projectName,
      categories: config.categories,
      body: `<h1 class="bw-title">Page Not Found</h1><p>The requested page does not exist. <a href="/">Return to Main Page</a>.</p>`,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
    });
  }

  const server = createServer(async (req, res) => {
    try {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0]);

      if (url === '/_events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        res.write('retry: 2000\n\nevent: connected\ndata: ok\n\n');
        sseClients.add(res);

        const heartbeat = setInterval(() => {
          try {
            if (!res.writableEnded && res.writable) {
              res.write(`:hb ${Date.now()}\n\n`);
            } else {
              cleanup();
            }
          } catch {
            cleanup();
          }
        }, 15000);

        const cleanup = () => {
          clearInterval(heartbeat);
          sseClients.delete(res);
          try { res.end(); } catch {}
        };

        req.on('close', cleanup);
        req.on('error', cleanup);
        res.on('error', cleanup);
        res.on('close', cleanup);
        return;
      }

      if (url === '/_status') {
        const manifest = loadManifest(bwDir);
        const articles = await loadArticles();
        const payload = {
          mode: serverMode,
          liveReload: !options.noLiveReload,
          autoCompile: config.watch?.autoCompile ?? false,
          articles: articles.length,
          lastCompile: manifest.lastCompile ?? null,
          lastBroadcastAt,
          lastBroadcastReason,
          broadcastCount,
          sseClients: sseClients.size,
          serverStartedAt,
          now: Date.now(),
          port,
        };
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(JSON.stringify(payload));
        return;
      }

      if (url === '/_graph') {
        const articles = await loadArticles();
        const graph = buildBacklinkGraph(articles);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(JSON.stringify({ ...graph, ts: Date.now() }));
        return;
      }

      if (url === '/_chat' && req.method === 'POST') {
        const chatChunks: Buffer[] = [];
        for await (const chunk of req) {
          chatChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const chatBody = Buffer.concat(chatChunks).toString('utf-8');
        try {
          const parsedChat = JSON.parse(chatBody);
          const question = typeof parsedChat.question === 'string' ? parsedChat.question.trim() : '';
          if (!question) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'question is required' }));
            return;
          }
          const articles = await loadArticles();
          const q = question.toLowerCase();
          const matches = articles.filter(
            (a) =>
              a.title.toLowerCase().includes(q) ||
              a.body.toLowerCase().includes(q)
          ).slice(0, 5);
          const answer = matches.length > 0
            ? matches.map((a) => `[${a.title}](/article/${a.category}/${a.slug})`).join(', ')
            : 'No matching articles found.';
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ answer, sources: matches.map((a) => ({ title: a.title, url: `/article/${a.category}/${a.slug}` })) }));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'chat failed';
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: msg }));
        }
        return;
      }

      if (url === '/_lint/run' && req.method === 'POST') {
        try {
          const result = await runLint(bwDir);
          invalidateCache();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, issueCount: result.issues.length }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Lint failed';
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: message }));
        }
        return;
      }

      if (url === '/_lint') {
        const lintResultsPath = join(bwDir, 'outputs', 'lint-results.json');
        if (existsSync(lintResultsPath)) {
          const data = readFileSync(lintResultsPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
          res.end(data);
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ issues: [], rawReport: '', timestamp: null, articleCount: 0 }));
        }
        return;
      }

      // POST /article/:category/:slug — save edited article
      if (url.startsWith('/article/') && req.method === 'POST') {
        const postChunks: Buffer[] = [];
        for await (const chunk of req) {
          postChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const postBody = Buffer.concat(postChunks).toString('utf-8');
        try {
          const parsedBody = JSON.parse(postBody);
          const newContent = typeof parsedBody.content === 'string' ? parsedBody.content : '';
          if (!newContent) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'content is required' }));
            return;
          }
          const artParts = url.slice('/article/'.length).split('/');
          if (artParts.length < 2) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'invalid article path' }));
            return;
          }
          const editCat = artParts[0];
          const editSlug = artParts.slice(1).join('/');
          const filePath = join(bwDir, 'wiki', editCat, `${editSlug}.md`);
          if (!existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'article not found' }));
            return;
          }
          const existingRaw = readFileSync(filePath, 'utf-8');
          const existingParsed = matter(existingRaw);
          const updatedFile = matter.stringify(newContent, existingParsed.data);
          writeFileSync(filePath, updatedFile, 'utf-8');
          invalidateCache();
          broadcastReload();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'save failed';
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: msg }));
        }
        return;
      }

      // GET /_comments/:category/:slug
      if (url.startsWith('/_comments/') && req.method === 'GET') {
        const cParts = url.slice('/_comments/'.length).split('/');
        if (cParts.length < 2) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'invalid path' }));
          return;
        }
        const cCat = cParts[0];
        const cSlug = cParts[1];
        const cFile = join(bwDir, 'comments', cCat, `${cSlug}.json`);
        let cList: unknown[] = [];
        if (existsSync(cFile)) {
          try { cList = JSON.parse(readFileSync(cFile, 'utf-8')); } catch { cList = []; }
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(cList));
        return;
      }

      // POST /_comments/:category/:slug
      if (url.startsWith('/_comments/') && req.method === 'POST') {
        const cParts = url.slice('/_comments/'.length).split('/');
        if (cParts.length < 2) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'invalid path' }));
          return;
        }
        const cCat = cParts[0];
        const cSlug = cParts[1];
        const postChunks: Buffer[] = [];
        for await (const chunk of req) {
          postChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const postBody = Buffer.concat(postChunks).toString('utf-8');
        try {
          const parsedBody = JSON.parse(postBody);
          const cText = typeof parsedBody.text === 'string' ? parsedBody.text.trim() : '';
          if (!cText) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'text is required' }));
            return;
          }
          const cAuthor = typeof parsedBody.author === 'string' && parsedBody.author.trim()
            ? parsedBody.author.trim() : 'anonymous';
          const cDir = join(bwDir, 'comments', cCat);
          mkdirSync(cDir, { recursive: true });
          const cFile = join(cDir, `${cSlug}.json`);
          let cList: unknown[] = [];
          if (existsSync(cFile)) {
            try { cList = JSON.parse(readFileSync(cFile, 'utf-8')); } catch { cList = []; }
          }
          const newComment = {
            id: randomUUID(),
            text: cText,
            author: cAuthor,
            createdAt: new Date().toISOString(),
          };
          const updatedList = [...cList, newComment];
          writeFileSync(cFile, JSON.stringify(updatedList, null, 2), 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(updatedList));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'failed to add comment';
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: msg }));
        }
        return;
      }

      // DELETE /_comments/:category/:slug/:id
      if (url.startsWith('/_comments/') && req.method === 'DELETE') {
        const cParts = url.slice('/_comments/'.length).split('/');
        if (cParts.length < 3) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'invalid path' }));
          return;
        }
        const cCat = cParts[0];
        const cSlug = cParts[1];
        const cId = cParts[2];
        const cFile = join(bwDir, 'comments', cCat, `${cSlug}.json`);
        let cList: Array<{ id: string; [key: string]: unknown }> = [];
        if (existsSync(cFile)) {
          try { cList = JSON.parse(readFileSync(cFile, 'utf-8')); } catch { cList = []; }
        }
        const filtered = cList.filter((c) => c.id !== cId);
        const cDir = join(bwDir, 'comments', cCat);
        mkdirSync(cDir, { recursive: true });
        writeFileSync(cFile, JSON.stringify(filtered, null, 2), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(filtered));
        return;
      }

      const rawUrl = req.url ?? '/';
      const cacheKey = rawUrl;
      const cached = htmlCache.get(cacheKey);
      if (cached && url !== '/random') {
        const etag = '"' + createHash('md5').update(cached).digest('hex').slice(0, 16) + '"';
        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304, {
            ETag: etag,
            'Cache-Control': 'no-cache',
            'X-Cache': 'HIT-304',
          });
          res.end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          ETag: etag,
          'X-Cache': 'HIT',
        });
        res.end(cached);
        return;
      }

      const manifest = loadManifest(bwDir);
      const articles = await loadArticles();
      const queryString = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
      const params = new URLSearchParams(queryString);

      if (url === '/random' && articles.length > 0) {
        const pick = articles[Math.floor(Math.random() * articles.length)];
        res.writeHead(302, { Location: `/article/${pick.category}/${pick.slug}` });
        res.end();
        return;
      }

      let html = '';
      if (url === '/' || url === '/index.html') {
        html = renderMainPage(articles, manifest);
      } else if (url === '/all') {
        html = renderAllPage(articles, manifest);
      } else if (url === '/search') {
        html = renderSearchPage(params.get('q') ?? '', articles, manifest);
      } else if (url === '/special/recent-changes') {
        html = renderRecentChangesPage(articles, manifest);
      } else if (url.startsWith('/category/')) {
        const catId = url.slice('/category/'.length).replace(/\/$/, '');
        const viewParam = params.get('view');
        const view = viewParam === 'list' || viewParam === 'alpha' || viewParam === 'cards'
          ? viewParam
          : 'cards';
        html = renderCategoryPage(catId, articles, manifest, view);
      } else if (url === '/chat') {
        html = renderChatPage(manifest);
      } else if (url === '/graph') {
        html = renderGraphPage(articles, manifest);
      } else if (url === '/timeline') {
        html = renderTimelinePage(articles, manifest);
      } else if (url === '/changes') {
        html = renderChangesPage(articles, manifest);
      } else if (url === '/suggestions') {
        html = renderSuggestionsPage(articles, manifest);
      } else if (url === '/lint') {
        html = renderLintPage(manifest);
      } else if (url === '/_export/pdf') {
        html = renderPdfExport(articles, manifest);
      } else if (url.startsWith('/article/')) {
        const parts = url.slice('/article/'.length).split('/');
        if (parts.length >= 2) {
          html = renderArticlePage(parts[0], parts.slice(1).join('/'), articles, manifest);
        } else {
          html = render404(manifest);
        }
      } else {
        html = render404(manifest);
      }

      if (url !== '/random' && url !== '/search') {
        htmlCache.set(cacheKey, html);
      }
      const etag = '"' + createHash('md5').update(html).digest('hex').slice(0, 16) + '"';
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        ETag: etag,
        'X-Cache': 'MISS',
      });
      res.end(html);
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error: ${err.message}`);
    }
  });

  server.keepAliveTimeout = 30000;
  server.headersTimeout = 35000;
  server.requestTimeout = 60000;

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(pc.green(`✓ Brand Wiki server running`));
      console.log(pc.cyan(`  http://localhost:${port}`));
      console.log(pc.dim(`  Serving ${bwDir}/wiki`));
      resolve();
    });
  });
}
