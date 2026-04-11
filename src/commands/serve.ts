import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createServer } from 'node:http';
import fg from 'fast-glob';
import matter from 'gray-matter';
import pc from 'picocolors';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { loadManifest, type Manifest } from '../lib/manifest.js';
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

export function invalidateCache(): void {
  cachedArticles = null;
  htmlCache.clear();
}

export function broadcastReload(): void {
  invalidateCache();
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
  updated: string;
  updatedAtIso: string;
  sources: string[];
  body: string;
  words: number;
  path: string;
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
      try {
        var es = new EventSource('/_events');
        var closed = false;
        function killSSE() {
          if (closed) return;
          closed = true;
          try { es.close(); } catch(e) {}
        }
        es.addEventListener('reload', function(){ killSSE(); location.reload(); });
        es.onerror = function(){ /* browser auto-retries */ };
        window.addEventListener('pagehide', killSSE);
        window.addEventListener('beforeunload', killSSE);
      } catch (e) {}
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
        updated: formatJST(updatedAtIso) || toStr(parsed.data.updated),
        updatedAtIso,
        sources: toStrArray(parsed.data.sources),
        body: parsed.content,
        words: parsed.content.split(/\s+/).filter(Boolean).length,
        path: file,
      });
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
    const links: Array<{ source: string; target: string }> = [];
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
        links.push({ source: sourceId, target: idOf(found) });
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

    // Browse by category
    const browseItems = config.categories
      .filter((c) => (byCategory[c.id] ?? []).length > 0)
      .map((c) => {
        const count = (byCategory[c.id] ?? []).length;
        return `<div class="bw-browse-cat">
          <a href="/category/${c.id}" style="color: ${categoryColor(c.id)};">${escapeHtml(c.title)}</a>
          <span class="bw-browse-desc"> — ${escapeHtml(c.description.slice(0, 40))}</span>
          <span class="bw-browse-count"> (${count})</span>
        </div>`;
      })
      .join('');
    const browseCard = `<div class="bw-dash-card full-width">
      <div class="bw-dash-card-header green">Browse by category</div>
      <div class="bw-dash-card-body">
        <div class="bw-browse-grid">${browseItems}</div>
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
    .data(data.links).enter().append('line').attr('class', 'link');

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

    const body = `
      <div class="bw-welcome-header">
        <div class="bw-welcome-title">Welcome to <em>${escapeHtml(config.projectName)}</em> Wiki</div>
        <div class="bw-welcome-sub">the brand intelligence base compiled from ${Object.keys(manifest.rawFiles).length} raw sources</div>
        <div class="bw-welcome-stats">${articles.length} articles across ${config.categories.length} categories · ${totalWords.toLocaleString()} words</div>
      </div>
      <div class="bw-dashboard">
        ${featuredCard}
        ${recentCard}
        ${aboutCard}
        ${healthCard}
        ${browseCard}
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

    const body = `
      <div class="bw-breadcrumb"><a href="/">Main Page</a> › Category</div>
      <h1 class="bw-title">Category: ${escapeHtml(cat.title)}</h1>
      <div class="bw-subtitle">${escapeHtml(cat.description)}</div>
      <p>This category contains <b>${items.length}</b> article${items.length === 1 ? '' : 's'}.</p>
      ${toggle}
      ${viewBody}
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

    const processed = processArticleBody({
      body: article.body,
      articleIndex: buildIndex(articles),
    });

    const infobox = buildInfobox(article, catTitle);
    const references = buildReferences(article.sources);
    const catFooter = buildCategoriesFooter(catId, catTitle);
    const sidebarToc = buildSidebarToc(processed.toc);

    const body = `
      <div class="bw-article-layout">
        ${sidebarToc}
        <div class="bw-article-main">
          <div class="bw-breadcrumb">
            <a href="/">Main Page</a> ›
            <a href="/category/${catId}">${escapeHtml(catTitle)}</a>
          </div>
          <h1 class="bw-title">${escapeHtml(article.title)}</h1>
          <div class="bw-subtitle">From ${escapeHtml(config.projectName)} Brand Wiki</div>
          ${infobox}
          <div class="bw-article">${processed.html}</div>
          ${references}
          ${catFooter}
        </div>
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
      extraBodyEnd: scrollSpyScript,
      needsMermaid: processed.html.includes('class="mermaid"'),
      needsHighlight: processed.html.includes('<code class="language-'),
    });
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
    const body = `
      <div class="bw-breadcrumb"><a href="/">Main Page</a> › All Articles</div>
      <h1 class="bw-title">All Articles</h1>
      <div class="bw-subtitle">Complete list of ${articles.length} articles across ${config.categories.length} categories</div>
      <table class="bw-cat-table">
        <thead><tr><th>Category</th><th>Article</th><th>Status</th><th>Confidence</th><th>Words</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
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

    const body = `
      <div class="bw-breadcrumb"><a href="/">Main Page</a> › Search</div>
      <h1 class="bw-title">Search results</h1>
      <div class="bw-subtitle">${hits.length} result${hits.length === 1 ? '' : 's'} for <strong>${escapeHtml(query)}</strong></div>
      ${results || '<p>No results found.</p>'}
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

    const body = `
      <div class="bw-breadcrumb"><a href="/">Main Page</a> › Special</div>
      <h1 class="bw-title">Recent Changes</h1>
      <div class="bw-subtitle">Articles in order of most recent compile</div>
      <ul class="bw-recent-list">${rows || '<li>No articles yet.</li>'}</ul>
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

      const rawUrl = req.url ?? '/';
      const cacheKey = rawUrl;
      const cached = htmlCache.get(cacheKey);
      if (cached && url !== '/random') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
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
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
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
