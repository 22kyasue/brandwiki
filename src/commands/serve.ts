import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
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
import { callLLMStream } from '../lib/anthropic.js';
import { scanProject, getFileDetail, type ExplainProjectData } from '../lib/explain/data.js';
import { explainPageHtml } from '../lib/explain/template.js';
import { scanSourceFiles, healthColor, healthLabel, type FileGraphData } from '../lib/file-scanner.js';
import { motifKeyFor, motifPathFor, motifUrlFor, generateMotif, classifyRoleForMotif } from '../lib/motif-generator.js';

interface ServeOptions {
  port?: string;
  noLiveReload?: boolean;
}

const sseClients = new Set<import('node:http').ServerResponse>();
const SERVER_BOOT = Date.now();

// Paths currently having their motif regenerated (shown as "building" in the UI).
const buildingPaths = new Set<string>();
function broadcastBuilding(): void {
  const payload = `event: building\ndata: ${JSON.stringify(Array.from(buildingPaths))}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}

// In-memory caches. Invalidated via invalidateCache() when wiki files change.
let cachedArticles: any[] | null = null;
let cachedManifestMtime = 0;
const htmlCache = new Map<string, string>();
let cachedExplainData: ExplainProjectData | null = null;
let cachedFileGraph: FileGraphData | null = null;

export function invalidateCache(): void {
  cachedArticles = null;
  cachedExplainData = null;
  cachedFileGraph = null;
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
          // サーバーは接続直後に 'connected' イベントを送る (boot timestamp)
          var BOOT_KEY = 'bw-server-boot';
          es.addEventListener('connected', function(ev){
            setStatus(true, storedMs || 0);
            var boot = parseInt(ev.data, 10);
            if (!boot) return;
            var prev;
            try { prev = parseInt(sessionStorage.getItem(BOOT_KEY) || '0', 10); } catch(e) { prev = 0; }
            if (prev && prev !== boot) {
              // Server has restarted since this tab was last rendered — reload.
              try { sessionStorage.setItem(BOOT_KEY, String(boot)); } catch(e) {}
              killSSE();
              location.reload();
              return;
            }
            try { sessionStorage.setItem(BOOT_KEY, String(boot)); } catch(e) {}
          });
          es.addEventListener('building', function(ev){
            try {
              var list = JSON.parse(ev.data || '[]');
              window.__bwBuilding = list;
              window.dispatchEvent(new CustomEvent('bw-building', { detail: list }));
            } catch(e) {}
          });
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
      <li><a href="/graph">🔗 Graph</a></li>
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

  function buildGraphScript(
    graph: { nodes: any[]; links: any[] },
    catColorMap: Record<string, string>,
    catTitleMap: Record<string, string>,
    opts: { explainMode: boolean },
  ): string {
    const explainBlock = opts.explainMode ? `
  // === Explain mode: selection + streaming ===
  var selected = [];
  var explainNodeBtn = document.getElementById('bw-explain-node-btn');
  var explainEdgeBtn = document.getElementById('bw-explain-edge-btn');
  var explainPanel = document.getElementById('bw-explain-panel');
  var explainBody = document.getElementById('bw-explain-body');
  var explainClose = document.getElementById('bw-explain-close');
  var explainToggle = document.getElementById('bw-explain-toggle');
  var graphPage = document.querySelector('.bw-graph-page');

  function updateSelectionUI(){
    var ids = selected.map(function(n){ return n.id; });
    node.classed('selected', function(d){ return ids.indexOf(d.id) !== -1; });
    if (explainNodeBtn) explainNodeBtn.disabled = selected.length < 1;
    if (explainEdgeBtn) {
      var canEdge = selected.length === 2;
      if (canEdge) {
        var a = adjacency[selected[0].id];
        canEdge = a && a.has(selected[1].id);
      }
      explainEdgeBtn.disabled = !canEdge;
    }
  }

  function toggleSelect(d){
    var idx = selected.findIndex(function(n){ return n.id === d.id; });
    if (idx !== -1) {
      selected.splice(idx, 1);
    } else {
      if (selected.length >= 2) selected.shift();
      selected.push(d);
    }
    updateSelectionUI();
  }

  function clearSelection(){
    selected = [];
    updateSelectionUI();
  }

  if (explainClose) explainClose.addEventListener('click', function(){
    if (graphPage) graphPage.classList.add('panel-collapsed');
  });
  if (explainToggle) explainToggle.addEventListener('click', function(){
    if (graphPage) graphPage.classList.remove('panel-collapsed');
  });

  function simpleMarkdown(text){
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
      .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
      .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\\/li>)/gs, '<ul>$1</ul>')
      .replace(/<\\/ul>\\s*<ul>/g, '')
      .replace(/\\n\\n/g, '</p><p>')
      .replace(/\\n/g, '<br>');
  }

  function triggerExplain(type){
    if (graphPage) graphPage.classList.remove('panel-collapsed');
    if (explainPanel) explainPanel.classList.add('open');
    if (!explainBody) return;
    explainBody.innerHTML = '<div class="bw-explain-loading"><span>Thinking</span><span class="bw-explain-loading-dots"><span></span><span></span><span></span></span></div>';

    var payload = { type: type, nodeId: selected[0] ? selected[0].id : '' };
    if (type === 'edge' && selected[1]) payload.targetId = selected[1].id;

    fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(response){
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var fullText = '';
      explainBody.innerHTML = '<div class="bw-explain-content bw-explain-cursor"></div>';
      var contentEl = explainBody.querySelector('.bw-explain-content');

      function read(){
        reader.read().then(function(result){
          if (result.done) {
            if (contentEl) contentEl.classList.remove('bw-explain-cursor');
            return;
          }
          var chunk = decoder.decode(result.value, { stream: true });
          var lines = chunk.split('\\n');
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.startsWith('event: done')) {
              if (contentEl) contentEl.classList.remove('bw-explain-cursor');
              return;
            }
            if (line.startsWith('event: error')) {
              contentEl.innerHTML = '<p style="color:#ba0000;">Error generating explanation.</p>';
              return;
            }
            if (line.startsWith('data: ')) {
              try {
                var d = JSON.parse(line.slice(6));
                if (d.text) {
                  fullText += d.text;
                  contentEl.innerHTML = simpleMarkdown(fullText);
                  explainBody.scrollTop = explainBody.scrollHeight;
                }
              } catch(e) {}
            }
          }
          read();
        }).catch(function(err){
          contentEl.innerHTML += '<p style="color:#ba0000;">Stream error: ' + err.message + '</p>';
        });
      }
      read();
    }).catch(function(err){
      explainBody.innerHTML = '<p style="color:#ba0000;">Failed to connect: ' + err.message + '</p>';
    });
  }

  if (explainNodeBtn) explainNodeBtn.addEventListener('click', function(){ triggerExplain('node'); });
  if (explainEdgeBtn) explainEdgeBtn.addEventListener('click', function(){ triggerExplain('edge'); });
` : '';

    const clickHandler = opts.explainMode
      ? `node.on('click', function(event, d){
    event.stopPropagation();
    toggleSelect(d);
  });`
      : `node.on('click', function(event, d){
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
  });`;

    const escapeHandler = opts.explainMode
      ? `else if (e.key === 'Escape') {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      clearSelection();
      unpinAll();
    }`
      : `else if (e.key === 'Escape') {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      unpinAll();
    }`;

    const tooltipHint = opts.explainMode
      ? "click to select · dbl-click to open"
      : "click to pin · dbl-click to open";

    return `<script>
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
    adjacency[s].add(t);
    adjacency[t].add(s);
  });

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

  var link = g.append('g').attr('class', 'links').selectAll('line')
    .data(data.links).enter().append('line').attr('class', 'link');

  var topN = Math.min(7, Math.ceil(data.nodes.length * 0.35));
  var anchorIds = new Set(
    data.nodes.slice().sort(function(a, b){ return b.degree - a.degree; }).slice(0, topN).map(function(n){ return n.id; })
  );

  var node = g.append('g').attr('class', 'nodes').selectAll('g')
    .data(data.nodes).enter().append('g')
    .attr('class', function(d){ return 'node' + (anchorIds.has(d.id) ? ' anchor' : ''); });

  node.append('circle')
    .attr('class', 'atom')
    .attr('r', function(d){ return atomRadius(d); })
    .attr('fill', function(d){ return colors[d.category] || '#888888'; });

  node.append('circle')
    .attr('class', 'atom-ring')
    .attr('r', function(d){ return atomRadius(d) + 4; })
    .attr('fill', 'none');

  node.append('text')
    .attr('class', 'label')
    .attr('dy', function(d){ return atomRadius(d) + 15; })
    .text(function(d){ return d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label; });

  node.style('opacity', 0).transition().duration(800).delay(function(_,i){ return i * 30; }).style('opacity', 1);
  link.style('opacity', 0).transition().duration(600).delay(400).style('opacity', 1);

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
      if (!event.sourceEvent || !event.sourceEvent.shiftKey) {
        d.fx = null; d.fy = null;
      } else {
        d3.select(this).classed('pinned', true);
      }
    });
  node.call(drag);

  var zoomLevelEl = document.getElementById('bw-zoom-level');
  var zoom = d3.zoom()
    .scaleExtent([0.25, 5])
    .wheelDelta(function(event){
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

  function showTooltip(d, evt){
    tooltipEl.classList.add('visible');
    tooltipEl.style.setProperty('--tt-color', colors[d.category] || '#72777d');
    tooltipEl.innerHTML =
      '<div class="tt-cat">' + (catTitles[d.category] || d.category) + '</div>' +
      '<div class="tt-title">' + escapeHTML(d.label) + '</div>' +
      '<div class="tt-meta">' + d.degree + ' connections</div>' +
      '<div class="tt-hint">${tooltipHint}</div>';
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

  node.on('mouseenter', function(event, d){
    var connected = adjacency[d.id] || new Set([d.id]);
    node.classed('dim', function(n){ return !connected.has(n.id); });
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

  ${clickHandler}

  node.on('dblclick', function(event, d){
    event.stopPropagation();
    window.location.href = d.url;
  });

  svg.on('dblclick', function(){
    simulation.alpha(0.7).restart();
  });

  simulation.on('tick', function(){
    link.attr('x1', function(d){ return d.source.x; })
        .attr('y1', function(d){ return d.source.y; })
        .attr('x2', function(d){ return d.target.x; })
        .attr('y2', function(d){ return d.target.y; });
    node.attr('transform', function(d){ return 'translate(' + d.x + ',' + d.y + ')'; });
  });

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

  var mode = 'force';
  function applyMode(){
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

  document.addEventListener('keydown', function(e){
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === 'f' || e.key === 'F') { fitView(); }
    else if (e.key === '+' || e.key === '=') { zoomStep(1.4); }
    else if (e.key === '-' || e.key === '_') { zoomStep(0.7); }
    else if (e.key === '0') { zoomReset(); }
    ${escapeHandler}
  });

  window.addEventListener('resize', function(){
    width = container.clientWidth;
    height = container.clientHeight || 600;
    svg.attr('viewBox', '0 0 ' + width + ' ' + height);
    simulation.force('center', d3.forceCenter(width / 2, height / 2));
    simulation.alpha(0.3).restart();
  });

  ${explainBlock}
})();
</script>`;
  }

  function renderGraphPage(articles: Article[], manifest: Manifest): string {
    const graph = buildBacklinkGraph(articles);
    const byCategory: Record<string, Article[]> = {};
    for (const a of articles) {
      if (!byCategory[a.category]) byCategory[a.category] = [];
      byCategory[a.category].push(a);
    }

    const catColorMap: Record<string, string> = {};
    const catTitleMap: Record<string, string> = {};
    for (const c of config.categories) {
      catColorMap[c.id] = categoryColor(c.id);
      catTitleMap[c.id] = c.title;
    }

    const graphLegend = config.categories
      .filter((c) => (byCategory[c.id] ?? []).length > 0)
      .map(
        (c) =>
          `<span class="bw-legend-item"><span class="bw-legend-dot" style="background: ${categoryColor(c.id)}"></span>${escapeHtml(c.title)}</span>`
      )
      .join('');

    const graphScript = buildGraphScript(graph, catColorMap, catTitleMap, { explainMode: true });

    const body = `
      <div class="bw-graph-page">
        <div class="bw-graph-page-main">
          <div class="bw-graph-legend" id="bw-graph-legend">
            <span class="bw-legend-label">Article Connections</span>
            <span style="color: #a2a9b1;">|</span>
            ${graphLegend}
          </div>
          <div class="bw-graph-container" id="bw-graph-container">
            <svg id="bw-graph-svg"></svg>
            <div class="bw-graph-mini-search">
              <input type="search" id="bw-graph-search" placeholder="Search..." />
            </div>
            <div class="bw-graph-zoom">
              <button id="bw-zoom-out" title="Zoom out (-)">&#x2212;</button>
              <div class="bw-graph-zoom-level" id="bw-zoom-level">100%</div>
              <button id="bw-zoom-in" title="Zoom in (+)">&#xFF0B;</button>
              <button id="bw-zoom-reset" title="Reset (0)">&#x2299;</button>
            </div>
            <div class="bw-graph-explain-actions">
              <button id="bw-explain-node-btn" disabled>Explain selected</button>
              <button id="bw-explain-edge-btn" class="secondary" disabled>Explain connection</button>
            </div>
            <div class="bw-graph-mini-hint">
              <kbd>click</kbd> select · <kbd>dbl-click</kbd> open · <kbd>ctrl+scroll</kbd> zoom · <kbd>Esc</kbd> clear
            </div>
            <div class="bw-graph-tooltip" id="bw-graph-tooltip"></div>
          </div>
          <button class="bw-explain-toggle" id="bw-explain-toggle">Show Explain Panel</button>
        </div>
        <aside class="bw-explain-panel" id="bw-explain-panel">
          <div class="bw-explain-panel-header">
            <span>Explain</span>
            <button class="bw-explain-panel-close" id="bw-explain-close">&times;</button>
          </div>
          <div class="bw-explain-panel-body" id="bw-explain-body">
            <div class="bw-explain-empty">
              <div class="bw-explain-empty-icon">&#x1F50D;</div>
              <div>Select a node to explain an article,<br>or select two connected nodes to<br>explain their relationship.</div>
            </div>
          </div>
        </aside>
      </div>
    `;

    return htmlShell({
      title: 'Graph — Explain',
      projectName: config.projectName,
      categories: config.categories,
      body,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
      extraBodyEnd: graphScript,
      needsD3: true,
    });
  }

  function render3DGraphPage(articles: Article[], manifest: Manifest): string {
    const byCategory: Record<string, Article[]> = {};
    for (const a of articles) {
      if (!byCategory[a.category]) byCategory[a.category] = [];
      byCategory[a.category].push(a);
    }

    // Theme configuration - project-specific theming
    const theme = config.graph3d || {};
    const preset = theme.preset || 'tokyo-night';

    // Preset themes
    const presets: Record<string, any> = {
      'tokyo-night': {
        background: '#0a0612',
        backgroundGradient: ['#1a0a2e', '#0a0612'],
        worldLabel: 'Districts',
        nodeLabel: 'Spots',
        ambientColor: '#2a1a4a',
        accentColor: '#ff6b9d',
        particleColor: '#4fc3f7',
        glowIntensity: 0.4,
        starfield: true,
        fog: { color: '#1a0a2e', near: 400, far: 1200 },
      },
      'cosmos': {
        background: '#000011',
        backgroundGradient: ['#000022', '#000011'],
        worldLabel: 'Galaxies',
        nodeLabel: 'Stars',
        ambientColor: '#1a1a3a',
        accentColor: '#8b5cf6',
        particleColor: '#c4b5fd',
        glowIntensity: 0.5,
        starfield: true,
        fog: { color: '#000022', near: 500, far: 1500 },
      },
      'forest': {
        background: '#0a1a0a',
        backgroundGradient: ['#1a2a1a', '#0a1a0a'],
        worldLabel: 'Groves',
        nodeLabel: 'Trees',
        ambientColor: '#1a3a2a',
        accentColor: '#4ade80',
        particleColor: '#86efac',
        glowIntensity: 0.3,
        starfield: false,
        fog: { color: '#1a2a1a', near: 300, far: 800 },
      },
      'ocean': {
        background: '#0a1520',
        backgroundGradient: ['#0a2540', '#0a1520'],
        worldLabel: 'Reefs',
        nodeLabel: 'Creatures',
        ambientColor: '#1a3550',
        accentColor: '#22d3ee',
        particleColor: '#67e8f9',
        glowIntensity: 0.35,
        starfield: false,
        fog: { color: '#0a2540', near: 350, far: 1000 },
      },
      'minimal': {
        background: '#ffffff',
        backgroundGradient: ['#f8f9fa', '#ffffff'],
        worldLabel: 'Categories',
        nodeLabel: 'Articles',
        ambientColor: '#f0f0f0',
        accentColor: '#3366cc',
        particleColor: '#3366cc',
        glowIntensity: 0.1,
        starfield: false,
        fog: null,
      },
    };

    const activeTheme = { ...presets[preset], ...theme };
    const themeJson = JSON.stringify(activeTheme);

    // Build hierarchical graph data: categories as parent nodes, articles as children
    const catColorMap: Record<string, string> = {};
    const catTitleMap: Record<string, string> = {};
    for (const c of config.categories) {
      catColorMap[c.id] = categoryColor(c.id);
      catTitleMap[c.id] = c.title;
    }

    // Build nodes: category worlds + article nodes
    const nodes: any[] = [];
    const links: any[] = [];

    // Add category "world" nodes — locked to y=0 so worlds form a 2D-ish plane.
    // Articles still float in 3D around their parent world.
    const visibleCats = config.categories.filter((c) => (byCategory[c.id] ?? []).length > 0);
    visibleCats.forEach((c, i) => {
      const count = (byCategory[c.id] ?? []).length;
      // Seed positions in a wide ring on the XZ plane (initial layout) but DO NOT pin.
      // Soft Y-constraint in onEngineTick keeps worlds near y=0; charge forces let
      // them drift on the plane so the scene is alive instead of static.
      const angle = (i / visibleCats.length) * Math.PI * 2;
      const radius = 320 + visibleCats.length * 18;
      nodes.push({
        id: `cat:${c.id}`,
        label: c.title,
        type: 'category',
        category: c.id,
        color: categoryColor(c.id),
        size: 20 + Math.min(count * 3, 30),
        count,
        url: `/category/${c.id}`,
        x: Math.cos(angle) * radius,
        y: 0,
        z: Math.sin(angle) * radius,
      });
    });

    // Inter-world connector links — make the plane visible as a structural ring
    for (let i = 0; i < visibleCats.length; i++) {
      const a = visibleCats[i];
      const b = visibleCats[(i + 1) % visibleCats.length];
      links.push({
        source: `cat:${a.id}`,
        target: `cat:${b.id}`,
        type: 'world-grid',
      });
    }

    // Per-article variation that stays in the parent world's color family.
    // Tight hue shift (±12°) + wider sat/light variation so siblings feel like
    // shades of the same color (one world is "all the reds", another "all the blues")
    // instead of rainbow chaos within a world.
    function shiftHue(hex: string, slug: string): string {
      const m = hex.replace('#', '');
      const r = parseInt(m.slice(0, 2), 16) / 255;
      const g = parseInt(m.slice(2, 4), 16) / 255;
      const b = parseInt(m.slice(4, 6), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0; const lBase = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = lBase > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0));
        else if (max === g) h = (b - r) / d + 2;
        else                h = (r - g) / d + 4;
        h /= 6;
      }
      let h1 = 0, h2 = 0, h3 = 0;
      for (let i = 0; i < slug.length; i++) {
        h1 = ((h1 << 5) - h1) + slug.charCodeAt(i) | 0;
        h2 = ((h2 << 7) + h2 * 3 + slug.charCodeAt(i)) | 0;
        h3 = ((h3 << 3) - h3 + slug.charCodeAt(i) * 7) | 0;
      }
      h = (h + ((Math.abs(h1) % 24) - 12) / 360 + 1) % 1;
      s = Math.max(0.35, Math.min(1, s + ((Math.abs(h2) % 50) - 25) / 100));
      const l = Math.max(0.32, Math.min(0.78, lBase + ((Math.abs(h3) % 40) - 20) / 100));
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const rr = Math.round(hue2rgb(p, q, h + 1/3) * 255);
      const gg = Math.round(hue2rgb(p, q, h) * 255);
      const bb = Math.round(hue2rgb(p, q, h - 1/3) * 255);
      return '#' + [rr, gg, bb].map((v) => v.toString(16).padStart(2, '0')).join('');
    }

    // Add article nodes
    for (const a of articles) {
      const baseColor = catColorMap[a.category] || '#888';
      nodes.push({
        id: `art:${a.category}/${a.slug}`,
        label: a.title,
        type: 'article',
        category: a.category,
        color: shiftHue(baseColor, a.slug),
        size: 4 + Math.min(a.words / 200, 8),
        parent: `cat:${a.category}`,
        url: `/article/${a.category}/${a.slug}`,
        words: a.words,
        confidence: a.confidence,
      });
      // Link article to its category
      links.push({
        source: `cat:${a.category}`,
        target: `art:${a.category}/${a.slug}`,
        type: 'hierarchy',
      });
    }

    // Add article-to-article links based on wiki backlinks
    const seen = new Set<string>();
    for (const a of articles) {
      const sourceId = `art:${a.category}/${a.slug}`;
      const matches = a.body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
      for (const m of matches) {
        const target = m[1].trim().toLowerCase();
        const found = articles.find(
          (x) =>
            x.title.toLowerCase() === target ||
            x.slug.toLowerCase() === target ||
            x.title.toLowerCase().includes(target)
        );
        if (!found) continue;
        const targetId = `art:${found.category}/${found.slug}`;
        if (targetId === sourceId) continue;
        const key = [sourceId, targetId].sort().join('--');
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({
          source: sourceId,
          target: targetId,
          type: 'reference',
        });
      }
    }

    const graphData = JSON.stringify({ nodes, links });
    const colorsJson = JSON.stringify(catColorMap);
    const titlesJson = JSON.stringify(catTitleMap);
    // themeJson already defined above

    // Build legend HTML
    const legendItems = config.categories
      .filter((c) => (byCategory[c.id] ?? []).length > 0)
      .map((c) => {
        const count = (byCategory[c.id] ?? []).length;
        return `<div class="bw-3d-legend-item" data-category="${c.id}">
          <div class="bw-3d-legend-dot" style="background: ${categoryColor(c.id)}; color: ${categoryColor(c.id)};"></div>
          <span class="bw-3d-legend-label">${escapeHtml(c.title)}</span>
          <span class="bw-3d-legend-count">${count}</span>
        </div>`;
      })
      .join('');

    const graph3DScript = `<script>
(function(){
  var data = ${graphData};
  var colors = ${colorsJson};
  var titles = ${titlesJson};
  var theme = ${themeJson};
  var container = document.getElementById('bw-3d-graph');
  var tooltip = document.getElementById('bw-3d-tooltip');
  var breadcrumb = document.getElementById('bw-3d-breadcrumb');
  var searchInput = document.getElementById('bw-3d-search-input');

  if (!container || typeof ForceGraph3D === 'undefined') {
    console.error('3D Graph dependencies not loaded');
    return;
  }

  // Remove loading
  var loading = document.querySelector('.bw-3d-loading');
  if (loading) loading.style.display = 'none';

  // Current focus state
  var currentFocus = null; // null = overview, 'cat:xxx' = focused on category
  var focusedNodes = null;

  // Scene-level animated effects — each entry is an animate(time) function.
  // Returning 'remove' from an animate function signals the loop to drop it.
  var sceneEffects = [];

  // TWINKLING colored starfield — 5000 stars, mostly white with palette sprinkles
  function createStarfield(scene) {
    if (!theme.starfield) return;
    var starsGeometry = new THREE.BufferGeometry();
    var starCount = 5000;
    var positions = new Float32Array(starCount * 3);
    var colors = new Float32Array(starCount * 3);
    var palette = [
      new THREE.Color('#ffffff'), new THREE.Color('#ffffff'), new THREE.Color('#ffffff'),
      new THREE.Color('#ffffff'), new THREE.Color('#ffffff'), new THREE.Color('#ffffff'),
      new THREE.Color(theme.accentColor || '#ff6b9d'),
      new THREE.Color(theme.particleColor || '#4fc3f7'),
      new THREE.Color('#fbbf24'), new THREE.Color('#a78bfa'),
    ];
    for (var i = 0; i < starCount; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 5000;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 5000;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5000;
      var c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    var starsMaterial = new THREE.PointsMaterial({
      vertexColors: true, size: 2.0, transparent: true, opacity: 0.85, sizeAttenuation: true,
    });
    var stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
    sceneEffects.push(function(t) {
      starsMaterial.opacity = 0.65 + Math.sin(t * 0.001) * 0.2;
      stars.rotation.y = t * 0.000025;
    });
  }

  // SHOOTING STARS — periodic bright streaks across the sky
  function createShootingStars(scene) {
    var active = [];
    var lastSpawn = 0;
    sceneEffects.push(function(t) {
      if (t - lastSpawn > 1800 + Math.random() * 2200) {
        lastSpawn = t;
        var startTheta = Math.random() * Math.PI * 2;
        var startPhi = Math.PI / 4 + Math.random() * Math.PI / 2;
        var R = 2200;
        var start = new THREE.Vector3(
          Math.sin(startPhi) * Math.cos(startTheta) * R,
          Math.cos(startPhi) * R + 200,
          Math.sin(startPhi) * Math.sin(startTheta) * R
        );
        var dir = new THREE.Vector3(
          (Math.random() - 0.5) * 1.4, -0.6 - Math.random() * 0.4, (Math.random() - 0.5) * 1.4
        ).normalize().multiplyScalar(950);
        var pal = ['#ffffff', theme.accentColor || '#ff6b9d', theme.particleColor || '#4fc3f7', '#fbbf24'];
        var col = pal[Math.floor(Math.random() * pal.length)];
        var pts = [start.clone(), start.clone()];
        var geo = new THREE.BufferGeometry().setFromPoints(pts);
        var mat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 1 });
        var line = new THREE.Line(geo, mat);
        scene.add(line);
        active.push({ line: line, start: start, dir: dir, born: t, life: 1400 });
      }
      for (var i = active.length - 1; i >= 0; i--) {
        var s = active[i];
        var age = (t - s.born) / s.life;
        if (age >= 1) {
          scene.remove(s.line);
          s.line.geometry.dispose(); s.line.material.dispose();
          active.splice(i, 1);
          continue;
        }
        var pos = s.start.clone().add(s.dir.clone().multiplyScalar(age));
        var tail = pos.clone().add(s.dir.clone().normalize().multiplyScalar(-(80 + age * 80)));
        s.line.geometry.setFromPoints([pos, tail]);
        s.line.material.opacity = 1 - age * age;
      }
    });
  }

  // SONAR PULSES — every ~1-2s a random world emits an expanding ring on the plane
  function createSonarPulses(scene) {
    var active = [];
    var lastSpawn = 0;
    sceneEffects.push(function(t) {
      if (t - lastSpawn > 1100 + Math.random() * 800) {
        lastSpawn = t;
        var cats = data.nodes.filter(function(n) { return n.type === 'category'; });
        if (cats.length === 0) return;
        var src = cats[Math.floor(Math.random() * cats.length)];
        var geo = new THREE.RingGeometry(8, 9, 64);
        var mat = new THREE.MeshBasicMaterial({
          color: src.color, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false,
        });
        var ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(src.x || 0, -100, src.z || 0);
        scene.add(ring);
        active.push({ ring: ring, born: t, life: 2400 });
      }
      for (var i = active.length - 1; i >= 0; i--) {
        var p = active[i];
        var age = (t - p.born) / p.life;
        if (age >= 1) {
          scene.remove(p.ring);
          p.ring.geometry.dispose(); p.ring.material.dispose();
          active.splice(i, 1);
          continue;
        }
        var radius = 8 + age * 280;
        p.ring.geometry.dispose();
        p.ring.geometry = new THREE.RingGeometry(radius, radius + 1.5, 64);
        p.ring.material.opacity = (1 - age) * 0.85;
      }
    });
  }

  // AURORA SKY RIBBONS — 4 curved planes drifting in the upper hemisphere
  function createAurora(scene) {
    var ribbons = [];
    var palette = [theme.accentColor || '#ff6b9d', theme.particleColor || '#4fc3f7', '#a78bfa', '#34d399'];
    for (var i = 0; i < 4; i++) {
      var canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 64;
      var ctx = canvas.getContext('2d');
      var grad = ctx.createLinearGradient(0, 0, 512, 0);
      grad.addColorStop(0,   palette[i] + '00');
      grad.addColorStop(0.4, palette[i] + '88');
      grad.addColorStop(0.6, palette[i] + '88');
      grad.addColorStop(1,   palette[i] + '00');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 64);
      var tex = new THREE.CanvasTexture(canvas);
      var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
      var w = 2400, h = 220;
      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 32, 1), mat);
      var pos = mesh.geometry.attributes.position;
      for (var v = 0; v < pos.count; v++) {
        var x = pos.getX(v);
        pos.setZ(v, -Math.cos((x / w) * Math.PI) * 180);
      }
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.position.y = 700 + i * 80;
      mesh.rotation.y = (i / 4) * Math.PI * 2;
      mesh.userData = { baseRotY: mesh.rotation.y, basePhase: i * 1.3 };
      ribbons.push(mesh);
      scene.add(mesh);
    }
    sceneEffects.push(function(t) {
      ribbons.forEach(function(r, i) {
        r.rotation.y = r.userData.baseRotY + t * 0.00008 * (i % 2 === 0 ? 1 : -1);
        r.material.opacity = 0.25 + (Math.sin(t * 0.0006 + r.userData.basePhase) + 1) * 0.15;
      });
    });
  }

  // DUST MOTES — 800 slow-drifting points in mid-space with wrap-around bounds
  function createDustMotes(scene) {
    var count = 800;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    var velocities = [];
    for (var i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 1800;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 600 + 100;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1800;
      velocities.push({
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.05,
        vz: (Math.random() - 0.5) * 0.15,
      });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: theme.particleColor || '#4fc3f7',
      size: 1.2, transparent: true, opacity: 0.4, sizeAttenuation: true, depthWrite: false,
    });
    var motes = new THREE.Points(geo, mat);
    scene.add(motes);
    sceneEffects.push(function(t) {
      var p = motes.geometry.attributes.position;
      for (var i = 0; i < count; i++) {
        var v = velocities[i];
        var x = p.getX(i) + v.vx;
        var y = p.getY(i) + v.vy;
        var z = p.getZ(i) + v.vz;
        if (x > 900) x = -900; if (x < -900) x = 900;
        if (y > 700) y = -100; if (y < -200) y = 700;
        if (z > 900) z = -900; if (z < -900) z = 900;
        p.setXYZ(i, x, y, z);
      }
      p.needsUpdate = true;
      mat.opacity = 0.3 + Math.sin(t * 0.0005) * 0.12;
    });
  }

  // CLICK BURST — particle explosion when a world is clicked. Exposed globally.
  function createClickBurst(scene, position, color) {
    var count = 50;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    var vels = [];
    for (var i = 0; i < count; i++) {
      pos[i * 3] = position.x; pos[i * 3 + 1] = position.y; pos[i * 3 + 2] = position.z;
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      var speed = 4 + Math.random() * 7;
      vels.push({
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.cos(phi) * speed,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
      });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: color, size: 5, transparent: true, opacity: 1, sizeAttenuation: true, depthWrite: false,
    });
    var burst = new THREE.Points(geo, mat);
    scene.add(burst);
    var born = performance.now();
    var life = 1100;
    sceneEffects.push(function(t) {
      var age = (t - born) / life;
      if (age >= 1) {
        scene.remove(burst);
        burst.geometry.dispose(); burst.material.dispose();
        return 'remove';
      }
      var p = burst.geometry.attributes.position;
      for (var i = 0; i < count; i++) {
        var v = vels[i];
        v.vy -= 0.06;
        p.setXYZ(i, p.getX(i) + v.vx, p.getY(i) + v.vy, p.getZ(i) + v.vz);
      }
      p.needsUpdate = true;
      mat.opacity = 1 - age;
      mat.size = 5 + age * 7;
    });
  }
  window.bw3dClickBurst = function(node) {
    if (!node || node.x == null) return;
    createClickBurst(scene, { x: node.x, y: node.y, z: node.z }, node.color);
  };

  // ============================================================
  // Per-category WORLD VISUALS — each category gets a unique form.
  // Each builder returns { group, animate(time) }.
  // ============================================================

  function buildOverviewWorld(node, theme) {
    var g = new THREE.Group(), s = node.size;
    var crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(s * 0.95, 0),
      new THREE.MeshPhongMaterial({ color: node.color, emissive: node.color, emissiveIntensity: 0.55, transparent: true, opacity: 0.92, flatShading: true })
    );
    g.add(crystal);
    var beams = [];
    for (var i = 0; i < 4; i++) {
      var beam = new THREE.Mesh(
        new THREE.ConeGeometry(s * 0.10, s * 1.6, 4),
        new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.55 })
      );
      var ang = (i * Math.PI) / 2;
      beam.rotation.z = -Math.PI / 2;
      beam.position.set(Math.cos(ang) * s * 0.9, 0, Math.sin(ang) * s * 0.9);
      beam.lookAt(Math.cos(ang) * s * 2, 0, Math.sin(ang) * s * 2);
      beams.push(beam);
      g.add(beam);
    }
    var halo = new THREE.Mesh(
      new THREE.TorusGeometry(s * 1.5, 0.35, 8, 64),
      new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.7 })
    );
    halo.rotation.x = Math.PI / 2;
    g.add(halo);
    return { group: g, animate: function(t) {
      crystal.rotation.y = t * 0.0006; crystal.rotation.x = t * 0.0003;
      halo.rotation.z = t * 0.0004;
      crystal.scale.setScalar(1 + Math.sin(t * 0.0015) * 0.10);
      beams.forEach(function(b, i) { b.material.opacity = 0.35 + Math.sin(t * 0.002 + i) * 0.25; });
    }};
  }

  function buildProductWorld(node, theme) {
    var g = new THREE.Group(), s = node.size;
    var plate = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 1.2, s * 1.35, s * 0.18, 32),
      new THREE.MeshPhongMaterial({ color: node.color, emissive: node.color, emissiveIntensity: 0.22, transparent: true, opacity: 0.8 })
    );
    plate.position.y = -s * 0.4;
    g.add(plate);
    var center = new THREE.Mesh(
      new THREE.SphereGeometry(s * 0.55, 32, 32),
      new THREE.MeshPhongMaterial({ color: node.color, emissive: node.color, emissiveIntensity: 0.45, transparent: true, opacity: 0.95 })
    );
    g.add(center);
    var dishes = [];
    for (var i = 0; i < 6; i++) {
      var d = new THREE.Mesh(
        new THREE.BoxGeometry(s * 0.22, s * 0.22, s * 0.22),
        new THREE.MeshPhongMaterial({ color: theme.particleColor || '#4fc3f7', emissive: theme.particleColor || '#4fc3f7', emissiveIntensity: 0.4, transparent: true, opacity: 0.9 })
      );
      d.userData = { angle: (i / 6) * Math.PI * 2, radius: s * 1.35, phase: i * 1.1 };
      dishes.push(d); g.add(d);
    }
    return { group: g, animate: function(t) {
      dishes.forEach(function(d) {
        var a = d.userData.angle + t * 0.0009;
        d.position.x = Math.cos(a) * d.userData.radius;
        d.position.z = Math.sin(a) * d.userData.radius;
        d.position.y = Math.sin(t * 0.0022 + d.userData.phase) * s * 0.3;
        d.rotation.y = t * 0.002; d.rotation.x = t * 0.0015;
      });
      center.rotation.y = t * 0.0004;
      center.scale.setScalar(1 + Math.sin(t * 0.0018) * 0.06);
    }};
  }

  function buildArchitectureWorld(node, theme) {
    var g = new THREE.Group(), s = node.size;
    var cage = new THREE.Mesh(
      new THREE.BoxGeometry(s * 1.7, s * 1.7, s * 1.7),
      new THREE.MeshBasicMaterial({ color: node.color, wireframe: true, transparent: true, opacity: 0.7 })
    );
    g.add(cage);
    var cage2 = new THREE.Mesh(
      new THREE.BoxGeometry(s * 1.1, s * 1.1, s * 1.1),
      new THREE.MeshBasicMaterial({ color: theme.particleColor || '#4fc3f7', wireframe: true, transparent: true, opacity: 0.5 })
    );
    g.add(cage2);
    var core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(s * 0.55, 0),
      new THREE.MeshPhongMaterial({ color: node.color, emissive: node.color, emissiveIntensity: 0.55, flatShading: true, transparent: true, opacity: 0.95 })
    );
    g.add(core);
    var strutMat = new THREE.LineBasicMaterial({ color: node.color, transparent: true, opacity: 0.5 });
    var L = s * 1.05;
    [[[-L,0,0],[L,0,0]],[[0,-L,0],[0,L,0]],[[0,0,-L],[0,0,L]]].forEach(function(p) {
      var geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p[0][0], p[0][1], p[0][2]),
        new THREE.Vector3(p[1][0], p[1][1], p[1][2])
      ]);
      g.add(new THREE.Line(geo, strutMat));
    });
    return { group: g, animate: function(t) {
      cage.rotation.y = t * 0.0004; cage.rotation.x = t * 0.0002;
      cage2.rotation.y = -t * 0.0008; cage2.rotation.z = t * 0.0006;
      core.rotation.y = -t * 0.0006;
    }};
  }

  function buildDesignWorld(node, theme) {
    var g = new THREE.Group(), s = node.size;
    var swatches = [];
    var palette = [node.color, theme.accentColor || '#ff6b9d', theme.particleColor || '#4fc3f7', node.color, '#fbbf24'];
    for (var i = 0; i < 5; i++) {
      var sw = new THREE.Mesh(
        new THREE.PlaneGeometry(s * 1.6, s * 0.42),
        new THREE.MeshBasicMaterial({ color: palette[i], side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
      );
      sw.position.y = (i - 2) * s * 0.34;
      sw.rotation.z = (i - 2) * 0.12;
      sw.userData = { baseY: sw.position.y, phase: i * 0.7 };
      swatches.push(sw); g.add(sw);
    }
    var spark = new THREE.Mesh(
      new THREE.SphereGeometry(s * 0.4, 24, 24),
      new THREE.MeshPhongMaterial({ color: '#ffffff', emissive: node.color, emissiveIntensity: 0.7, transparent: true, opacity: 0.95 })
    );
    g.add(spark);
    return { group: g, animate: function(t) {
      swatches.forEach(function(sw) {
        sw.rotation.y = t * 0.0004 + sw.userData.phase;
        sw.position.y = sw.userData.baseY + Math.sin(t * 0.0018 + sw.userData.phase) * s * 0.08;
      });
      g.rotation.y = t * 0.0002;
      spark.scale.setScalar(1 + Math.sin(t * 0.003) * 0.18);
    }};
  }

  function buildOperationsWorld(node, theme) {
    var g = new THREE.Group(), s = node.size;
    var rings = [];
    for (var i = 0; i < 4; i++) {
      var r = new THREE.Mesh(
        new THREE.TorusGeometry(s * (0.6 + i * 0.22), 0.65, 8, 32),
        new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.75 })
      );
      r.position.y = (i - 1.5) * s * 0.32;
      r.rotation.x = Math.PI / 2;
      rings.push(r); g.add(r);
    }
    var dots = [];
    for (var j = 0; j < 10; j++) {
      var dot = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.09, 8, 8),
        new THREE.MeshBasicMaterial({ color: theme.particleColor || '#4fc3f7', transparent: true, opacity: 0.9 })
      );
      dot.userData = { phase: j * 0.45, angle: (j / 10) * Math.PI * 2 };
      dots.push(dot); g.add(dot);
    }
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.1, s * 0.1, s * 1.6, 8),
      new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.4 })
    );
    g.add(trunk);
    return { group: g, animate: function(t) {
      rings.forEach(function(r, i) { r.rotation.z = t * 0.0006 * (i % 2 === 0 ? 1 : -1); });
      dots.forEach(function(d) {
        var a = d.userData.angle + t * 0.0016;
        d.position.x = Math.cos(a) * s * 0.95;
        d.position.z = Math.sin(a) * s * 0.95;
        d.position.y = Math.sin(t * 0.004 + d.userData.phase) * s * 0.6;
        d.material.opacity = 0.35 + (Math.sin(t * 0.005 + d.userData.phase) + 1) * 0.32;
      });
    }};
  }

  function buildHistoryWorld(node, theme) {
    var g = new THREE.Group(), s = node.size;
    var pts1 = [], pts2 = [];
    var turns = 4, h = (s * 1.8) / 80;
    for (var i = 0; i <= 80; i++) {
      var th = (i / 80) * turns * Math.PI * 2;
      pts1.push(new THREE.Vector3(Math.cos(th) * s * 0.85, -s * 0.9 + i * h, Math.sin(th) * s * 0.85));
      pts2.push(new THREE.Vector3(Math.cos(th + Math.PI) * s * 0.85, -s * 0.9 + i * h, Math.sin(th + Math.PI) * s * 0.85));
    }
    var c1 = new THREE.CatmullRomCurve3(pts1);
    var c2 = new THREE.CatmullRomCurve3(pts2);
    var sMat = new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.75 });
    var spiral1 = new THREE.Mesh(new THREE.TubeGeometry(c1, 80, 0.45, 6, false), sMat);
    var spiral2 = new THREE.Mesh(new THREE.TubeGeometry(c2, 80, 0.45, 6, false), sMat);
    g.add(spiral1); g.add(spiral2);
    var disk = new THREE.Mesh(
      new THREE.CircleGeometry(s * 0.45, 32),
      new THREE.MeshPhongMaterial({ color: node.color, emissive: node.color, emissiveIntensity: 0.55, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    g.add(disk);
    return { group: g, animate: function(t) {
      g.rotation.y = t * 0.0003;
      disk.rotation.z = -t * 0.0008;
      spiral1.material.opacity = 0.5 + Math.sin(t * 0.0015) * 0.25;
    }};
  }

  function buildDefaultWorld(node, theme) {
    var g = new THREE.Group(), s = node.size;
    var core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(s * 0.85, 1),
      new THREE.MeshPhongMaterial({ color: node.color, emissive: node.color, emissiveIntensity: 0.5, flatShading: true, transparent: true, opacity: 0.9 })
    );
    g.add(core);
    var shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(s * 1.1, 1),
      new THREE.MeshBasicMaterial({ color: node.color, wireframe: true, transparent: true, opacity: 0.5 })
    );
    g.add(shell);
    var orbit = new THREE.Mesh(
      new THREE.TorusGeometry(s * 1.5, 0.55, 8, 64),
      new THREE.MeshBasicMaterial({ color: theme.particleColor || '#4fc3f7', transparent: true, opacity: 0.7 })
    );
    orbit.rotation.x = Math.PI / 3;
    g.add(orbit);
    return { group: g, animate: function(t) {
      core.rotation.y = t * 0.0005;
      shell.rotation.y = t * 0.0003; shell.rotation.x = t * 0.0002;
      orbit.rotation.z = t * 0.0006;
    }};
  }

  function buildWorldVisual(node, theme) {
    switch (node.category) {
      case '01-overview':     return buildOverviewWorld(node, theme);
      case '01-brand':        return buildOverviewWorld(node, theme);
      case '02-product':      return buildProductWorld(node, theme);
      case '03-architecture': return buildArchitectureWorld(node, theme);
      case '03-medical':      return buildArchitectureWorld(node, theme);
      case '04-design':       return buildDesignWorld(node, theme);
      case '05-architecture': return buildArchitectureWorld(node, theme);
      case '05-operations':   return buildOperationsWorld(node, theme);
      case '06-content':      return buildDesignWorld(node, theme);
      case '06-history':      return buildHistoryWorld(node, theme);
      case '07-operations':   return buildOperationsWorld(node, theme);
      case '08-history':      return buildHistoryWorld(node, theme);
      default:                return buildDefaultWorld(node, theme);
    }
  }

  // Create the 3D force graph
  var Graph = ForceGraph3D()(container)
    .backgroundColor(theme.background || '#0a0a0f')
    .showNavInfo(false)
    .nodeLabel(null) // We'll use custom tooltip
    .nodeColor(function(node) {
      if (focusedNodes && !focusedNodes.has(node.id)) {
        return 'rgba(60, 60, 80, 0.3)';
      }
      return node.color;
    })
    .nodeOpacity(function(node) {
      if (node.type === 'category') return 0.9;
      if (focusedNodes && !focusedNodes.has(node.id)) return 0.15;
      return 0.85;
    })
    .nodeVal(function(node) {
      return node.size * node.size;
    })
    .nodeThreeObject(function(node) {
      if (node.type === 'category') {
        // Per-category Disney visual — each world looks unique to its content.
        var group = new THREE.Group();

        var built = buildWorldVisual(node, theme);
        group.add(built.group);

        // Subtle disc base under every world — gives anchor without locking the look
        var disc = new THREE.Mesh(
          new THREE.CylinderGeometry(node.size * 1.5, node.size * 1.65, 1.5, 32),
          new THREE.MeshPhongMaterial({ color: node.color, emissive: node.color, emissiveIntensity: 0.25, transparent: true, opacity: 0.55 })
        );
        disc.position.y = -node.size - 8;
        group.add(disc);

        // Outer halo ring at base (so worlds visibly sit ON the plane)
        var baseHalo = new THREE.Mesh(
          new THREE.TorusGeometry(node.size * 1.6, 0.7, 8, 64),
          new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.85 })
        );
        baseHalo.rotation.x = Math.PI / 2;
        baseHalo.position.y = -node.size - 7;
        group.add(baseHalo);

        // Label billboard
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        canvas.width = 512; canvas.height = 128;
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 512, 128);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.roundRect(20, 30, 472, 68, 34);
        ctx.fill();
        ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label.slice(0, 24), 256, 64);
        ctx.font = 'bold 20px -apple-system, sans-serif';
        ctx.fillStyle = node.color;
        ctx.fillText(node.count + ' ' + (theme.nodeLabel || 'articles'), 256, 100);
        var texture = new THREE.CanvasTexture(canvas);
        var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
        sprite.scale.set(80, 20, 1);
        sprite.position.y = node.size + 35;
        group.add(sprite);

        // Floating bob + pulse on top of the per-category animate
        group.userData.bobOffset = Math.random() * Math.PI * 2;
        group.userData.animate = function(time) {
          built.animate(time);
          // Whole-world bob (gentle vertical float)
          group.position.y = Math.sin(time * 0.0008 + group.userData.bobOffset) * 6;
          // Halo pulse
          baseHalo.material.opacity = 0.65 + Math.sin(time * 0.0015 + group.userData.bobOffset) * 0.2;
        };

        return group;
      } else {
        // Article nodes: glowing orbs with subtle pulsing
        var group = new THREE.Group();

        var dim = focusedNodes && !focusedNodes.has(node.id);

        // Core sphere
        var geometry = new THREE.SphereGeometry(node.size, 24, 24);
        var material = new THREE.MeshPhongMaterial({
          color: node.color,
          transparent: true,
          opacity: dim ? 0.1 : 0.85,
          emissive: node.color,
          emissiveIntensity: dim ? 0.05 : 0.25,
        });
        var sphere = new THREE.Mesh(geometry, material);
        group.add(sphere);

        // Outer glow (only when not dimmed)
        if (!dim) {
          var glowGeometry = new THREE.SphereGeometry(node.size * 1.3, 16, 16);
          var glowMaterial = new THREE.MeshBasicMaterial({
            color: node.color,
            transparent: true,
            opacity: 0.35,
          });
          var glow = new THREE.Mesh(glowGeometry, glowMaterial);
          group.add(glow);
        }

        return group;
      }
    })
    .linkColor(function(link) {
      if (link.type === 'world-grid') {
        return 'rgba(255, 107, 157, 0.55)';
      }
      if (link.type === 'hierarchy') {
        return 'rgba(160, 160, 200, 0.45)';
      }
      return 'rgba(79, 195, 247, 0.7)';
    })
    .linkWidth(function(link) {
      if (link.type === 'world-grid') return 2.5;
      return link.type === 'reference' ? 1.5 : 0.7;
    })
    .linkOpacity(0.85)
    .linkDirectionalParticles(function(link) {
      return link.type === 'reference' ? 2 : 0;
    })
    .linkDirectionalParticleSpeed(0.005)
    .linkDirectionalParticleWidth(2)
    .linkDirectionalParticleColor(function() { return '#4fc3f7'; })
    .d3Force('charge', d3.forceManyBody().strength(function(node) {
      return node.type === 'category' ? -800 : -80;
    }))
    .d3Force('link', d3.forceLink().distance(function(link) {
      if (link.type === 'world-grid') return 500;
      return link.type === 'hierarchy' ? 110 : 160;
    }).strength(function(link) {
      if (link.type === 'world-grid') return 0.05;
      return link.type === 'hierarchy' ? 0.8 : 0.3;
    }))
    .d3Force('center', d3.forceCenter())
    .onNodeHover(function(node) {
      container.style.cursor = node ? 'pointer' : 'grab';
      if (!node) {
        tooltip.classList.remove('visible');
        return;
      }
      tooltip.classList.add('visible');
      tooltip.style.setProperty('--tt-color', node.color);

      var catName = titles[node.category] || node.category;
      var meta = '';
      if (node.type === 'category') {
        meta = node.count + ' articles';
      } else {
        meta = (node.words || 0).toLocaleString() + ' words · ' + (node.confidence || 'medium') + ' confidence';
      }

      tooltip.innerHTML =
        '<div class="bw-3d-tooltip-category" style="color: ' + node.color + '">' +
          (node.type === 'category' ? 'WORLD' : catName.toUpperCase()) +
        '</div>' +
        '<div class="bw-3d-tooltip-title">' + escapeHTML(node.label) + '</div>' +
        '<div class="bw-3d-tooltip-meta">' + meta + '</div>' +
        '<div class="bw-3d-tooltip-hint">' +
          (node.type === 'category' ? 'Click to enter world · Double-click to view category' : 'Click to highlight · Double-click to open article') +
        '</div>';
    })
    .onNodeClick(function(node) {
      // Particle burst at the click point — pure satisfying feedback
      if (window.bw3dClickBurst) window.bw3dClickBurst(node);
      if (node.type === 'category') {
        focusOnCategory(node.category);
      } else {
        highlightArticle(node);
      }
    })
    .onNodeDragEnd(function(node) {
      node.fx = node.x;
      node.fy = node.y;
      node.fz = node.z;
    })
    .onBackgroundClick(function() {
      // Reset view
      resetFocus();
    });

  // Add data
  Graph.graphData(data);

  // Setup scene with theme
  var scene = Graph.scene();
  var renderer = Graph.renderer();
  var camera = Graph.camera();

  // ALL THE CRAZY EFFECTS — invoke each scene-level builder
  createStarfield(scene);
  createShootingStars(scene);
  createSonarPulses(scene);
  createAurora(scene);
  createDustMotes(scene);

  // Add fog for depth
  if (theme.fog) {
    scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far);
  }

  // Add ambient light matching theme
  var ambientColor = theme.ambientColor ? parseInt(theme.ambientColor.replace('#', ''), 16) : 0x404040;
  scene.add(new THREE.AmbientLight(ambientColor, 1.5));

  // Add directional lights for better depth
  var dirLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight1.position.set(100, 200, 100);
  scene.add(dirLight1);

  var dirLight2 = new THREE.DirectionalLight(0x8888ff, 0.3);
  dirLight2.position.set(-100, -100, -100);
  scene.add(dirLight2);

  // Add point lights at category positions for glow effect
  var categoryLights = [];
  data.nodes.filter(function(n) { return n.type === 'category'; }).forEach(function(n) {
    var light = new THREE.PointLight(n.color, theme.glowIntensity || 0.3, 300);
    categoryLights.push({ node: n, light: light });
    scene.add(light);
  });

  // Update category light positions on simulation tick
  Graph.onEngineTick(function() {
    // Sync per-world point lights to their drifting positions
    categoryLights.forEach(function(cl) {
      if (cl.node.x !== undefined) {
        cl.light.position.set(cl.node.x, cl.node.y, cl.node.z);
      }
    });
    // Soft Y-constraint — gently pull worlds back toward the y=0 plane
    // (worlds can drift on the plane via charge forces, but never escape it)
    data.nodes.forEach(function(n) {
      if (n.type === 'category' && typeof n.y === 'number') {
        n.vy = (n.vy || 0) - n.y * 0.08;
        n.vy *= 0.85;
      }
      // Articles: gentle tangential drift around their parent world (slow orbit)
      if (n.type === 'article' && n.parent) {
        var parent = data.nodes.find(function(p){ return p.id === n.parent; });
        if (parent && typeof n.x === 'number' && typeof n.z === 'number') {
          var dx = n.x - parent.x, dz = n.z - parent.z;
          // Tangent vector (perpendicular to radial)
          n.vx = (n.vx || 0) - dz * 0.0008;
          n.vz = (n.vz || 0) + dx * 0.0008;
        }
      }
    });
  });

  // Camera initial position — pulled back so the whole plane is visible at boot
  setTimeout(function() {
    Graph.cameraPosition({ x: 0, y: 600, z: 1600 }, { x: 0, y: 0, z: 0 }, 0);
  }, 100);

  // Zoom controls — wide range so users can fly all the way out and back in
  var controls = Graph.controls();
  controls.minDistance = 30;
  controls.maxDistance = 8000;
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 1.4;

  // Camera auto-orbit when idle — slow rotation around origin after 6s of inactivity.
  // Pauses instantly on any user interaction, resumes after idle period.
  var lastInteractionTime = Date.now();
  var IDLE_DELAY_MS = 6000;
  var ORBIT_SPEED = 0.00018;
  ['pointerdown','wheel','touchstart','keydown'].forEach(function(evt) {
    container.addEventListener(evt, function(){ lastInteractionTime = Date.now(); }, { passive: true });
  });
  if (controls.addEventListener) {
    controls.addEventListener('start', function(){ lastInteractionTime = Date.now(); });
  }
  function autoOrbit() {
    if (Date.now() - lastInteractionTime > IDLE_DELAY_MS) {
      var pos = camera.position;
      var radius = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      var angle = Math.atan2(pos.z, pos.x) + ORBIT_SPEED;
      camera.position.x = Math.cos(angle) * radius;
      camera.position.z = Math.sin(angle) * radius;
      camera.lookAt(0, 0, 0);
    }
    requestAnimationFrame(autoOrbit);
  }
  autoOrbit();

  // Subtle ground grid — small, dim, monochrome. Just enough to suggest a plane,
  // not so much it competes with the worlds for attention.
  var gridSize = 2400;
  var gridDivisions = 24;
  var gridColor = new THREE.Color(theme.accentColor || '#ff6b9d').multiplyScalar(0.55).getHex();
  var grid = new THREE.GridHelper(gridSize, gridDivisions, gridColor, gridColor);
  grid.position.y = -110;
  if (grid.material) {
    if (Array.isArray(grid.material)) {
      grid.material.forEach(function(m){ m.transparent = true; m.opacity = 0.07; m.depthWrite = false; });
    } else {
      grid.material.transparent = true;
      grid.material.opacity = 0.07;
      grid.material.depthWrite = false;
    }
  }
  scene.add(grid);

  // Soft radial gradient floor — fades from accent at center to transparent at edge.
  // Uses a CanvasTexture for a smooth gradient (avoids the harsh ring edge).
  var floorCanvas = document.createElement('canvas');
  floorCanvas.width = 1024; floorCanvas.height = 1024;
  var fctx = floorCanvas.getContext('2d');
  var grad = fctx.createRadialGradient(512, 512, 50, 512, 512, 512);
  var floorColor = theme.accentColor || '#ff6b9d';
  grad.addColorStop(0,    floorColor + '22');
  grad.addColorStop(0.55, floorColor + '0d');
  grad.addColorStop(1,    floorColor + '00');
  fctx.fillStyle = grad;
  fctx.fillRect(0, 0, 1024, 1024);
  var floorTex = new THREE.CanvasTexture(floorCanvas);
  var floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -108;
  scene.add(floorMesh);

  // Helper functions
  function escapeHTML(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function focusOnCategory(catId) {
    currentFocus = 'cat:' + catId;
    var catNode = data.nodes.find(function(n) { return n.id === currentFocus; });
    if (!catNode) return;

    // Get all nodes in this category
    focusedNodes = new Set([currentFocus]);
    data.nodes.forEach(function(n) {
      if (n.category === catId) focusedNodes.add(n.id);
    });

    // Update breadcrumb
    breadcrumb.innerHTML =
      '<span class="bw-3d-breadcrumb-item" onclick="window.bw3dReset()">Universe</span>' +
      '<span class="bw-3d-breadcrumb-sep">→</span>' +
      '<span class="bw-3d-breadcrumb-current">' + escapeHTML(titles[catId] || catId) + '</span>';

    // Fly to category
    var distance = 200;
    var pos = { x: catNode.x || 0, y: catNode.y || 0, z: (catNode.z || 0) + distance };
    Graph.cameraPosition(pos, catNode, 1000);

    // Refresh node appearances
    Graph.nodeColor(Graph.nodeColor());
    Graph.nodeOpacity(Graph.nodeOpacity());
  }

  function highlightArticle(node) {
    // Find connected nodes
    focusedNodes = new Set([node.id, node.parent]);
    data.links.forEach(function(link) {
      var s = typeof link.source === 'object' ? link.source.id : link.source;
      var t = typeof link.target === 'object' ? link.target.id : link.target;
      if (s === node.id) focusedNodes.add(t);
      if (t === node.id) focusedNodes.add(s);
    });

    // Fly to article
    var distance = 80;
    var pos = { x: node.x || 0, y: node.y || 0, z: (node.z || 0) + distance };
    Graph.cameraPosition(pos, node, 800);

    Graph.nodeColor(Graph.nodeColor());
    Graph.nodeOpacity(Graph.nodeOpacity());
  }

  function resetFocus() {
    currentFocus = null;
    focusedNodes = null;
    breadcrumb.innerHTML = '<span class="bw-3d-breadcrumb-current">Universe</span>';
    Graph.cameraPosition({ x: 0, y: 0, z: 600 }, { x: 0, y: 0, z: 0 }, 1000);
    Graph.nodeColor(Graph.nodeColor());
    Graph.nodeOpacity(Graph.nodeOpacity());
  }

  // Global reset function
  window.bw3dReset = resetFocus;

  // Double-click to navigate
  Graph.onNodeDblClick = null;
  container.addEventListener('dblclick', function() {
    var hoveredNode = Graph.hoverObj && Graph.hoverObj.node;
    // The hoverObj may not be directly accessible, so we track it differently
  });

  // Track hovered node for double-click
  var lastHoveredNode = null;
  var originalOnHover = Graph.onNodeHover();
  Graph.onNodeHover(function(node) {
    lastHoveredNode = node;
    originalOnHover(node);
  });

  container.addEventListener('dblclick', function() {
    if (lastHoveredNode && lastHoveredNode.url) {
      window.location.href = lastHoveredNode.url;
    }
  });

  // Search functionality
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      var q = this.value.trim().toLowerCase();
      if (!q) {
        resetFocus();
        return;
      }
      var matches = data.nodes.filter(function(n) {
        return n.label.toLowerCase().indexOf(q) !== -1;
      });
      if (matches.length > 0) {
        focusedNodes = new Set(matches.map(function(n) { return n.id; }));
        // Add their categories too
        matches.forEach(function(n) {
          if (n.parent) focusedNodes.add(n.parent);
        });
        Graph.nodeColor(Graph.nodeColor());
        Graph.nodeOpacity(Graph.nodeOpacity());

        // Fly to first match
        if (matches[0]) {
          var n = matches[0];
          Graph.cameraPosition(
            { x: n.x || 0, y: n.y || 0, z: (n.z || 0) + 150 },
            n,
            600
          );
        }
      }
    });
  }

  // Legend click handlers
  document.querySelectorAll('.bw-3d-legend-item').forEach(function(el) {
    el.addEventListener('click', function() {
      var catId = this.dataset.category;
      if (this.classList.contains('disabled')) {
        this.classList.remove('disabled');
        resetFocus();
      } else {
        focusOnCategory(catId);
      }
    });
  });

  // Tooltip positioning
  container.addEventListener('mousemove', function(e) {
    if (tooltip.classList.contains('visible')) {
      var x = e.clientX + 15;
      var y = e.clientY + 15;
      if (x + tooltip.offsetWidth > window.innerWidth - 20) {
        x = e.clientX - tooltip.offsetWidth - 15;
      }
      if (y + tooltip.offsetHeight > window.innerHeight - 20) {
        y = e.clientY - tooltip.offsetHeight - 15;
      }
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') {
      resetFocus();
      if (searchInput) searchInput.value = '';
    }
    if (e.key === '/') {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
  });

  // Handle window resize
  window.addEventListener('resize', function() {
    Graph.width(container.clientWidth);
    Graph.height(container.clientHeight);
  });

  // Animation loop for node + scene-level effect animations
  var animTime = 0;
  function animateLoop() {
    animTime += 16;
    data.nodes.forEach(function(node) {
      if (node.__threeObj && node.__threeObj.userData && node.__threeObj.userData.animate) {
        node.__threeObj.userData.animate(animTime);
      }
    });
    // Iterate scene effects; remove ones that signal completion via 'remove'
    for (var i = sceneEffects.length - 1; i >= 0; i--) {
      var result = sceneEffects[i](animTime);
      if (result === 'remove') sceneEffects.splice(i, 1);
    }
    requestAnimationFrame(animateLoop);
  }
  animateLoop();

  // Zoom buttons
  var zoomInBtn = document.getElementById('bw-3d-zoom-in');
  var zoomOutBtn = document.getElementById('bw-3d-zoom-out');
  var zoomResetBtn = document.getElementById('bw-3d-zoom-reset');

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', function() {
      var dist = camera.position.length();
      var newDist = Math.max(50, dist * 0.7);
      var dir = camera.position.clone().normalize();
      Graph.cameraPosition(dir.multiplyScalar(newDist), null, 300);
    });
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', function() {
      var dist = camera.position.length();
      var newDist = Math.min(2000, dist * 1.4);
      var dir = camera.position.clone().normalize();
      Graph.cameraPosition(dir.multiplyScalar(newDist), null, 300);
    });
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', function() {
      resetFocus();
    });
  }
})();
</script>`;

    const body = `
      <div class="bw-3d-graph-page">
        <div class="bw-3d-loading">
          <div class="bw-3d-loading-spinner"></div>
        </div>
        <div id="bw-3d-graph" class="bw-3d-graph-container"></div>

        <div class="bw-3d-hud">
          <div class="bw-3d-hud-title">Knowledge Universe</div>
          <div class="bw-3d-hud-stats">
            <span>${articles.length}</span> articles across <span>${Object.keys(byCategory).length}</span> worlds
          </div>
        </div>

        <div id="bw-3d-breadcrumb" class="bw-3d-breadcrumb">
          <span class="bw-3d-breadcrumb-current">Universe</span>
        </div>

        <div class="bw-3d-legend">
          <div class="bw-3d-legend-title">Worlds</div>
          ${legendItems}
        </div>

        <div class="bw-3d-controls">
          <div class="bw-3d-controls-title">Navigate the ${escapeHtml(activeTheme.worldLabel || 'Universe')}</div>
          <div class="bw-3d-zoom-buttons">
            <button id="bw-3d-zoom-in" class="bw-3d-zoom-btn" title="Zoom In">+</button>
            <button id="bw-3d-zoom-out" class="bw-3d-zoom-btn" title="Zoom Out">−</button>
            <button id="bw-3d-zoom-reset" class="bw-3d-zoom-btn" title="Reset View">⟲</button>
          </div>
          <div class="bw-3d-controls-row"><kbd>Drag</kbd> Rotate</div>
          <div class="bw-3d-controls-row"><kbd>Scroll</kbd> Zoom</div>
          <div class="bw-3d-controls-row"><kbd>Click</kbd> Enter ${escapeHtml(activeTheme.worldLabel || 'world')}</div>
          <div class="bw-3d-controls-row"><kbd>Dbl-click</kbd> Open</div>
          <div class="bw-3d-controls-row"><kbd>Esc</kbd> Back to overview</div>
        </div>

        <div class="bw-3d-search">
          <input type="search" id="bw-3d-search-input" placeholder="Search articles..." />
        </div>

        <div id="bw-3d-tooltip" class="bw-3d-tooltip"></div>
      </div>
    `;

    return htmlShell({
      title: 'Explore',
      projectName: config.projectName,
      categories: config.categories,
      body,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
      extraBodyEnd: graph3DScript,
      needs3DGraph: true,
    });
  }

  async function render3DFileGraphPage(manifest: Manifest, articles: Article[]): Promise<string> {
    const theme = config.graph3d || {};

    // Scan source files (use module-level cache)
    if (!cachedFileGraph) {
      cachedFileGraph = await scanSourceFiles(root, bwDir, theme);
    }
    const graphData = cachedFileGraph;

    // Build nodes for 3D graph
    const nodes: any[] = [];
    const links: any[] = [];

    // Group files by directory for positioning
    const dirMap = new Map<string, string[]>();
    for (const node of graphData.nodes) {
      const dir = node.directory;
      if (!dirMap.has(dir)) dirMap.set(dir, []);
      dirMap.get(dir)!.push(node.id);
    }

    // Create file nodes
    for (const node of graphData.nodes) {
      const motifKey = motifKeyFor(root, node.id, join(root, node.id));
      nodes.push({
        id: node.id,
        label: node.label,
        type: 'file',
        directory: node.directory,
        // Wider size swing: whispers to monuments. Ratio ~18x between smallest and largest.
        size: Math.max(2.2, Math.min(44, 1.8 + Math.pow(Math.max(1, node.size) / 45, 0.66) * 5.4)),
        color: healthColor(node.health),
        health: node.health,
        healthLabel: healthLabel(node.health),
        lineCount: node.size,
        imports: node.imports.length,
        importedBy: node.importedBy.length,
        url: node.url,
        motifUrl: motifKey ? motifUrlFor(motifKey) : null,
      });
    }

    // Create import links
    for (const link of graphData.links) {
      links.push({
        source: link.source,
        target: link.target,
        type: 'import',
      });
    }

    // === LORE: wiki articles as landmarks in the park ===
    // Each article becomes a floating scroll linked to every file it mentions.
    const fileIds = new Set(graphData.nodes.map(n => n.id));
    for (const art of articles) {
      const artId = 'wiki/' + art.category + '/' + art.slug;
      // Plaintext body for mention detection (strip markdown fences + inline code delimiters).
      const hay = art.body || '';
      const mentioned: string[] = [];
      for (const fid of fileIds) {
        // Match the full path, or the last two segments (e.g. "lib/claude.ts") — articles
        // often refer to files by a shortened path.
        const short = fid.split('/').slice(-2).join('/');
        if (hay.indexOf(fid) !== -1 || hay.indexOf(short) !== -1) {
          mentioned.push(fid);
        }
      }
      // Excerpt: first meaningful prose line, ~220 chars.
      const excerpt = (art.body || '')
        .replace(/^---[\s\S]*?---/m, '')
        .replace(/^#+\s*.*$/gm, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]*`/g, '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .split('\n').map(s => s.trim()).filter(Boolean).join(' ')
        .slice(0, 260);
      nodes.push({
        id: artId,
        label: art.title,
        type: 'article',
        directory: art.category,
        size: 14 + Math.min(10, Math.sqrt((art.words || 0) / 80)),
        color: '#c4b5fd',
        health: 'lore',
        healthLabel: 'Lore · ' + art.status,
        lineCount: art.words || 0,
        imports: mentioned.length,
        importedBy: 0,
        url: '/article/' + art.category + '/' + art.slug,
        excerpt: excerpt,
        category: art.category,
        slug: art.slug,
        status: art.status,
        confidence: art.confidence,
      });
      for (const fid of mentioned) {
        links.push({ source: artId, target: fid, type: 'lore' });
      }
    }

    const graphDataJson = JSON.stringify({ nodes, links });
    const statsJson = JSON.stringify(graphData.stats);
    const themeJson = JSON.stringify(theme);

    // Build legend for health statuses
    const healthLegend = `
      <div class="bw-3d-legend-item" data-health="green">
        <div class="bw-3d-legend-dot" style="background: ${healthColor('green')}; color: ${healthColor('green')};"></div>
        <span class="bw-3d-legend-label">Healthy</span>
        <span class="bw-3d-legend-count">${graphData.stats.healthCounts.green}</span>
      </div>
      <div class="bw-3d-legend-item" data-health="gold">
        <div class="bw-3d-legend-dot" style="background: ${healthColor('gold')}; color: ${healthColor('gold')};"></div>
        <span class="bw-3d-legend-label">Tested</span>
        <span class="bw-3d-legend-count">${graphData.stats.healthCounts.gold}</span>
      </div>
      <div class="bw-3d-legend-item" data-health="red">
        <div class="bw-3d-legend-dot" style="background: ${healthColor('red')}; color: ${healthColor('red')};"></div>
        <span class="bw-3d-legend-label">Has Bugs</span>
        <span class="bw-3d-legend-count">${graphData.stats.healthCounts.red}</span>
      </div>
    `;

    // Directory list for filter
    const dirItems = graphData.directories.slice(0, 20).map(dir => {
      const count = graphData.nodes.filter(n => n.directory === dir).length;
      return `<div class="bw-3d-dir-item" data-dir="${escapeHtml(dir)}">
        <span class="bw-3d-dir-label">${escapeHtml(dir.split('/').pop() || dir)}</span>
        <span class="bw-3d-dir-count">${count}</span>
      </div>`;
    }).join('');

    const fileGraph3DScript = `<script>
(function(){
  var data = ${graphDataJson};
  var stats = ${statsJson};
  var theme = ${themeJson};
  var container = document.getElementById('bw-3d-graph');
  var tooltip = document.getElementById('bw-3d-tooltip');
  var searchInput = document.getElementById('bw-3d-search-input');

  if (!container || typeof ForceGraph3D === 'undefined') {
    console.error('3D Graph dependencies not loaded');
    return;
  }

  // Remove loading
  var loading = document.querySelector('.bw-3d-loading');
  if (loading) loading.style.display = 'none';

  // Focus state
  var focusedNodes = null;
  var selectedNode = null;
  var lastClickNode = null;
  var lastClickTime = 0;
  var buildingSet = (window.__bwBuilding && window.__bwBuilding.length) ? new Set(window.__bwBuilding) : new Set();

  // Listen for server-side build-status pushes
  window.addEventListener('bw-building', function(ev) {
    buildingSet = new Set(ev.detail || []);
    var chip = document.getElementById('bw-3d-building');
    var chipText = document.getElementById('bw-3d-building-text');
    if (chip && chipText) {
      if (buildingSet.size === 0) {
        chip.style.display = 'none';
      } else {
        var arr = Array.from(buildingSet);
        var shown = arr[0].split('/').pop();
        var more = arr.length > 1 ? ' +' + (arr.length - 1) : '';
        chipText.textContent = 'Building motif: ' + shown + more;
        chip.style.display = 'inline-flex';
      }
    }
  });

  // Helper functions
  function escapeHTML(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // Text sprite factory — reused for file-name labels and folder-bubble labels.
  function makeTextSprite(text, hexColor, subtitle, options) {
    options = options || {};
    var canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    var ctx = canvas.getContext('2d');
    // Soft glow background
    if (options.glow !== false) {
      var grad = ctx.createRadialGradient(512, 128, 8, 512, 128, 440);
      grad.addColorStop(0, (hexColor || '#ffffff') + '22');
      grad.addColorStop(1, (hexColor || '#ffffff') + '00');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 256);
    }
    var mainSize = options.mainSize || 68;
    var subSize = options.subSize || 28;
    ctx.font = 'bold ' + mainSize + 'px -apple-system, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = hexColor || '#ffffff';
    ctx.shadowBlur = options.mainShadowBlur != null ? options.mainShadowBlur : 28;
    ctx.fillStyle = '#ffffff';
    ctx.fillText((text || '').slice(0, 40), 512, subtitle ? 110 : 128);
    if (subtitle) {
      ctx.shadowBlur = 6;
      ctx.font = subSize + 'px -apple-system, Inter, sans-serif';
      ctx.fillStyle = hexColor || '#bbbbbb';
      ctx.fillText(String(subtitle).slice(0, 60), 512, 186);
    }
    var tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    var sp = new THREE.Sprite(mat);
    sp.scale.set(200, 50, 1);
    return sp;
  }

  // In-place file panel — opens on second-click, closes together with mini-map.
  function closeBothPanels() {
    var p = document.getElementById('bw-3d-panel');
    var m = document.getElementById('bw-3d-map');
    if (p) { p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); }
    if (m) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); }
  }

  function renderConnectionMap(node, detail) {
    var svg = document.getElementById('bw-3d-map-svg');
    var title = document.getElementById('bw-3d-map-title');
    var sub = document.getElementById('bw-3d-map-sub');
    if (!svg) return;
    title.textContent = node.label || '';
    var imps = (detail.imports || []).slice(0, 10);
    var impBy = (detail.importedBy || []).slice(0, 10);
    sub.textContent = imps.length + ' imports \u00b7 ' + impBy.length + ' imported by';

    var ns = 'http://www.w3.org/2000/svg';
    svg.innerHTML = '';

    // Faint grid
    var grid = document.createElementNS(ns, 'circle');
    grid.setAttribute('cx', '0'); grid.setAttribute('cy', '0'); grid.setAttribute('r', '120');
    grid.setAttribute('fill', 'none'); grid.setAttribute('stroke', 'rgba(255,255,255,0.06)'); grid.setAttribute('stroke-width', '1');
    svg.appendChild(grid);
    var grid2 = document.createElementNS(ns, 'circle');
    grid2.setAttribute('cx', '0'); grid2.setAttribute('cy', '0'); grid2.setAttribute('r', '60');
    grid2.setAttribute('fill', 'none'); grid2.setAttribute('stroke', 'rgba(255,255,255,0.04)'); grid2.setAttribute('stroke-width', '1');
    svg.appendChild(grid2);

    function placeNodes(list, isInbound) {
      var n = list.length;
      if (!n) return [];
      var placed = [];
      for (var i = 0; i < n; i++) {
        // Inbound (imported-by): top half. Outbound (imports): bottom half.
        var a = (i / Math.max(1, n - 1)) * Math.PI + (isInbound ? Math.PI : 0) + (n === 1 ? Math.PI / 2 : 0);
        var x = Math.cos(a) * 120;
        var y = Math.sin(a) * 120;
        placed.push({ x: x, y: y, label: list[i] });
      }
      return placed;
    }
    var outNodes = placeNodes(imps, false);
    var inNodes  = placeNodes(impBy, true);

    function drawEdge(p, isInbound) {
      var line = document.createElementNS(ns, 'line');
      // Arrow direction: inbound comes TO center, outbound leaves FROM center
      line.setAttribute('x1', isInbound ? p.x : 0);
      line.setAttribute('y1', isInbound ? p.y : 0);
      line.setAttribute('x2', isInbound ? 0 : p.x);
      line.setAttribute('y2', isInbound ? 0 : p.y);
      line.setAttribute('stroke', isInbound ? '#fcd34d' : '#a7f3d0');
      line.setAttribute('stroke-width', '1.2');
      line.setAttribute('opacity', '0.55');
      svg.appendChild(line);
    }
    function drawEndpoint(p, isInbound) {
      var c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
      c.setAttribute('r', '5');
      c.setAttribute('fill', isInbound ? '#fcd34d' : '#a7f3d0');
      c.setAttribute('opacity', '0.95');
      svg.appendChild(c);
      var t = document.createElementNS(ns, 'text');
      var base = (p.label || '').split('/').pop();
      t.setAttribute('x', p.x * 1.18);
      t.setAttribute('y', p.y * 1.18 + 3);
      t.setAttribute('text-anchor', p.x < -10 ? 'end' : (p.x > 10 ? 'start' : 'middle'));
      t.setAttribute('font-size', '8');
      t.setAttribute('font-family', '-apple-system, Inter, sans-serif');
      t.setAttribute('fill', 'rgba(255,255,255,0.72)');
      t.textContent = base.length > 18 ? base.slice(0, 16) + '\u2026' : base;
      svg.appendChild(t);
    }
    outNodes.forEach(function(p) { drawEdge(p, false); });
    inNodes.forEach(function(p) { drawEdge(p, true); });
    outNodes.forEach(function(p) { drawEndpoint(p, false); });
    inNodes.forEach(function(p) { drawEndpoint(p, true); });

    // Center node
    var core = document.createElementNS(ns, 'circle');
    core.setAttribute('cx', '0'); core.setAttribute('cy', '0'); core.setAttribute('r', '10');
    core.setAttribute('fill', node.color || '#c4b5fd');
    core.setAttribute('stroke', '#ffffff'); core.setAttribute('stroke-width', '1.5');
    svg.appendChild(core);
    var label = document.createElementNS(ns, 'text');
    label.setAttribute('x', '0'); label.setAttribute('y', '-18');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '10');
    label.setAttribute('font-family', '-apple-system, Inter, sans-serif');
    label.setAttribute('font-weight', 'bold');
    label.setAttribute('fill', '#ffffff');
    label.textContent = (node.label || '').slice(0, 20);
    svg.appendChild(label);
  }

  function streamExplain(node, resultEl, btnEl) {
    resultEl.style.display = 'block';
    resultEl.textContent = '';
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Thinking\u2026'; }
    fetch('/api/explain/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: node.id })
    }).then(function(resp) {
      var reader = resp.body.getReader();
      var dec = new TextDecoder();
      function read() {
        reader.read().then(function(r2) {
          if (r2.done) { if (btnEl) { btnEl.textContent = 'Re-analyze'; btnEl.disabled = false; } return; }
          var chunk = dec.decode(r2.value, { stream: true });
          chunk.split('\\n').forEach(function(line) {
            line = line.trim();
            if (line.indexOf('event: done') === 0) {
              if (btnEl) { btnEl.textContent = 'Re-analyze'; btnEl.disabled = false; }
              return;
            }
            if (line.indexOf('data: ') === 0) {
              try {
                var d = JSON.parse(line.slice(6));
                if (d.text) { resultEl.textContent += d.text; resultEl.scrollTop = resultEl.scrollHeight; }
              } catch(e) {}
            }
          });
          read();
        });
      }
      read();
    }).catch(function(err) {
      resultEl.textContent = 'Error: ' + err.message;
      if (btnEl) { btnEl.textContent = 'Retry'; btnEl.disabled = false; }
    });
  }

  function openFilePanel(node) {
    var panel = document.getElementById('bw-3d-panel');
    var head  = document.getElementById('bw-3d-panel-head');
    var body  = document.getElementById('bw-3d-panel-body');
    var closeBtn = document.getElementById('bw-3d-panel-close');
    var mapPanel = document.getElementById('bw-3d-map');
    if (!panel || !head || !body) return;
    closeBtn.onclick = closeBothPanels;

    // --- Already-known from the node payload: render header + any lore hits instantly ---
    var arch = (node.archetype && node.archetype.desc) ? node.archetype.desc : '';
    var healthTxt = node.healthLabel ? node.healthLabel.toUpperCase() : '';
    var biomeTxt = (node.biome || '').toUpperCase();
    head.innerHTML =
      '<h2>' + escapeHTML(node.label || '') + '</h2>' +
      '<div class="bw-3d-panel-path">' + escapeHTML(node.id || '') + '</div>' +
      '<div class="bw-3d-panel-arch" style="color:' + (node.biomeAccentHex || '#c4b5fd') + '">' +
        escapeHTML(healthTxt) + (arch ? ' \u00b7 ' + escapeHTML(arch) : '') + (biomeTxt ? ' \u00b7 ' + escapeHTML(biomeTxt) : '') +
      '</div>';

    // Find wiki articles that mention this file — instant, no fetch needed.
    var loreHits = [];
    (data.nodes || []).forEach(function(n) { if (n.type === 'article') {
      // links where source=articleId, target=file.id
      (data.links || []).forEach(function(l) {
        var sid = typeof l.source === 'object' ? l.source.id : l.source;
        var tid = typeof l.target === 'object' ? l.target.id : l.target;
        if (l.type === 'lore' && tid === node.id && sid === n.id) loreHits.push(n);
      });
    }});

    // --- INSTANT FULL SKELETON ---
    var loreBlock = '';
    if (loreHits.length) {
      loreBlock = '<div class="bw-pp-lore"><h4 style="margin-top:0">Wiki mentions (' + loreHits.length + ')</h4>';
      loreHits.forEach(function(a) {
        loreBlock += '<div class="bw-pp-lore-item">' +
          '<div class="bw-pp-lore-title">' + escapeHTML(a.label || '') + '</div>' +
          '<div class="bw-pp-lore-excerpt">' + escapeHTML((a.excerpt || '').slice(0, 180)) + (a.excerpt && a.excerpt.length > 180 ? '\u2026' : '') + '</div>' +
          (a.url ? '<a class="bw-pp-lore-link" href="' + escapeHTML(a.url) + '" target="_blank">Open article \u2192</a>' : '') +
        '</div>';
      });
      loreBlock += '</div>';
    }

    body.innerHTML =
      '<div class="bw-pp-verdict-wrap">' +
        '<div class="bw-pp-verdict-title">' +
          '<span class="bw-pp-spin"></span> <span id="bw-pp-verdict-status">Claude is reading the file\u2026</span>' +
        '</div>' +
        '<div class="bw-pp-result" id="bw-pp-result"></div>' +
      '</div>' +
      '<div class="bw-pp-stats" id="bw-pp-stats">' +
        '<div class="bw-pp-stat"><div class="bw-pp-stat-val bw-skel-line" style="width:55%"></div><div class="bw-pp-stat-lbl">Size</div></div>' +
        '<div class="bw-pp-stat"><div class="bw-pp-stat-val bw-skel-line" style="width:45%"></div><div class="bw-pp-stat-lbl">Lines</div></div>' +
        '<div class="bw-pp-stat"><div class="bw-pp-stat-val bw-skel-line" style="width:35%"></div><div class="bw-pp-stat-lbl">Churn</div></div>' +
        '<div class="bw-pp-stat"><div class="bw-pp-stat-val bw-skel-line" style="width:30%"></div><div class="bw-pp-stat-lbl">Type</div></div>' +
      '</div>' +
      loreBlock +
      '<div id="bw-pp-deps-block">' +
        '<h4><span class="bw-pp-spin small"></span> Mapping connections\u2026</h4>' +
      '</div>' +
      '<h4>Source</h4>' +
      '<div class="bw-pp-code-wrap"><pre class="bw-pp-code" id="bw-pp-code"><span class="bw-pp-spin"></span> Loading source\u2026</pre></div>' +
      '<button class="bw-pp-analyze" id="bw-pp-analyze-btn" disabled>Thinking\u2026</button>';

    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    if (mapPanel) {
      mapPanel.classList.add('open');
      mapPanel.setAttribute('aria-hidden', 'false');
      var mapSub = document.getElementById('bw-3d-map-sub');
      var mapSvg = document.getElementById('bw-3d-map-svg');
      if (mapSub) mapSub.textContent = 'Searching connections\u2026';
      if (mapSvg) {
        mapSvg.innerHTML =
          '<circle cx="0" cy="0" r="120" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>' +
          '<circle cx="0" cy="0" r="60" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>' +
          '<circle cx="0" cy="0" r="10" fill="' + (node.color || '#c4b5fd') + '" stroke="#fff" stroke-width="1.5"/>' +
          '<text x="0" y="-18" text-anchor="middle" font-size="10" font-family="-apple-system, Inter" font-weight="bold" fill="#ffffff">' + escapeHTML((node.label || '').slice(0, 20)) + '</text>' +
          '<circle cx="0" cy="0" r="40" fill="none" stroke="rgba(196,181,253,0.3)" stroke-width="1.5" stroke-dasharray="4 3"><animate attributeName="r" from="15" to="130" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.9" to="0" dur="1.6s" repeatCount="indefinite"/></circle>';
      }
    }

    // --- Parallel fetches, each populates its own section ---
    fetch('/api/explain/file?path=' + encodeURIComponent(node.id))
      .then(function(r) { return r.json(); })
      .then(function(detail) {
        renderConnectionMap(node, detail);
        function fmtBytes(b) {
          if (b < 1024) return b + ' B';
          if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
          return (b / 1048576).toFixed(2) + ' MB';
        }
        var statsEl = document.getElementById('bw-pp-stats');
        if (statsEl) {
          statsEl.innerHTML =
            '<div class="bw-pp-stat"><div class="bw-pp-stat-val">' + fmtBytes(detail.sizeBytes || 0) + '</div><div class="bw-pp-stat-lbl">Size</div></div>' +
            '<div class="bw-pp-stat"><div class="bw-pp-stat-val">' + (detail.lineCount || 0) + '</div><div class="bw-pp-stat-lbl">Lines</div></div>' +
            '<div class="bw-pp-stat"><div class="bw-pp-stat-val">' + (detail.churnScore || 0) + '</div><div class="bw-pp-stat-lbl">Churn</div></div>' +
            '<div class="bw-pp-stat"><div class="bw-pp-stat-val">' + escapeHTML(detail.extension || '') + '</div><div class="bw-pp-stat-lbl">Type</div></div>';
        }
        var depsBlock = document.getElementById('bw-pp-deps-block');
        if (depsBlock) {
          var depsHtml = '';
          if (detail.errors && detail.errors.length) {
            depsHtml += '<h4>Errors &amp; Warnings</h4>';
            detail.errors.forEach(function(e) {
              depsHtml += '<div class="bw-pp-dep" style="color:#f87171">' + escapeHTML(e.severity) + ' L' + e.line + ': ' + escapeHTML(e.message) + '</div>';
            });
          }
          if (detail.imports && detail.imports.length) {
            depsHtml += '<h4>Imports (' + detail.imports.length + ')</h4>';
            detail.imports.forEach(function(p) { depsHtml += '<div class="bw-pp-dep">' + escapeHTML(p) + '</div>'; });
          }
          if (detail.importedBy && detail.importedBy.length) {
            depsHtml += '<h4>Imported By (' + detail.importedBy.length + ')</h4>';
            detail.importedBy.forEach(function(p) { depsHtml += '<div class="bw-pp-dep in">' + escapeHTML(p) + '</div>'; });
          }
          if (!depsHtml) depsHtml = '<h4>Connections</h4><div style="color:rgba(255,255,255,0.45);padding:4px 0">(isolated \u2014 no import relationships)</div>';
          depsBlock.innerHTML = depsHtml;
        }
      })
      .catch(function(err) {
        var depsBlock = document.getElementById('bw-pp-deps-block');
        if (depsBlock) depsBlock.innerHTML = '<div style="color:#f87171;padding:8px 0">Could not load file detail: ' + escapeHTML(err.message) + '</div>';
      });

    fetch('/api/explain/content?path=' + encodeURIComponent(node.id))
      .then(function(r) { return r.json(); })
      .then(function(c) {
        var codeEl = document.getElementById('bw-pp-code');
        if (!codeEl) return;
        if (c.error) { codeEl.textContent = '(' + c.error + ')'; return; }
        var lines = (c.content || '').split('\\n');
        var w = String(lines.length).length;
        var padded = lines.map(function(l, i) {
          var ln = String(i + 1);
          while (ln.length < w) ln = ' ' + ln;
          return ln + '  ' + l;
        }).join('\\n');
        codeEl.textContent = padded + (c.truncated ? '\\n\\n\u2026 (truncated)' : '');
      })
      .catch(function(err) {
        var codeEl = document.getElementById('bw-pp-code');
        if (codeEl) codeEl.textContent = '(error: ' + err.message + ')';
      });

    // AI verdict — fires in parallel immediately.
    var resultEl = document.getElementById('bw-pp-result');
    var btnEl = document.getElementById('bw-pp-analyze-btn');
    streamExplain(node, resultEl, btnEl);
    if (btnEl) {
      btnEl.addEventListener('click', function() { streamExplain(node, resultEl, btnEl); });
    }
  }

  // Motif texture loader — fetch each AI-generated SVG once, rasterize, reuse.
  var motifCache = {};
  var motifPending = {};
  function loadMotifTexture(url, cb) {
    if (!url) return;
    if (motifCache[url]) { cb(motifCache[url]); return; }
    if (motifPending[url]) { motifPending[url].push(cb); return; }
    motifPending[url] = [cb];
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      var c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      var x = c.getContext('2d');
      x.drawImage(img, 0, 0, 256, 256);
      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      motifCache[url] = tex;
      var queue = motifPending[url] || [];
      delete motifPending[url];
      queue.forEach(function(fn) { try { fn(tex); } catch (e) {} });
    };
    img.onerror = function() { delete motifPending[url]; };
    img.src = url;
  }

  // Precompute node connections for highlighting
  var nodeConnections = {};
  data.nodes.forEach(function(n) { nodeConnections[n.id] = new Set(); });
  data.links.forEach(function(l) {
    nodeConnections[l.source] = nodeConnections[l.source] || new Set();
    nodeConnections[l.target] = nodeConnections[l.target] || new Set();
    nodeConnections[l.source].add(l.target);
    nodeConnections[l.target].add(l.source);
  });

  // === PROJECTLAND: each file's VIBE drives its geometry ===
  // No hardcoded lands. Clusters emerge from the import graph; per-file shape
  // and accents are derived from each file's actual character — role, scale,
  // centrality, health. Read the code, let it tell its own story.
  function roleOf(n) {
    if (n.type === 'article') return 'lore';
    var p = n.id.toLowerCase();
    if (/\\.test\\.|\\.spec\\.|__tests__|\\.vitest/.test(p)) return 'test';
    if (/\\.d\\.ts$/.test(p) || /\\btypes?\\//.test(p)) return 'type';
    if (/\\bprisma\\b|schema/.test(p)) return 'schema';
    if (/\\bapp\\/.*\\/page\\./.test(p) || /^[^/]+\\/app\\/page\\./.test(p)) return 'page';
    if (/\\bapp\\/.*\\/layout\\./.test(p) || /^[^/]+\\/app\\/layout\\./.test(p)) return 'portal';
    if (/\\bapp\\/api\\//.test(p) || /\\bpages\\/api\\//.test(p)) return 'api';
    if (/\\broutes?\\//.test(p)) return 'route';
    if (/\\bjobs?\\//.test(p)) return 'job';
    if (/\\bhooks?\\//.test(p)) return 'hook';
    if (/\\bcontexts?\\//.test(p)) return 'context';
    if (/\\bcomponents?\\//.test(p) && /\\.tsx?$/.test(p)) return 'component';
    if (/server\\.(t|j)sx?$|\\bcli\\.(t|j)sx?$|^[^/]+\\/src\\/index\\./.test(p)) return 'root';
    if (/twilio|deepgram|cartesia|\\bvoice|\\btts\\b|\\bstt\\b|audio|conversation/.test(p)) return 'voice';
    if (/scraper|tabelog|scrape|harvest/.test(p)) return 'harvest';
    if (/\\bclaude\\.(t|j)s|\\btool(s|-loop)\\.(t|j)s|orchestrat/.test(p)) return 'orchestrator';
    if (/\\blib\\/.*auth|\\bauth\\b|\\bjwt\\b/.test(p)) return 'ward';
    if (/\\blib\\//.test(p) || /\\butils?\\//.test(p) || /\\bhelpers?\\//.test(p)) return 'library';
    if (/\\benv\\.|\\bconfig\\.|\\.config\\./.test(p)) return 'env';
    if (/\\bmiddleware\\b/.test(p)) return 'gate';
    return 'commons';
  }

  // Each role gets an archetype: base shape + accents + vertical bias.
  // This is the vocabulary the park is built from.
  var ROLE_VOCAB = {
    root:         { shape: 'obelisk',  rings: 2, glow: 1.4, stretchY: 2.6, desc: 'Gate' },
    orchestrator: { shape: 'spiked',   rings: 3, glow: 1.6, stretchY: 1.0, desc: 'Conductor' },
    page:         { shape: 'pillar',   rings: 1, glow: 1.2, stretchY: 2.2, desc: 'Monument' },
    portal:       { shape: 'arch',     rings: 0, glow: 1.1, stretchY: 0.6, desc: 'Portal' },
    route:        { shape: 'arch',     rings: 1, glow: 1.0, stretchY: 0.7, desc: 'Archway' },
    api:          { shape: 'disc',     rings: 1, glow: 1.0, stretchY: 0.3, desc: 'Signal' },
    job:          { shape: 'moon',     rings: 1, glow: 0.9, stretchY: 0.9, desc: 'Orbiter' },
    hook:         { shape: 'satellite',rings: 0, glow: 0.9, stretchY: 0.9, desc: 'Hook' },
    context:      { shape: 'satellite',rings: 1, glow: 1.0, stretchY: 0.9, desc: 'Context' },
    component:    { shape: 'petal',    rings: 0, glow: 1.0, stretchY: 1.2, desc: 'Petal' },
    voice:        { shape: 'wavering', rings: 3, glow: 1.2, stretchY: 0.9, desc: 'Resonator' },
    harvest:      { shape: 'cluster',  rings: 0, glow: 0.9, stretchY: 0.9, desc: 'Harvester' },
    test:         { shape: 'sphere',   rings: 1, glow: 0.9, stretchY: 1.0, desc: 'Witness' },
    type:         { shape: 'crystal',  rings: 0, glow: 1.1, stretchY: 1.1, desc: 'Crystal' },
    schema:       { shape: 'hex',      rings: 0, glow: 1.0, stretchY: 1.6, desc: 'Pillar' },
    ward:         { shape: 'spiked',   rings: 2, glow: 1.1, stretchY: 1.0, desc: 'Ward' },
    gate:         { shape: 'arch',     rings: 2, glow: 1.0, stretchY: 0.8, desc: 'Gate' },
    library:      { shape: 'sphere',   rings: 0, glow: 0.8, stretchY: 1.0, desc: 'Library' },
    env:          { shape: 'cube',     rings: 0, glow: 0.7, stretchY: 1.0, desc: 'Seed' },
    commons:      { shape: 'sphere',   rings: 0, glow: 0.8, stretchY: 1.0, desc: 'File' },
    lore:         { shape: 'scroll',   rings: 0, glow: 1.8, stretchY: 2.2, desc: 'Lore' },
    // === CHAOS ARCHETYPES — triggered by actual file characteristics ===
    swarm:        { shape: 'swarm',    rings: 0, glow: 1.3, stretchY: 1.0, desc: 'Swarm' },
    knot:         { shape: 'torusknot',rings: 0, glow: 1.5, stretchY: 1.2, desc: 'Knot' },
    ghost:        { shape: 'ghost',    rings: 0, glow: 0.6, stretchY: 1.2, desc: 'Ghost' },
    tower:        { shape: 'tower',    rings: 0, glow: 1.2, stretchY: 2.8, desc: 'Tower' },
    shards:       { shape: 'shards',   rings: 0, glow: 1.1, stretchY: 1.0, desc: 'Shards' },
    tentacled:    { shape: 'tentacles',rings: 0, glow: 1.2, stretchY: 1.4, desc: 'Leviathan' },
    helix:        { shape: 'helix',    rings: 0, glow: 1.1, stretchY: 2.4, desc: 'Helix' },
    starburst:    { shape: 'starburst',rings: 0, glow: 1.7, stretchY: 1.0, desc: 'Starburst' }
  };

  // === BIOMES: every file lives in a visual world determined by its nature. ===
  // Shape, color palette, and motes all bend toward the biome. Same health is
  // still read (green/gold/red), but each biome tints it.
  var BIOMES = {
    volcano: { primary: 0xff5722, accent: 0xffcc80, desc: 'Volcano',  moteColor: 0xff8a50, moteRise: 1.2  },
    water:   { primary: 0x00bcd4, accent: 0x80deea, desc: 'Water',    moteColor: 0x80deea, moteRise: -0.4 },
    ice:     { primary: 0x81d4fa, accent: 0xe1f5fe, desc: 'Ice',      moteColor: 0xffffff, moteRise: -0.15 },
    space:   { primary: 0x9575cd, accent: 0xb39ddb, desc: 'Void',     moteColor: 0xd1c4e9, moteRise: 0.0  },
    jungle:  { primary: 0x66bb6a, accent: 0xa5d6a7, desc: 'Jungle',   moteColor: 0xaed581, moteRise: -0.3 },
    beach:   { primary: 0xffb74d, accent: 0xffe082, desc: 'Beach',    moteColor: 0xffe082, moteRise: 0.2  },
    aurora:  { primary: 0xab47bc, accent: 0xce93d8, desc: 'Aurora',   moteColor: 0xe1bee7, moteRise: 0.3  }
  };
  function biomeOf(n) {
    var r = n.role;
    if (n.type === 'article') return 'aurora';
    if (n.isHotPath || r === 'orchestrator' || r === 'ward') return 'volcano';
    if (r === 'voice' || r === 'route' || r === 'api' || r === 'component' || r === 'hook' || r === 'context') return 'water';
    if (r === 'type' || r === 'schema' || r === 'test') return 'ice';
    if (r === 'library' || r === 'commons' || r === 'env' || r === 'gate') return 'space';
    if (r === 'harvest' || r === 'job') return 'jungle';
    if (r === 'page' || r === 'portal' || r === 'root') return 'beach';
    return 'space';
  }
  // Convert an integer hex color to [r,g,b] in 0..1
  function hexTo01(h) { return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }
  // Blend two hex colors by amount t (0..1)
  function blendHex(a, b, t) {
    var ar = hexTo01(a), br = hexTo01(b);
    var r = Math.round((ar[0] * (1-t) + br[0] * t) * 255);
    var g = Math.round((ar[1] * (1-t) + br[1] * t) * 255);
    var bb = Math.round((ar[2] * (1-t) + br[2] * t) * 255);
    function h(x){ var s = x.toString(16); return s.length === 1 ? '0' + s : s; }
    return '#' + h(r) + h(g) + h(bb);
  }

  // Hot paths from CLAUDE.md — files the project's spine runs through.
  // Also treat any file with very high fan-in as a crown-worthy landmark.
  var HOT_PATHS = {
    'backend/src/lib/claude.ts': true,
    'backend/src/lib/tools.ts': true,
    'frontend/src/components/ChatInterface.tsx': true,
    'autocall/src/conversation.ts': true,
    'autocall/src/twilio-stream.ts': true
  };

  // Classify every node with role + centrality + biome + chaos override.
  data.nodes.forEach(function(n) {
    n.role = roleOf(n);
    var conns = (nodeConnections[n.id] || new Set()).size;
    n.centrality = conns;
    n.isHotPath = n.type !== 'article' && (!!HOT_PATHS[n.id] || conns > 8);
    n.biome = biomeOf(n);

    // Theme-driven chaos override: real file stats earn a wild archetype.
    // This keeps it meaningful — you see a swarm because the file IS a swarm.
    var fanOut = (n.imports || 0);
    var fanIn = (n.importedBy || 0);
    var lc = n.lineCount || 50;
    var chaosRole = null;
    if (fanOut >= 12 && lc < 180) chaosRole = 'swarm';                       // many tiny imports
    else if (conns === 0)         chaosRole = 'ghost';                       // isolated file
    else if (lc > 500 && fanOut < 3) chaosRole = 'tower';                    // massive but self-contained
    else if (fanOut > 8 && fanIn > 6) chaosRole = 'knot';                    // tangled
    else if (n.health === 'red' && fanIn > 2) chaosRole = 'shards';          // broken + load-bearing
    else if (n.health === 'gold' && conns > 4) chaosRole = 'starburst';      // well-tested + central
    else if (lc > 300 && fanIn === 0) chaosRole = 'tentacled';               // big orphan leviathan
    else if (/^[^/]+\\/src\\/(helpers|hooks|contexts)/.test(n.id || '')) chaosRole = 'helix'; // coiled glue

    n.role = chaosRole || n.role;
    n.archetype = ROLE_VOCAB[n.role] || ROLE_VOCAB.commons;

    // Biome tint: blend 62% original health color + 38% biome accent.
    // Result: health still reads at a glance, biome gives the world its flavor.
    if (n.type !== 'article') {
      var biome = BIOMES[n.biome] || BIOMES.space;
      // Remember original for later (emissive-only use)
      n.healthColor = n.color;
      n.color = blendHex(parseInt(n.color.replace('#', ''), 16), biome.accent, 0.38);
      n.biomeHex = '#' + biome.primary.toString(16).padStart(6, '0');
      n.biomeAccentHex = '#' + biome.accent.toString(16).padStart(6, '0');
    }

    n.yBias = Math.log(1 + conns) * 18 + (n.archetype.stretchY > 1.5 ? 40 : 0);
  });

  // Per-file identity: hash the path; shift hue/sat/light within health class;
  // compute mass. Same health stays recognizable but every file has its own shade.
  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function hexToHsl(hex) {
    var r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
    var mx = Math.max(r,g,b), mn = Math.min(r,g,b);
    var l = (mx+mn)/2, h = 0, sat = 0;
    if (mx !== mn) {
      var d = mx-mn;
      sat = l > 0.5 ? d/(2-mx-mn) : d/(mx+mn);
      if (mx===r) h = ((g-b)/d + (g<b?6:0)) / 6;
      else if (mx===g) h = ((b-r)/d + 2) / 6;
      else h = ((r-g)/d + 4) / 6;
    }
    return { h: h, s: sat, l: l };
  }
  function hslToHex(h, s, l) {
    h = ((h % 1) + 1) % 1;
    function f(n) {
      var k = (n + h*12) % 12;
      var a = s * Math.min(l, 1-l);
      var c = l - a * Math.max(-1, Math.min(Math.min(k-3, 9-k), 1));
      var hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }
    return '#' + f(0) + f(8) + f(4);
  }
  data.nodes.forEach(function(n) {
    var seed = hashStr(n.id || n.label || '');
    n.seed = seed;
    n.mass = ((n.lineCount || 20) / 10) + (n.centrality || 0) * 2.5;
    if (n.type !== 'article') {
      var hsl = hexToHsl(n.color);
      // Each file picks its own shade: hue ±14°, saturation ±14%, lightness ±11%.
      var nh = hsl.h + ((seed % 28 - 14) / 360);
      var ns = Math.max(0.22, Math.min(0.98, hsl.s + ((seed >> 5) % 28 - 14) / 100));
      var nl = Math.max(0.28, Math.min(0.80, hsl.l + ((seed >> 10) % 22 - 11) / 100));
      n.color = hslToHex(nh, ns, nl);
    }
  });

  // Seed article positions on a ring orbiting the code cluster — they become
  // landmarks you walk TOWARD, not boulders buried in the middle of the park.
  var articleNodes = data.nodes.filter(function(n) { return n.type === 'article'; });
  var LORE_R = 680;
  articleNodes.forEach(function(a, i) {
    var angle = (Math.PI * 2 * i) / Math.max(1, articleNodes.length);
    var tilt = (i % 3 - 1) * 140;
    a.x = Math.cos(angle) * LORE_R;
    a.y = tilt;
    a.z = Math.sin(angle) * LORE_R;
  });

  // Create the 3D force graph - Obsidian style.
  // numDimensions(3) is the ForceGraph3D default; declaring it explicitly so the
  // built-in d3-force-3d simulation stays volumetric (x/y/z) instead of flat.
  var Graph = ForceGraph3D({ controlType: 'orbit' })(container)
    .numDimensions(3)
    .backgroundColor('#1a1a2e')
    .showNavInfo(false)
    .nodeLabel(null)
    .nodeRelSize(6)
    .nodeVal(function(node) {
      // Size by connections + base size
      var connections = (nodeConnections[node.id] || new Set()).size;
      return Math.pow(node.size + connections * 0.5, 2);
    })
    .nodeThreeObject(function(node) {
      // Geometry derived from the file's real character: role + lines + fan-in/out + hash.
      var group = new THREE.Group();
      group.userData.nodeId = node.id;
      var dim = focusedNodes && !focusedNodes.has(node.id);
      var arch = node.archetype;
      var baseSize = node.size;
      var conns = node.centrality || 0;
      var fanOut = node.imports || 0;
      var fanIn = node.importedBy || 0;
      var seed = node.seed || 0;
      // Connections amplify visual scale, but keep article scrolls steady.
      var s = node.type === 'article' ? baseSize : (baseSize + conns * 0.5);
      var isBug = node.health === 'red';
      var isTest = node.health === 'gold';
      var col = node.color;

      // Seeded rotation: every file sits at its own angle, no two identical.
      group.rotation.y = ((seed % 1000) / 1000) * Math.PI * 2;
      group.rotation.x = (((seed >> 3) % 1000) / 1000) * 0.5 - 0.25;
      group.rotation.z = (((seed >> 7) % 1000) / 1000) * 0.4 - 0.2;

      // Per-node self-rotation: orchestrators and crystals spin noticeably;
      // utilities drift slow; articles rotate serenely. Axis seeded.
      var baseSpinSpeed = node.type === 'article' ? 0.0015 :
                          (arch.shape === 'spiked' || arch.shape === 'crystal') ? 0.006 :
                          (arch.shape === 'wavering' || arch.shape === 'cluster') ? 0.004 :
                          (arch.shape === 'sphere' || arch.shape === 'cube') ? 0.001 :
                          0.0025;
      var axAngle = ((seed >> 11) % 1000) / 1000 * Math.PI * 2;
      var axTilt  = ((seed >> 14) % 1000) / 1000 * 0.8 - 0.4;
      group.userData.nodeId = node.id;
      group.userData.spinAxis = {
        x: Math.sin(axTilt) * baseSpinSpeed * 0.4,
        y: Math.cos(axAngle) * baseSpinSpeed,
        z: Math.sin(axAngle) * baseSpinSpeed * 0.4
      };

      // Material personality per archetype — different shininess, emissive
      // ceiling, and faceting so the same sphere never feels the same.
      function materialFlavor() {
        if (arch.shape === 'crystal') return { shininess: 260, flat: true,  emBoost: 1.5, opacityBoost: 0.9 };
        if (arch.shape === 'spiked')  return { shininess: 200, flat: false, emBoost: 1.4, opacityBoost: 1.0 };
        if (arch.shape === 'obelisk' || arch.shape === 'pillar') return { shininess: 60, flat: false, emBoost: 1.1, opacityBoost: 1.05 };
        if (arch.shape === 'cube' || arch.shape === 'hex') return { shininess: 25, flat: true, emBoost: 0.8, opacityBoost: 0.95 };
        if (arch.shape === 'petal') return { shininess: 140, flat: false, emBoost: 1.2, opacityBoost: 0.9 };
        if (arch.shape === 'scroll') return { shininess: 180, flat: false, emBoost: 1.6, opacityBoost: 0.95 };
        if (arch.shape === 'wavering') return { shininess: 90, flat: false, emBoost: 1.3, opacityBoost: 1.0 };
        if (arch.shape === 'disc') return { shininess: 180, flat: false, emBoost: 1.1, opacityBoost: 1.1 };
        return { shininess: 110, flat: false, emBoost: 1.0, opacityBoost: 1.0 };
      }
      var flavor = materialFlavor();
      // Seeded micro-variance per file — small random tweak on top of archetype.
      var microShine = 1 + ((seed >> 9) % 100 - 50) / 200;    // ±25% shininess
      var microEm    = 1 + ((seed >> 13) % 100 - 50) / 250;   // ±20% emissive

      function bodyMat(opacityScale, emissiveScale) {
        var mat = new THREE.MeshPhongMaterial({
          color: col, transparent: true,
          opacity: dim ? 0.08 : (0.7 * (opacityScale || 1) * flavor.opacityBoost),
          emissive: col,
          emissiveIntensity: dim ? 0.1 : (0.5 * (emissiveScale || 1) * arch.glow * flavor.emBoost * microEm),
          shininess: flavor.shininess * microShine,
          flatShading: flavor.flat,
        });
        // Apply the AI-generated motif as an emissive map — health color tints the sigil.
        if (!dim && node.motifUrl) {
          loadMotifTexture(node.motifUrl, function(tex) {
            mat.emissiveMap = tex;
            mat.needsUpdate = true;
          });
        }
        return mat;
      }
      function basicMat(opacity) {
        return new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: dim ? opacity * 0.15 : opacity
        });
      }

      // Core (always present — a small bright heart)
      var core = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.55, 24, 24),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: dim ? 0.1 : 1.0 })
      );
      group.add(core);

      // Main body — shape from archetype
      var body;
      switch (arch.shape) {
        case 'obelisk': {
          // Tall rectangular pillar with a pyramid cap
          var pillar = new THREE.Mesh(new THREE.BoxGeometry(s * 1.1, s * arch.stretchY, s * 1.1), bodyMat());
          var cap = new THREE.Mesh(new THREE.ConeGeometry(s * 0.8, s * 0.9, 4), bodyMat(1.0, 1.3));
          cap.position.y = s * arch.stretchY * 0.5 + s * 0.4;
          cap.rotation.y = Math.PI / 4;
          body = new THREE.Group(); body.add(pillar); body.add(cap);
          break;
        }
        case 'pillar': {
          body = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.7, s * 0.9, s * arch.stretchY, 20), bodyMat());
          break;
        }
        case 'arch': {
          body = new THREE.Mesh(new THREE.TorusGeometry(s * 1.1, s * 0.35, 16, 40), bodyMat());
          body.rotation.x = Math.PI / 2;
          break;
        }
        case 'disc': {
          body = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.2, s * 1.2, s * 0.3, 24), bodyMat(1, 1.2));
          break;
        }
        case 'petal': {
          // Tapered double-cone — expressive, leaf-like
          body = new THREE.Group();
          var up = new THREE.Mesh(new THREE.ConeGeometry(s * 0.9, s * arch.stretchY, 16), bodyMat());
          var dn = new THREE.Mesh(new THREE.ConeGeometry(s * 0.9, s * arch.stretchY * 0.55, 16), bodyMat(0.8, 0.8));
          dn.rotation.z = Math.PI;
          dn.position.y = -s * arch.stretchY * 0.5;
          body.add(up); body.add(dn);
          break;
        }
        case 'satellite': {
          body = new THREE.Mesh(new THREE.SphereGeometry(s * 0.85, 24, 24), bodyMat());
          // Moon count tracks fan-in — more dependents = more orbiting moons.
          var moonN = 1 + Math.min(3, Math.floor(fanIn / 2));
          for (var mn = 0; mn < moonN; mn++) {
            var moonAng = (mn / moonN) * Math.PI * 2 + (seed % 100) / 100;
            var moonR = s * (1.6 + (mn % 2) * 0.4);
            var moon = new THREE.Mesh(
              new THREE.SphereGeometry(s * (0.28 + (mn % 3) * 0.05), 16, 16),
              bodyMat(1.0, 1.4)
            );
            moon.position.set(Math.cos(moonAng) * moonR, (mn - moonN / 2) * s * 0.4, Math.sin(moonAng) * moonR);
            body.add(moon);
          }
          break;
        }
        case 'moon': {
          body = new THREE.Mesh(new THREE.SphereGeometry(s * 0.95, 24, 24), bodyMat());
          var orb = new THREE.Mesh(new THREE.TorusGeometry(s * 1.5, s * 0.06, 8, 32), basicMat(0.55));
          orb.rotation.x = Math.PI * 0.35;
          orb.rotation.z = Math.PI * 0.15;
          body.add(orb);
          break;
        }
        case 'wavering': {
          // Voice: ripple count scales with fan-out (things it speaks to).
          body = new THREE.Mesh(new THREE.SphereGeometry(s * 0.9, 24, 24), bodyMat());
          var waveN = 2 + Math.min(4, Math.floor(fanOut / 3));
          for (var w = 1; w <= waveN; w++) {
            var wave = new THREE.Mesh(
              new THREE.TorusGeometry(s * (0.9 + w * 0.3), s * 0.05, 8, 48),
              basicMat(0.5 - w * 0.07)
            );
            wave.rotation.x = Math.PI / 2;
            wave.userData.isWave = true;
            wave.userData.wavePhase = w * 0.5 + ((seed >> w) % 100) / 100;
            body.add(wave);
          }
          break;
        }
        case 'cluster': {
          // Harvest: mote count scales with fan-out (things it pulls data from).
          body = new THREE.Mesh(new THREE.SphereGeometry(s * 0.85, 20, 20), bodyMat());
          var moteN = 4 + Math.min(8, Math.floor(fanOut * 0.8));
          for (var m = 0; m < moteN; m++) {
            var mseed = (seed + m * 97) | 0;
            var mote = new THREE.Mesh(
              new THREE.SphereGeometry(s * (0.14 + ((mseed % 10) / 50)), 8, 8),
              new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: dim ? 0.05 : 0.6 })
            );
            var ang = (m / moteN) * Math.PI * 2 + (mseed % 100) / 100;
            var mr = s * (1.4 + ((mseed >> 4) % 50) / 80);
            mote.position.set(Math.cos(ang) * mr, ((mseed >> 8) % 100 - 50) / 50 * s * 0.9, Math.sin(ang) * mr);
            body.add(mote);
          }
          break;
        }
        case 'spiked': {
          // Orchestrator/ward: spike count = 4 + fan-out (how many things it calls into).
          body = new THREE.Mesh(new THREE.SphereGeometry(s * 0.95, 24, 24), bodyMat());
          var spikeCount = 4 + Math.min(14, Math.floor(fanOut * 0.6));
          for (var k = 0; k < spikeCount; k++) {
            var spike = new THREE.Mesh(
              new THREE.ConeGeometry(s * 0.16, s * (1.0 + ((seed + k * 31) % 100) / 120), 6),
              bodyMat(0.9, 1.2)
            );
            var a1 = (k / spikeCount) * Math.PI * 2;
            var a2 = ((seed + k * 17) % 100 - 50) / 50 * 0.9;
            spike.position.set(Math.cos(a1) * s * 1.3, a2 * s, Math.sin(a1) * s * 1.3);
            spike.lookAt(spike.position.x * 2, spike.position.y * 2, spike.position.z * 2);
            body.add(spike);
          }
          break;
        }
        case 'crystal': {
          body = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.95, 0), bodyMat(1, 1.2));
          break;
        }
        case 'hex': {
          body = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.8, s * 0.8, s * arch.stretchY, 6), bodyMat());
          break;
        }
        case 'cube': {
          body = new THREE.Mesh(new THREE.BoxGeometry(s * 1.1, s * 1.1, s * 1.1), bodyMat(0.9, 0.9));
          break;
        }
        case 'swarm': {
          // Files with many tiny imports — a buzzing cloud of motes.
          body = new THREE.Group();
          var cnt = 12 + Math.min(24, fanOut * 2);
          for (var sw = 0; sw < cnt; sw++) {
            var sseed = (seed + sw * 131) | 0;
            var swAng = (sw / cnt) * Math.PI * 2 + (sseed % 100) / 100;
            var swR = s * (0.8 + ((sseed >> 3) % 100) / 80);
            var swY = ((sseed >> 7) % 100 - 50) / 50 * s * 1.4;
            var mote = new THREE.Mesh(
              new THREE.SphereGeometry(s * 0.18, 8, 8),
              new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: dim ? 0.1 : 0.85 })
            );
            mote.position.set(Math.cos(swAng) * swR, swY, Math.sin(swAng) * swR);
            body.add(mote);
          }
          break;
        }
        case 'torusknot': {
          // Tangled files — TorusKnot geometry, complex overlapping
          body = new THREE.Mesh(
            new THREE.TorusKnotGeometry(s * 1.1, s * 0.28, 96, 12, 3, 4),
            bodyMat(1.0, 1.3)
          );
          break;
        }
        case 'ghost': {
          // Isolated files — wireframe ghost, see-through, nobody talks to it.
          body = new THREE.Group();
          var hull = new THREE.Mesh(
            new THREE.IcosahedronGeometry(s * 0.95, 1),
            new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: dim ? 0.08 : 0.55 })
          );
          body.add(hull);
          var innerDot = new THREE.Mesh(
            new THREE.SphereGeometry(s * 0.22, 10, 10),
            new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: dim ? 0.1 : 0.9 })
          );
          body.add(innerDot);
          break;
        }
        case 'tower': {
          // Big self-contained files — stacked tori like a ziggurat.
          body = new THREE.Group();
          var floors = 4 + Math.min(5, Math.floor(s / 4));
          for (var ft = 0; ft < floors; ft++) {
            var radius = s * (1.2 - ft * 0.14);
            var ring = new THREE.Mesh(
              new THREE.TorusGeometry(radius, s * 0.14, 12, 40),
              bodyMat(1.0, 1.0 - ft * 0.12)
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.y = (ft - (floors - 1) / 2) * s * 0.55;
            body.add(ring);
          }
          break;
        }
        case 'shards': {
          // Broken but load-bearing — scattered sharp fragments.
          body = new THREE.Group();
          var pieces = 10 + Math.min(6, Math.floor(fanIn / 2));
          for (var sh = 0; sh < pieces; sh++) {
            var shseed = (seed + sh * 193) | 0;
            var shard = new THREE.Mesh(
              new THREE.TetrahedronGeometry(s * (0.35 + ((shseed >> 2) % 50) / 150), 0),
              bodyMat(0.9, 1.2)
            );
            var shAng = (sh / pieces) * Math.PI * 2 + (shseed % 100) / 200;
            var shR = s * (0.9 + ((shseed >> 5) % 80) / 100);
            shard.position.set(Math.cos(shAng) * shR, ((shseed >> 10) % 100 - 50) / 50 * s * 0.9, Math.sin(shAng) * shR);
            shard.rotation.set(
              ((shseed >> 1) % 628) / 100,
              ((shseed >> 4) % 628) / 100,
              ((shseed >> 7) % 628) / 100
            );
            body.add(shard);
          }
          break;
        }
        case 'tentacles': {
          // Big orphan leviathans — central sphere with curving tube arms.
          body = new THREE.Group();
          body.add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.85, 18, 18), bodyMat()));
          var arms = 5 + ((seed >> 8) % 4);
          for (var ta = 0; ta < arms; ta++) {
            var aseed = (seed + ta * 211) | 0;
            var angle = (ta / arms) * Math.PI * 2;
            var tipY = ((aseed % 100) - 50) / 50 * s * 1.3;
            var curve = new THREE.CatmullRomCurve3([
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(Math.cos(angle) * s * 0.9, ((aseed >> 3) % 80 - 40) / 40 * s * 0.4, Math.sin(angle) * s * 0.9),
              new THREE.Vector3(Math.cos(angle) * s * 1.8, tipY * 0.6, Math.sin(angle) * s * 1.8),
              new THREE.Vector3(Math.cos(angle) * s * 2.4, tipY, Math.sin(angle) * s * 2.4)
            ]);
            var arm = new THREE.Mesh(
              new THREE.TubeGeometry(curve, 24, s * 0.12, 8, false),
              bodyMat(0.9, 1.1)
            );
            body.add(arm);
          }
          break;
        }
        case 'helix': {
          // Glue/hook/context files — coiled spiral.
          body = new THREE.Group();
          var coils = 3;
          var turnsPts = [];
          var pts = 60;
          for (var hp = 0; hp <= pts; hp++) {
            var ht = hp / pts;
            var hAngle = ht * Math.PI * 2 * coils;
            turnsPts.push(new THREE.Vector3(
              Math.cos(hAngle) * s * 0.8,
              (ht - 0.5) * s * arch.stretchY,
              Math.sin(hAngle) * s * 0.8
            ));
          }
          var helixCurve = new THREE.CatmullRomCurve3(turnsPts);
          var helixTube = new THREE.Mesh(
            new THREE.TubeGeometry(helixCurve, 120, s * 0.14, 8, false),
            bodyMat(1.0, 1.2)
          );
          body.add(helixTube);
          break;
        }
        case 'starburst': {
          // Well-tested + central — a radiant explosion of lines.
          body = new THREE.Group();
          body.add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.55, 16, 16), bodyMat(1.0, 1.4)));
          var rays = 14 + ((seed >> 6) % 8);
          for (var rn = 0; rn < rays; rn++) {
            var raySeed = (seed + rn * 157) | 0;
            var rangle1 = (rn / rays) * Math.PI * 2;
            var rangle2 = ((raySeed % 100) - 50) / 50;
            var len = s * (1.8 + ((raySeed >> 3) % 60) / 100);
            var ray = new THREE.Mesh(
              new THREE.CylinderGeometry(s * 0.04, s * 0.01, len, 5),
              bodyMat(1.0, 1.5)
            );
            ray.position.set(
              Math.cos(rangle1) * len * 0.5,
              Math.sin(rangle2) * len * 0.5,
              Math.sin(rangle1) * len * 0.5
            );
            ray.lookAt(ray.position.x * 2, ray.position.y * 2, ray.position.z * 2);
            ray.rotateX(Math.PI / 2);
            body.add(ray);
          }
          break;
        }
        case 'scroll': {
          // Lore landmark: tall translucent prism-book with a glowing spine
          body = new THREE.Group();
          var book = new THREE.Mesh(
            new THREE.BoxGeometry(s * 0.9, s * arch.stretchY, s * 1.6),
            new THREE.MeshPhongMaterial({
              color: col, transparent: true,
              opacity: dim ? 0.08 : 0.65,
              emissive: col,
              emissiveIntensity: dim ? 0.1 : 0.9,
              shininess: 200
            })
          );
          body.add(book);
          var spine = new THREE.Mesh(
            new THREE.BoxGeometry(s * 0.18, s * arch.stretchY * 1.05, s * 0.2),
            new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: dim ? 0.1 : 0.95 })
          );
          spine.position.set(s * 0.46, 0, 0);
          body.add(spine);
          // Soft corona
          var corona = new THREE.Mesh(
            new THREE.SphereGeometry(s * 1.6, 16, 16),
            new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.08, side: THREE.BackSide })
          );
          body.add(corona);
          break;
        }
        default: { // sphere
          body = new THREE.Mesh(new THREE.SphereGeometry(s * 0.9, 24, 24), bodyMat());
        }
      }
      group.add(body);

      // Lore landmarks get a persistent title sprite floating above them.
      if (node.type === 'article' && !dim) {
        var lc = document.createElement('canvas');
        lc.width = 1024; lc.height = 256;
        var lx = lc.getContext('2d');
        var lg = lx.createRadialGradient(512, 128, 12, 512, 128, 420);
        lg.addColorStop(0, 'rgba(196,181,253,0.55)');
        lg.addColorStop(1, 'rgba(196,181,253,0)');
        lx.fillStyle = lg;
        lx.fillRect(0, 0, 1024, 256);
        lx.font = 'bold 72px -apple-system, Inter, sans-serif';
        lx.textAlign = 'center';
        lx.textBaseline = 'middle';
        lx.shadowColor = '#c4b5fd';
        lx.shadowBlur = 30;
        lx.fillStyle = '#ffffff';
        var ttl = (node.label || '').slice(0, 36);
        lx.fillText(ttl, 512, 120);
        lx.shadowBlur = 6;
        lx.font = '28px -apple-system, Inter, sans-serif';
        lx.fillStyle = '#c4b5fd';
        lx.fillText('LORE · ' + String(node.status || '').toUpperCase(), 512, 200);
        var ltex = new THREE.CanvasTexture(lc);
        ltex.needsUpdate = true;
        var lsprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ltex, transparent: true, depthWrite: false }));
        lsprite.scale.set(s * 10, s * 2.5, 1);
        lsprite.position.y = s * arch.stretchY * 0.55 + s * 2.2;
        group.add(lsprite);
      }

      // Accent rings — how many depends on the archetype
      if (!dim) {
        for (var r = 0; r < arch.rings; r++) {
          var ring = new THREE.Mesh(
            new THREE.TorusGeometry(s * (1.6 + r * 0.3), s * 0.07, 12, 48),
            basicMat(0.55 - r * 0.12)
          );
          ring.rotation.x = Math.PI / 2 + (r % 2 ? 0.3 : -0.3);
          ring.rotation.z = r * 0.4;
          group.add(ring);
        }

        // THREE-LAYER AURA — inner bright halo, mid glow, outer far-field bloom.
        var halo = new THREE.Mesh(
          new THREE.SphereGeometry(s * 1.7 * arch.glow, 20, 20),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, side: THREE.BackSide, depthWrite: false })
        );
        group.add(halo);
        var halo2 = new THREE.Mesh(
          new THREE.SphereGeometry(s * 2.6 * arch.glow, 16, 16),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.09, side: THREE.BackSide, depthWrite: false })
        );
        group.add(halo2);
        var halo3 = new THREE.Mesh(
          new THREE.SphereGeometry(s * 3.8 * arch.glow, 12, 12),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.035, side: THREE.BackSide, depthWrite: false })
        );
        group.add(halo3);

        // Heavy nodes cast actual colored light on their neighbors — they're planets.
        if ((node.centrality || 0) > 4 || node.isHotPath) {
          var pointLight = new THREE.PointLight(parseInt(col.replace('#', ''), 16), 1.1, s * 22, 2);
          group.add(pointLight);
        }

        // HOT-PATH: double golden ruby crown rings (independent of archetype)
        if (node.isHotPath || conns > 6) {
          for (var h = 0; h < 2; h++) {
            var crown = new THREE.Mesh(
              new THREE.TorusGeometry(s * (2.4 + h * 0.3), s * 0.08, 10, 48),
              new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85 - h * 0.3 })
            );
            crown.rotation.x = Math.PI / 2 + (h ? -0.35 : 0.35);
            crown.rotation.z = h ? -0.2 : 0.2;
            group.add(crown);
          }
        }

        // TEST WITNESS: gold shimmer ring that rotates
        if (isTest) {
          var shimmer = new THREE.Mesh(
            new THREE.TorusGeometry(s * 1.7, s * 0.04, 8, 48),
            new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.55 })
          );
          shimmer.userData.isShimmer = true;
          shimmer.userData.shimmerSeed = Math.random() * Math.PI * 2;
          shimmer.rotation.x = Math.random() * Math.PI;
          shimmer.rotation.z = Math.random() * Math.PI;
          group.add(shimmer);
        }

        // BUG PULSE: mark the halo to pulse
        if (isBug) {
          halo.userData.isPulse = true;
          halo.userData.baseOpacity = 0.22;
          halo.userData.pulsePhase = Math.random() * Math.PI * 2;
          halo2.userData.isPulse = true;
          halo2.userData.baseOpacity = 0.09;
          halo2.userData.pulsePhase = halo.userData.pulsePhase;
        }

        // LANDMARK LABEL — big / hot-path / entry files wear their name always.
        if (node.type !== 'article') {
          var showLabel = s > 11 || node.isHotPath || node.isEntry || (node.centrality || 0) > 5;
          if (showLabel) {
            var subtext = (node.directory || '').split('/').slice(0, 2).join('/')
              + ' · ' + (node.lineCount || 0) + ' lines';
            var labelColor = node.biomeAccentHex || node.color || '#ffffff';
            var labelSprite = makeTextSprite(node.label, labelColor, subtext, { mainSize: node.isHotPath ? 86 : 64, subSize: 26 });
            var lscale = Math.max(s * 7, 70);
            labelSprite.scale.set(lscale, lscale * 0.25, 1);
            labelSprite.position.y = s * arch.stretchY * 0.55 + s * 1.8 + 4;
            labelSprite.userData.isLabel = true;
            group.add(labelSprite);
          }
        }
      }

      return group;
    })
    .nodeThreeObjectExtend(false)
    // Two link types share this pipeline:
    //   'import' — source depends on target; particles flow importer → importee
    //   'lore'   — article mentions file; soft lavender threads, slow drift
    .linkColor(function(link) {
      if (link.type === 'lore') return '#c4b5fd';
      var src = typeof link.source === 'object' ? link.source : null;
      if (!src) {
        var id = typeof link.source === 'string' ? link.source : null;
        src = id ? data.nodes.find(function(n) { return n.id === id; }) : null;
      }
      return src ? src.color : '#8899aa';
    })
    .linkWidth(function(link) {
      if (link.type === 'lore') return 0.8;
      var src = typeof link.source === 'object' ? link.source : null;
      var tgt = typeof link.target === 'object' ? link.target : null;
      var hot = (src && src.isHotPath) || (tgt && tgt.isHotPath);
      return hot ? 2.4 : 1.2;
    })
    .linkOpacity(0.55)
    .linkDirectionalParticles(function(link) {
      if (link.type === 'lore') return 1;
      var src = typeof link.source === 'object' ? link.source : null;
      var tgt = typeof link.target === 'object' ? link.target : null;
      var hot = (src && src.isHotPath) || (tgt && tgt.isHotPath);
      var busy = tgt && (tgt.centrality || 0) > 5;
      return hot ? 6 : (busy ? 4 : 2);
    })
    .linkDirectionalParticleSpeed(function(link) {
      if (link.type === 'lore') return 0.0025;
      var tgt = typeof link.target === 'object' ? link.target : null;
      var c = tgt ? (tgt.centrality || 0) : 0;
      return 0.004 + Math.min(c, 15) * 0.0008;
    })
    .linkDirectionalParticleWidth(function(link) {
      if (link.type === 'lore') return 1.4;
      var src = typeof link.source === 'object' ? link.source : null;
      var tgt = typeof link.target === 'object' ? link.target : null;
      var hot = (src && src.isHotPath) || (tgt && tgt.isHotPath);
      return hot ? 3.2 : 2;
    })
    .linkDirectionalParticleColor(function(link) {
      if (link.type === 'lore') return '#e9d5ff';
      var src = typeof link.source === 'object' ? link.source : null;
      if (!src) {
        var id = typeof link.source === 'string' ? link.source : null;
        src = id ? data.nodes.find(function(n) { return n.id === id; }) : null;
      }
      return src ? src.color : '#aabbcc';
    })
    .onNodeHover(function(node) {
      container.style.cursor = node ? 'pointer' : 'grab';
      if (!node) {
        tooltip.classList.remove('visible');
        return;
      }
      tooltip.classList.add('visible');
      tooltip.style.setProperty('--tt-color', node.color);

      var archLabel = node.archetype && node.archetype.desc ? node.archetype.desc : '';
      if (node.type === 'article') {
        tooltip.innerHTML =
          '<div class="bw-3d-tooltip-category" style="color: ' + node.color + '">LORE · ' + escapeHTML(String(node.status || '').toUpperCase()) + '</div>' +
          '<div class="bw-3d-tooltip-title">' + escapeHTML(node.label) + '</div>' +
          '<div class="bw-3d-tooltip-meta">' +
            '<div style="margin-bottom: 6px;">' + escapeHTML(String(node.excerpt || '')) + (node.excerpt && node.excerpt.length >= 250 ? '…' : '') + '</div>' +
            '<div>' + node.lineCount + ' words · mentions ' + node.imports + ' files · confidence ' + escapeHTML(String(node.confidence || '—')) + '</div>' +
            '<div style="color: rgba(255,255,255,0.4); margin-top: 4px;">' + escapeHTML(String(node.category || '')) + '</div>' +
          '</div>' +
          '<div class="bw-3d-tooltip-hint">Click to focus · Double-click to open article</div>';
      } else {
        var crown = node.isHotPath ? '  ♦ hot path' : '';
        tooltip.innerHTML =
          '<div class="bw-3d-tooltip-category" style="color: ' + node.color + '">' +
            escapeHTML(node.healthLabel.toUpperCase()) + ' · ' + escapeHTML(archLabel) + crown +
          '</div>' +
          '<div class="bw-3d-tooltip-title">' + escapeHTML(node.label) + '</div>' +
          '<div class="bw-3d-tooltip-meta">' +
            '<div>' + node.lineCount + ' lines</div>' +
            '<div>' + node.imports + ' imports · ' + node.importedBy + ' imported by</div>' +
            '<div style="color: rgba(255,255,255,0.4); margin-top: 4px;">' + escapeHTML(node.directory) + '</div>' +
          '</div>' +
          '<div class="bw-3d-tooltip-hint">Click to focus · Double-click to open panel';
        // Extra hint: show the wiki links attached to this file if any
        var loreLinks = (data.links || []).filter(function(l) {
          var sid = typeof l.source === 'object' ? l.source.id : l.source;
          var tid = typeof l.target === 'object' ? l.target.id : l.target;
          return l.type === 'lore' && tid === node.id;
        }).length;
        if (loreLinks > 0) {
          tooltip.innerHTML += ' · <span style="color:#c4b5fd">' + loreLinks + ' lore scroll' + (loreLinks === 1 ? '' : 's') + '</span>';
        }
        tooltip.innerHTML += '</div>';
      }
    })
    .onNodeClick(function(node) {
      // Double-click detection: second click on same node within 400ms opens the panel.
      // Single click still flies + highlights immediately.
      var now = Date.now();
      if (lastClickNode === node && (now - lastClickTime) < 400) {
        lastClickNode = null;
        lastClickTime = 0;
        if (node.type === 'article' && node.url) {
          window.location.href = node.url;
        } else {
          openFilePanel(node);
        }
        return;
      }
      lastClickNode = node;
      lastClickTime = now;

      if (selectedNode === node) {
        selectedNode = null;
        focusedNodes = null;
      } else {
        selectedNode = node;
        focusedNodes = new Set([node.id]);
        var conns = nodeConnections[node.id] || new Set();
        conns.forEach(function(id) { focusedNodes.add(id); });
        var target = { x: node.x || 0, y: node.y || 0, z: node.z || 0 };
        var offset = new THREE.Vector3().subVectors(camera.position, controls.target);
        if (offset.lengthSq() < 1) offset.set(0, 0, 1);
        offset.setLength(180);
        controls.autoRotate = false;
        Graph.cameraPosition(
          { x: target.x + offset.x, y: target.y + offset.y, z: target.z + offset.z },
          target,
          1000
        );
      }
      Graph.nodeThreeObject(Graph.nodeThreeObject());
    })
    .onBackgroundClick(function() {
      selectedNode = null;
      focusedNodes = null;
      Graph.nodeThreeObject(Graph.nodeThreeObject());
      recenterToOrigin(700);
      setTimeout(function() {
        if (!selectedNode && !focusedNodes) controls.autoRotate = true;
      }, 760);
    });

  // Add data
  Graph.graphData(data);

  // Tune the built-in d3-force-3d simulation so nodes spread volumetrically in x/y/z.
  // Stronger repulsion + longer links + a 3D radial force push nodes off the z=0 plane.
  // Way more spacious — stronger repulsion, longer links, nodes breathe.
  Graph.d3Force('charge').strength(-560).distanceMax(1600);
  Graph.d3Force('link')
    .distance(function(link) {
      if (link.type === 'lore') return 340;
      var s = typeof link.source === 'object' ? link.source : null;
      var t = typeof link.target === 'object' ? link.target : null;
      var sameDir = s && t && s.directory === t.directory;
      return sameDir ? 95 : 175;
    })
    .strength(function(link) {
      if (link.type === 'lore') return 0.035;
      return 0.22;
    });
  // Weaker radial — cluster inflates to a bigger volumetric sphere.
  Graph.d3Force('radial', function(alpha) {
    var k = 0.018 * alpha;
    data.nodes.forEach(function(n) {
      if (n.type === 'article') return;
      var x = n.x || 0, y = n.y || 0, z = n.z || 0;
      var r = Math.sqrt(x * x + y * y + z * z) || 1;
      var targetR = 480;
      var f = (targetR - r) / r * k;
      n.vx = (n.vx || 0) + x * f;
      n.vy = (n.vy || 0) + y * f;
      n.vz = (n.vz || 0) + z * f;
    });
  });

  // === FOLDER BOUNDARIES: nodes snap to their folder's region ===
  // Each top-level folder (backend/, frontend/, autocall/, scraper/...) gets
  // its own anchor on a ring in 3D space. A per-frame pull keeps files inside
  // their folder's zone — bubbles no longer overlap. Within a zone, the import
  // graph and chaos archetypes still determine layout freely.
  var folderKeys = [];
  data.nodes.forEach(function(n) {
    if (n.type === 'article') return;
    var top = (n.directory || '').split('/')[0];
    if (top && folderKeys.indexOf(top) === -1) folderKeys.push(top);
  });
  folderKeys.sort();
  var folderAnchors = {};
  var FOLDER_R = 600;
  folderKeys.forEach(function(fk, i) {
    var angle = (Math.PI * 2 * i) / folderKeys.length - Math.PI / 2;
    var yStag = (i % 2 === 0 ? 1 : -1) * 100;
    folderAnchors[fk] = {
      x: Math.cos(angle) * FOLDER_R,
      y: yStag,
      z: Math.sin(angle) * FOLDER_R
    };
  });
  // Seed positions near the anchor so sim starts in the right zone.
  data.nodes.forEach(function(n) {
    if (n.type === 'article') return;
    var top = (n.directory || '').split('/')[0];
    var a = folderAnchors[top];
    if (!a) return;
    n.x = a.x + (Math.random() - 0.5) * 160;
    n.y = a.y + (Math.random() - 0.5) * 160;
    n.z = a.z + (Math.random() - 0.5) * 160;
  });
  // Per-frame pull toward folder anchor — strong enough to guarantee separation.
  Graph.d3Force('folderAnchor', function(alpha) {
    var k = 0.10 * alpha;
    data.nodes.forEach(function(n) {
      if (n.type === 'article') return;
      var top = (n.directory || '').split('/')[0];
      var a = folderAnchors[top];
      if (!a) return;
      n.vx = (n.vx || 0) + (a.x - (n.x || 0)) * k;
      n.vy = (n.vy || 0) + (a.y - (n.y || 0)) * k;
      n.vz = (n.vz || 0) + (a.z - (n.z || 0)) * k;
    });
  });

  // GRAVITY WELLS: massive files (high mass) pull smaller nearby files toward
  // them with inverse-square attraction. Orchestrators become solar systems,
  // utilities become asteroids that drift in their pull.
  var wells = data.nodes.filter(function(n) { return n.type !== 'article' && (n.mass || 0) > 16; });
  Graph.d3Force('wells', function(alpha) {
    if (wells.length === 0) return;
    var k = 0.04 * alpha;
    data.nodes.forEach(function(n) {
      if (n.type === 'article') return;
      var nx = n.x || 0, ny = n.y || 0, nz = n.z || 0;
      for (var i = 0; i < wells.length; i++) {
        var w = wells[i];
        if (w === n) continue;
        var dx = (w.x || 0) - nx;
        var dy = (w.y || 0) - ny;
        var dz = (w.z || 0) - nz;
        var d2 = dx*dx + dy*dy + dz*dz + 500; // soften at close range
        var d = Math.sqrt(d2);
        var f = (k * w.mass) / d2;
        n.vx = (n.vx || 0) + (dx / d) * f;
        n.vy = (n.vy || 0) + (dy / d) * f;
        n.vz = (n.vz || 0) + (dz / d) * f;
      }
    });
  });

  // GALACTIC SWIRL: slow tangential spin around the Y axis so the whole park
  // drifts like a spiral galaxy. Articles on the outer ring spin faster.
  Graph.d3Force('swirl', function(alpha) {
    var k = 0.004 * alpha;
    data.nodes.forEach(function(n) {
      var x = n.x || 0, z = n.z || 0;
      var r = Math.sqrt(x*x + z*z) || 1;
      var mult = n.type === 'article' ? 1.6 : 1.0;
      n.vx = (n.vx || 0) + (-z / r) * k * mult;
      n.vz = (n.vz || 0) + (x / r) * k * mult;
    });
  });

  // Setup scene
  var scene = Graph.scene();
  var camera = Graph.camera();
  var renderer = Graph.renderer();

  // Enable better rendering
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // === BACKGROUND PHYSICS: dust field pulled by gravity, colored by biome. ===
  // 1000 particles drift across space. Each frame, the same gravity wells that
  // shape the node layout tug the particles toward them. You see the gravity.
  var DUST_COUNT = 1000;
  var dustPositions = new Float32Array(DUST_COUNT * 3);
  var dustVelocities = new Float32Array(DUST_COUNT * 3);
  var dustColors = new Float32Array(DUST_COUNT * 3);
  var biomeHex01 = {
    volcano: hexTo01(BIOMES.volcano.accent),
    water:   hexTo01(BIOMES.water.accent),
    ice:     hexTo01(BIOMES.ice.accent),
    space:   hexTo01(BIOMES.space.accent),
    jungle:  hexTo01(BIOMES.jungle.accent),
    beach:   hexTo01(BIOMES.beach.accent),
    aurora:  hexTo01(BIOMES.aurora.accent)
  };
  for (var di = 0; di < DUST_COUNT; di++) {
    // Distributed in a spherical shell of radius 200..900
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(2 * Math.random() - 1);
    var r = 200 + Math.random() * 700;
    dustPositions[di * 3]     = r * Math.sin(phi) * Math.cos(theta);
    dustPositions[di * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    dustPositions[di * 3 + 2] = r * Math.cos(phi);
    dustVelocities[di * 3] = dustVelocities[di * 3 + 1] = dustVelocities[di * 3 + 2] = 0;
    var biomeKey = ['space','water','ice','volcano','jungle','beach','aurora'][di % 7];
    var bc = biomeHex01[biomeKey];
    dustColors[di * 3]     = bc[0];
    dustColors[di * 3 + 1] = bc[1];
    dustColors[di * 3 + 2] = bc[2];
  }
  var dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));
  var dustMat = new THREE.PointsMaterial({
    size: 2.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var stars = new THREE.Points(dustGeo, dustMat);
  scene.add(stars);

  // Background physics: integrate each particle under gravity from massive nodes.
  // This runs in the animation loop. Cheap: only the top-K wells, and a single
  // pass per particle per frame.
  var dustMaxR = 1100;
  var dustMinR = 60;
  function stepDustPhysics() {
    if (wells.length === 0) return;
    var dt = 0.55;
    var drag = 0.985;
    var Gconst = 6;
    var kMax = Math.min(wells.length, 10);
    var pos = dustGeo.attributes.position.array;
    var col = dustGeo.attributes.color.array;
    for (var i = 0; i < DUST_COUNT; i++) {
      var px = pos[i*3], py = pos[i*3+1], pz = pos[i*3+2];
      var ax = 0, ay = 0, az = 0;
      // Gravity from the K heaviest nodes
      for (var w = 0; w < kMax; w++) {
        var ww = wells[w];
        var dx = (ww.x || 0) - px, dy = (ww.y || 0) - py, dz = (ww.z || 0) - pz;
        var d2 = dx*dx + dy*dy + dz*dz + 900;
        var d = Math.sqrt(d2);
        var f = (Gconst * (ww.mass || 5)) / d2;
        ax += (dx / d) * f;
        ay += (dy / d) * f;
        az += (dz / d) * f;
      }
      // Integrate
      dustVelocities[i*3]   = dustVelocities[i*3]   * drag + ax * dt;
      dustVelocities[i*3+1] = dustVelocities[i*3+1] * drag + ay * dt;
      dustVelocities[i*3+2] = dustVelocities[i*3+2] * drag + az * dt;
      px += dustVelocities[i*3]   * dt;
      py += dustVelocities[i*3+1] * dt;
      pz += dustVelocities[i*3+2] * dt;
      // Recycle to outer shell if captured or escaped
      var dr = Math.sqrt(px*px + py*py + pz*pz);
      if (dr < dustMinR || dr > dustMaxR) {
        var th = Math.random() * Math.PI * 2;
        var ph = Math.acos(2 * Math.random() - 1);
        var nr = dustMaxR - Math.random() * 200;
        px = nr * Math.sin(ph) * Math.cos(th);
        py = nr * Math.sin(ph) * Math.sin(th) * 0.7;
        pz = nr * Math.cos(ph);
        dustVelocities[i*3] = dustVelocities[i*3+1] = dustVelocities[i*3+2] = 0;
      }
      pos[i*3]   = px;
      pos[i*3+1] = py;
      pos[i*3+2] = pz;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  // === ORIGIN BEACON: a slow-rotating sigil-ring at world center ===
  // Marks the park's heart — visible from anywhere, your anchor when lost.
  var beacon = new THREE.Group();
  var beaconOuter = new THREE.Mesh(
    new THREE.TorusGeometry(38, 0.9, 20, 96),
    new THREE.MeshBasicMaterial({ color: 0xe9d5ff, transparent: true, opacity: 0.55 })
  );
  beaconOuter.rotation.x = Math.PI / 2;
  beacon.add(beaconOuter);
  var beaconInner = new THREE.Mesh(
    new THREE.TorusGeometry(22, 0.4, 16, 72),
    new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.75 })
  );
  beaconInner.rotation.x = Math.PI / 2;
  beaconInner.rotation.z = 0.2;
  beacon.add(beaconInner);
  // Vertical beam — the column of light at origin
  var beaconBeamMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.12 });
  var beaconBeam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 400, 12), beaconBeamMat);
  beacon.add(beaconBeam);
  // Three tiny orbiting motes, marking the "gate"
  for (var bm = 0; bm < 3; bm++) {
    var mote = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.9 })
    );
    var ang = (bm / 3) * Math.PI * 2;
    mote.position.set(Math.cos(ang) * 38, 0, Math.sin(ang) * 38);
    mote.userData.beaconMote = bm;
    beacon.add(mote);
  }
  beacon.userData.isBeacon = true;
  scene.add(beacon);

  // Ambient light - slightly purple tint for atmosphere
  scene.add(new THREE.AmbientLight(0x6060a0, 0.8));

  // Key light from above
  var keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
  keyLight.position.set(50, 200, 100);
  scene.add(keyLight);

  // Fill light from below - subtle
  var fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
  fillLight.position.set(-50, -100, -50);
  scene.add(fillLight);

  // Point lights at graph center for glow effect
  var centerLight = new THREE.PointLight(0x6688cc, 0.4, 500);
  centerLight.position.set(0, 0, 0);
  scene.add(centerLight);

  // === FOLDER BUBBLES ===
  // Each top-level directory gets a translucent wireframe sphere enclosing its
  // files, plus a giant floating sign. You always know which region you're in.
  var folderGroups = {};
  data.nodes.forEach(function(n) {
    if (n.type === 'article') return;
    var parts = (n.directory || '').split('/');
    var top = parts[0];
    if (!top) return;
    if (!folderGroups[top]) folderGroups[top] = { name: top, nodes: [] };
    folderGroups[top].nodes.push(n);
  });
  // Pick a representative biome color per folder (most common across its files)
  function folderTint(grp) {
    var tally = {};
    grp.nodes.forEach(function(n) { tally[n.biome] = (tally[n.biome] || 0) + 1; });
    var best = 'space', bestC = 0;
    for (var bk in tally) { if (tally[bk] > bestC) { bestC = tally[bk]; best = bk; } }
    return (BIOMES[best] || BIOMES.space);
  }
  var folderObjects = [];
  Object.keys(folderGroups).forEach(function(key) {
    var grp = folderGroups[key];
    if (grp.nodes.length < 3) return;
    var tint = folderTint(grp);
    var tintHex = '#' + tint.primary.toString(16).padStart(6, '0');
    var tintAccentHex = '#' + tint.accent.toString(16).padStart(6, '0');

    var bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1, 28, 20),
      new THREE.MeshBasicMaterial({
        color: tint.accent, transparent: true, opacity: 0.035,
        side: THREE.BackSide, depthWrite: false
      })
    );
    var wire = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({
        color: tint.accent, transparent: true, opacity: 0.10,
        wireframe: true, depthWrite: false
      })
    );
    var label = makeTextSprite(
      key.toUpperCase(),
      tintAccentHex,
      grp.nodes.length + ' files · ' + tint.desc,
      { mainSize: 128, subSize: 36, mainShadowBlur: 44 }
    );
    label.scale.set(420, 105, 1);
    scene.add(bubble);
    scene.add(wire);
    scene.add(label);
    folderObjects.push({ bubble: bubble, wire: wire, label: label, group: grp, tint: tint });
  });

  // Controls setup (orbit controls, set via the constructor config above)
  var controls = Graph.controls();
  controls.minDistance = 120;
  controls.maxDistance = 2000;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
  controls.autoRotateSpeed = 0.3;

  // === ENTRY CINEMATIC: camera starts far outside the world and flies IN. ===
  // Spawn viewpoint used by the first frame AND by the H key (respawn).
  var SPAWN_FAR_POS = { x: 200, y: 420, z: 1600 };
  var SPAWN_FRAMED_POS = { x: 100, y: 200, z: 700 };
  controls.autoRotate = false;
  Graph.cameraPosition(SPAWN_FAR_POS, { x: 0, y: 0, z: 0 }, 0);

  function flyHome(durationMs) {
    controls.autoRotate = false;
    // Stage 1: dolly in to the framed overview
    Graph.cameraPosition(SPAWN_FRAMED_POS, { x: 0, y: 0, z: 0 }, durationMs || 2000);
    // Stage 2: once settled, zoomToFit so any sim drift is absorbed, then re-arm auto-rotate.
    setTimeout(function() {
      if (selectedNode || focusedNodes) return;
      Graph.zoomToFit(900, 160);
      setTimeout(function() {
        if (!selectedNode && !focusedNodes) controls.autoRotate = true;
      }, 940);
    }, (durationMs || 2000) + 120);
  }
  // First entry: slower + longer for drama
  setTimeout(function() { flyHome(2200); }, 300);

  // True "back to overview" — pull the orbit target back to origin while
  // preserving the current viewing direction, so auto-rotate pivots around the
  // whole cluster rather than around whatever node was last clicked.
  function recenterToOrigin(duration) {
    var offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (offset.lengthSq() < 1) offset.set(0, 80, 700);
    Graph.cameraPosition(
      { x: offset.x, y: offset.y, z: offset.z },
      { x: 0, y: 0, z: 0 },
      duration || 700
    );
  }

  // Every cameraPosition tween fights autoRotate — suspend rotation during the
  // tween and re-arm it after, but only if the user is still in overview state.
  function flyTo(pos, target, duration, reArmRotate) {
    controls.autoRotate = false;
    Graph.cameraPosition(pos, target, duration);
    if (reArmRotate) {
      setTimeout(function() {
        if (!selectedNode && !focusedNodes) controls.autoRotate = true;
      }, duration + 60);
    }
  }

  // Small helper: zoom along the camera→target vector (not toward origin).
  // factor < 1 zooms in, > 1 zooms out.
  function zoomAlongLookAt(factor, duration) {
    var target = controls.target || new THREE.Vector3(0, 0, 0);
    var offset = new THREE.Vector3().subVectors(camera.position, target);
    var currentDist = offset.length();
    var newDist = Math.max(controls.minDistance, Math.min(controls.maxDistance, currentDist * factor));
    offset.setLength(newDist);
    var newPos = new THREE.Vector3().addVectors(target, offset);
    flyTo(
      { x: newPos.x, y: newPos.y, z: newPos.z },
      { x: target.x, y: target.y, z: target.z },
      duration,
      false
    );
  }

  // Stop auto-rotate on user interaction
  container.addEventListener('mousedown', function() {
    controls.autoRotate = false;
  });
  container.addEventListener('touchstart', function() {
    controls.autoRotate = false;
  });

  // Search
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      var q = this.value.trim().toLowerCase();
      if (!q) {
        focusedNodes = null;
        selectedNode = null;
        Graph.nodeThreeObject(Graph.nodeThreeObject());
        recenterToOrigin(700);
        setTimeout(function() {
          if (!selectedNode && !focusedNodes) controls.autoRotate = true;
        }, 760);
        return;
      }
      var matches = data.nodes.filter(function(n) {
        return n.label.toLowerCase().indexOf(q) !== -1 ||
               n.id.toLowerCase().indexOf(q) !== -1 ||
               n.directory.toLowerCase().indexOf(q) !== -1;
      });
      if (matches.length > 0) {
        focusedNodes = new Set(matches.map(function(n) { return n.id; }));
        // Also include connected nodes for context
        matches.forEach(function(m) {
          var conns = nodeConnections[m.id] || new Set();
          conns.forEach(function(id) { focusedNodes.add(id); });
        });
        Graph.nodeThreeObject(Graph.nodeThreeObject());
        controls.autoRotate = false;
        // Fly to first match, preserving current viewing direction
        var first = matches[0];
        var firstTarget = { x: first.x || 0, y: first.y || 0, z: first.z || 0 };
        var sOffset = new THREE.Vector3().subVectors(camera.position, controls.target);
        if (sOffset.lengthSq() < 1) sOffset.set(0, 0, 1);
        sOffset.setLength(200);
        flyTo(
          { x: firstTarget.x + sOffset.x, y: firstTarget.y + sOffset.y, z: firstTarget.z + sOffset.z },
          firstTarget,
          800,
          false
        );
      }
    });
  }

  // Double-click to navigate
  var lastHoveredNode = null;
  var originalOnHover = Graph.onNodeHover();
  Graph.onNodeHover(function(node) {
    lastHoveredNode = node;
    originalOnHover(node);
  });

  // (Double-click detection handled inside onNodeClick via a click-timer.)

  // Tooltip positioning
  container.addEventListener('mousemove', function(e) {
    if (tooltip.classList.contains('visible')) {
      var x = e.clientX + 18;
      var y = e.clientY + 18;
      if (x + tooltip.offsetWidth > window.innerWidth - 20) {
        x = e.clientX - tooltip.offsetWidth - 18;
      }
      if (y + tooltip.offsetHeight > window.innerHeight - 20) {
        y = e.clientY - tooltip.offsetHeight - 18;
      }
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') {
      focusedNodes = null;
      selectedNode = null;
      Graph.nodeThreeObject(Graph.nodeThreeObject());
      recenterToOrigin(700);
      setTimeout(function() {
        if (!selectedNode && !focusedNodes) {
          Graph.zoomToFit(800, 140);
          setTimeout(function() {
            if (!selectedNode && !focusedNodes) controls.autoRotate = true;
          }, 840);
        }
      }, 720);
      if (searchInput) searchInput.value = '';
    }
    if (e.key === '/') {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
    if (e.key === 'h' || e.key === 'H') {
      selectedNode = null;
      focusedNodes = null;
      Graph.nodeThreeObject(Graph.nodeThreeObject());
      flyHome(1400);
      if (searchInput) searchInput.value = '';
    }
  });

  // Handle resize
  window.addEventListener('resize', function() {
    Graph.width(container.clientWidth);
    Graph.height(container.clientHeight);
  });

  // Zoom controls
  var zoomInBtn = document.getElementById('bw-3d-zoom-in');
  var zoomOutBtn = document.getElementById('bw-3d-zoom-out');
  var zoomResetBtn = document.getElementById('bw-3d-zoom-reset');

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', function() { zoomAlongLookAt(0.7, 300); });
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', function() { zoomAlongLookAt(1.4, 300); });
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', function() {
      focusedNodes = null;
      selectedNode = null;
      Graph.nodeThreeObject(Graph.nodeThreeObject());
      recenterToOrigin(700);
      setTimeout(function() {
        if (!selectedNode && !focusedNodes) {
          Graph.zoomToFit(800, 140);
          setTimeout(function() {
            if (!selectedNode && !focusedNodes) controls.autoRotate = true;
          }, 840);
        }
      }, 720);
    });
  }

  // Health filter click handlers
  document.querySelectorAll('.bw-3d-legend-item[data-health]').forEach(function(el) {
    el.addEventListener('click', function() {
      var health = this.dataset.health;
      controls.autoRotate = false;
      if (this.classList.contains('active')) {
        this.classList.remove('active');
        focusedNodes = null;
        recenterToOrigin(700);
        setTimeout(function() {
          if (!selectedNode && !focusedNodes) controls.autoRotate = true;
        }, 760);
      } else {
        document.querySelectorAll('.bw-3d-legend-item[data-health]').forEach(function(item) {
          item.classList.remove('active');
        });
        this.classList.add('active');
        var filtered = data.nodes.filter(function(n) { return n.health === health; });
        focusedNodes = new Set(filtered.map(function(n) { return n.id; }));
        // Also include their connections
        filtered.forEach(function(n) {
          var conns = nodeConnections[n.id] || new Set();
          conns.forEach(function(id) { focusedNodes.add(id); });
        });
        // Fly to centroid of filtered nodes while preserving viewing direction
        if (filtered.length > 0) {
          var avgX = filtered.reduce(function(s, n) { return s + (n.x || 0); }, 0) / filtered.length;
          var avgY = filtered.reduce(function(s, n) { return s + (n.y || 0); }, 0) / filtered.length;
          var avgZ = filtered.reduce(function(s, n) { return s + (n.z || 0); }, 0) / filtered.length;
          var fOffset = new THREE.Vector3().subVectors(camera.position, controls.target);
          if (fOffset.lengthSq() < 1) fOffset.set(0, 0, 1);
          fOffset.setLength(360);
          flyTo(
            { x: avgX + fOffset.x, y: avgY + fOffset.y, z: avgZ + fOffset.z },
            { x: avgX, y: avgY, z: avgZ },
            1000,
            false
          );
        }
      }
      Graph.nodeThreeObject(Graph.nodeThreeObject());
    });
  });

  // === PROJECTLAND: living atmosphere + WASD fly ===
  // WASD = strafe plane, Q/E = down/up, Shift = 3x speed.
  var keysDown = {};
  window.addEventListener('keydown', function(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keysDown[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', function(e) {
    keysDown[e.key.toLowerCase()] = false;
  });
  window.addEventListener('blur', function() { keysDown = {}; });

  var _fwd = new THREE.Vector3();
  var _right = new THREE.Vector3();
  var _up = new THREE.Vector3(0, 1, 0);
  var _desired = new THREE.Vector3();
  var flyVel = new THREE.Vector3(0, 0, 0);
  function flyStep() {
    var maxSpeed = keysDown.shift ? 22 : 8;
    var accelBlend = 0.14;  // how quickly we accelerate toward desired
    var decel = 0.90;       // velocity retained per frame when no keys pressed
    _desired.set(0, 0, 0);
    camera.getWorldDirection(_fwd);
    _right.crossVectors(_fwd, _up).normalize();
    if (keysDown.w) _desired.add(_fwd.clone());
    if (keysDown.s) _desired.add(_fwd.clone().multiplyScalar(-1));
    if (keysDown.d) _desired.add(_right.clone());
    if (keysDown.a) _desired.add(_right.clone().multiplyScalar(-1));
    if (keysDown.e || keysDown[' ']) _desired.y += 1;
    if (keysDown.q) _desired.y -= 1;
    if (_desired.lengthSq() > 0) {
      _desired.normalize().multiplyScalar(maxSpeed);
      flyVel.lerp(_desired, accelBlend);
      controls.autoRotate = false;
    } else {
      flyVel.multiplyScalar(decel);
    }
    if (flyVel.lengthSq() > 0.02) {
      camera.position.add(flyVel);
      controls.target.add(flyVel);
    } else if (flyVel.lengthSq() > 0) {
      flyVel.set(0, 0, 0);
    }
  }

  var tick = 0;
  function animateScene() {
    tick++;
    flyStep();
    // Background physics: integrate every other frame for perf
    if (tick % 2 === 0) stepDustPhysics();
    // Folder bubbles track their cluster's centroid + bounding radius each tick.
    for (var foi = 0; foi < folderObjects.length; foi++) {
      var fo = folderObjects[foi];
      var ns = fo.group.nodes;
      if (!ns.length) continue;
      var cx = 0, cy = 0, cz = 0;
      for (var fi = 0; fi < ns.length; fi++) { cx += ns[fi].x || 0; cy += ns[fi].y || 0; cz += ns[fi].z || 0; }
      cx /= ns.length; cy /= ns.length; cz /= ns.length;
      var maxR2 = 0;
      for (var fj = 0; fj < ns.length; fj++) {
        var dfx = (ns[fj].x || 0) - cx, dfy = (ns[fj].y || 0) - cy, dfz = (ns[fj].z || 0) - cz;
        var r2 = dfx*dfx + dfy*dfy + dfz*dfz;
        if (r2 > maxR2) maxR2 = r2;
      }
      var radius = Math.sqrt(maxR2) + 55;
      fo.bubble.position.set(cx, cy, cz);
      fo.bubble.scale.setScalar(radius);
      fo.wire.position.set(cx, cy, cz);
      fo.wire.scale.setScalar(radius * 1.01);
      fo.wire.rotation.y += 0.0008;
      fo.label.position.set(cx, cy + radius + 38, cz);
    }
    // Beacon rotates and breathes
    beacon.rotation.y += 0.004;
    beaconInner.rotation.z += 0.007;
    var beaconBreath = 0.45 + 0.25 * Math.sin(tick * 0.04);
    beaconOuter.material.opacity = beaconBreath + 0.1;
    beaconInner.material.opacity = beaconBreath + 0.3;
    // Orbiting motes
    for (var bm = 0, child; bm < beacon.children.length; bm++) {
      child = beacon.children[bm];
      if (child.userData && typeof child.userData.beaconMote === 'number') {
        var ma = (child.userData.beaconMote / 3) * Math.PI * 2 + tick * 0.015;
        child.position.set(Math.cos(ma) * 38, Math.sin(tick * 0.02 + bm) * 3, Math.sin(ma) * 38);
      }
    }
    scene.traverse(function(obj) {
      var ud = obj.userData;
      if (!ud) return;
      if (ud.isPulse && obj.material) {
        var p = ud.pulsePhase || 0;
        var breath = 0.6 + 0.8 * (0.5 + 0.5 * Math.sin(tick * 0.05 + p));
        obj.material.opacity = ud.baseOpacity * breath;
      }
      if (ud.isShimmer) {
        obj.rotation.y = tick * 0.02 + (ud.shimmerSeed || 0);
        obj.rotation.x += 0.0025;
      }
      if (ud.isWave) {
        var phase = ud.wavePhase || 0;
        var sc = 1 + 0.12 * Math.sin(tick * 0.045 + phase);
        obj.scale.setScalar(sc);
      }
      // Per-node self-rotation — every file rotates on its own axis, seeded
      // speed and axis. Richer-role archetypes spin faster.
      if (ud.nodeId && ud.spinAxis) {
        obj.rotation.x += ud.spinAxis.x;
        obj.rotation.y += ud.spinAxis.y;
        obj.rotation.z += ud.spinAxis.z;
      }
    });
    requestAnimationFrame(animateScene);
  }
  animateScene();
})();
</script>`;

    const body = `
      <div class="bw-3d-graph-page">
        <div class="bw-3d-loading">
          <div class="bw-3d-loading-spinner"></div>
        </div>
        <div id="bw-3d-graph" class="bw-3d-graph-container"></div>

        <div class="bw-3d-hud">
          <div class="bw-3d-hud-title">Source Files</div>
          <div class="bw-3d-hud-stats">
            <span>${graphData.stats.totalFiles}</span> files · <span>${graphData.stats.totalLines.toLocaleString()}</span> lines
          </div>
        </div>

        <div class="bw-3d-legend">
          <div class="bw-3d-legend-title">Health</div>
          ${healthLegend}
        </div>

        <div class="bw-3d-controls">
          <div class="bw-3d-controls-title">Codebase Explorer</div>
          <div class="bw-3d-zoom-buttons">
            <button id="bw-3d-zoom-in" class="bw-3d-zoom-btn" title="Zoom In">+</button>
            <button id="bw-3d-zoom-out" class="bw-3d-zoom-btn" title="Zoom Out">-</button>
            <button id="bw-3d-zoom-reset" class="bw-3d-zoom-btn" title="Reset View">⟲</button>
          </div>
          <div class="bw-3d-controls-row"><kbd>Drag</kbd> Rotate</div>
          <div class="bw-3d-controls-row"><kbd>Scroll</kbd> Zoom</div>
          <div class="bw-3d-controls-row"><kbd>WASD</kbd> Fly</div>
          <div class="bw-3d-controls-row"><kbd>Q</kbd> / <kbd>E</kbd> Down / Up</div>
          <div class="bw-3d-controls-row"><kbd>Shift</kbd> Boost</div>
          <div class="bw-3d-controls-row"><kbd>Click</kbd> Focus file</div>
          <div class="bw-3d-controls-row"><kbd>Dbl-click</kbd> Analyze</div>
          <div class="bw-3d-controls-row"><kbd>H</kbd> Home (respawn)</div>
          <div class="bw-3d-controls-row"><kbd>Esc</kbd> Reset view</div>
        </div>

        <div class="bw-3d-search">
          <input type="search" id="bw-3d-search-input" placeholder="Search files..." />
        </div>

        <div id="bw-3d-tooltip" class="bw-3d-tooltip"></div>

        <div id="bw-3d-building" class="bw-3d-building" style="display:none">
          <span class="bw-3d-building-icon">🔨</span>
          <span id="bw-3d-building-text"></span>
        </div>

        <aside id="bw-3d-panel" class="bw-3d-panel" aria-hidden="true">
          <button id="bw-3d-panel-close" class="bw-3d-panel-close" aria-label="Close">×</button>
          <div id="bw-3d-panel-head" class="bw-3d-panel-head"></div>
          <div id="bw-3d-panel-body" class="bw-3d-panel-body"></div>
        </aside>

        <aside id="bw-3d-map" class="bw-3d-map" aria-hidden="true">
          <div class="bw-3d-map-head">
            <h3 id="bw-3d-map-title">Connections</h3>
            <div id="bw-3d-map-sub" class="bw-3d-map-sub"></div>
          </div>
          <svg id="bw-3d-map-svg" viewBox="-160 -160 320 320" preserveAspectRatio="xMidYMid meet"></svg>
          <div id="bw-3d-map-legend" class="bw-3d-map-legend">
            <span><i style="background:#fcd34d"></i> imported by</span>
            <span><i style="background:#a7f3d0"></i> imports</span>
          </div>
        </aside>
      </div>
    `;

    return htmlShell({
      title: 'Explore Files',
      projectName: config.projectName,
      categories: config.categories,
      body,
      lastCompile: manifest.lastCompile,
      extraHead: liveReloadScript,
      extraBodyEnd: fileGraph3DScript,
      needs3DGraph: true,
    });
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
    const graphScript = buildGraphScript(graph, catColorMap, catTitleMap, { explainMode: false });

    const body = `
      <div class="bw-welcome-header">
        <div class="bw-welcome-title">Welcome to <em>${escapeHtml(config.projectName)}</em> Wiki</div>
        <div class="bw-welcome-sub">the brand intelligence base compiled from ${Object.keys(manifest.rawFiles).length} raw sources</div>
        <div class="bw-welcome-stats">${articles.length} articles across ${config.categories.length} categories · ${totalWords.toLocaleString()} words</div>
      </div>
      <div class="bw-dashboard">
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
    const body = `
      <div class="${layoutClass}">
        ${combinedSidebar}
        <div class="bw-article-main">
          <div class="bw-breadcrumb">
            <a href="/">Main Page</a> ›
            <a href="/category/${catId}">${escapeHtml(catTitle)}</a>
          </div>
          <h1 class="bw-title">${escapeHtml(article.title)}</h1>
          <div class="bw-subtitle">From ${escapeHtml(config.projectName)} Brand Wiki</div>
          <div class="bw-article">${processed.html}</div>
          ${references}
          ${catFooter}
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
        res.write('retry: 2000\n\nevent: connected\ndata: ' + SERVER_BOOT + '\n\n');
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

      // === /api/explain — streaming LLM explanation endpoint ===
      if (url === '/api/explain' && req.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: any;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }

        const { type, nodeId, targetId } = body;
        if (!type || !nodeId || (type !== 'node' && type !== 'edge')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid request: need type (node|edge) and nodeId' }));
          return;
        }

        const allArticles = await loadArticles();
        const [nodeCat, nodeSlug] = nodeId.split('/');
        const targetArticle = allArticles.find((a) => a.category === nodeCat && a.slug === nodeSlug);
        if (!targetArticle) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Article not found: ${nodeId}` }));
          return;
        }

        const langLabel = config.language === 'ja' ? '日本語' : 'English';
        const systemPrompt = `You are an expert on the "${config.projectName}" project wiki. Your role is to explain articles and their relationships to help users understand the project deeply.\n\nAnswer in ${langLabel}. Use Markdown. Be concise and insightful — focus on WHY things are connected and what the relationships reveal, not just summarizing content.`;

        let userPrompt: string;

        if (type === 'edge' && targetId) {
          const [tCat, tSlug] = targetId.split('/');
          const targetB = allArticles.find((a) => a.category === tCat && a.slug === tSlug);
          if (!targetB) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Article not found: ${targetId}` }));
            return;
          }
          userPrompt = `ARTICLE A: ${targetArticle.title}\n${targetArticle.body.slice(0, 50000)}\n\nARTICLE B: ${targetB.title}\n${targetB.body.slice(0, 50000)}\n\n---\n\nExplain the connection between "${targetArticle.title}" and "${targetB.title}":\n1. Why are these articles linked?\n2. What concepts or decisions do they share?\n3. How does understanding one inform the other?`;
        } else {
          // Node explain — gather neighbors
          const graph = buildBacklinkGraph(allArticles);
          const neighborIds = new Set<string>();
          for (const link of graph.links) {
            const s = typeof link.source === 'string' ? link.source : (link.source as any).id;
            const t = typeof link.target === 'string' ? link.target : (link.target as any).id;
            if (s === nodeId) neighborIds.add(t);
            if (t === nodeId) neighborIds.add(s);
          }
          const neighbors = allArticles.filter((a) => neighborIds.has(`${a.category}/${a.slug}`));
          const neighborSummaries = neighbors
            .map((a) => `### ${a.title}\n${a.body.slice(0, 2000)}`)
            .join('\n\n');

          userPrompt = `TARGET ARTICLE: ${targetArticle.title}\n${targetArticle.body.slice(0, 50000)}\n\nCONNECTED ARTICLES (${neighbors.length} neighbors):\n${neighborSummaries}\n\n---\n\nExplain this article in context:\n1. What does "${targetArticle.title}" cover and why is it important to ${config.projectName}?\n2. How does it relate to its ${neighbors.length} connected articles?\n3. What key decisions or concepts does it capture?`;
        }

        // Cap total context
        if (userPrompt.length > 100000) {
          userPrompt = userPrompt.slice(0, 100000) + '\n\n[Context truncated]';
        }

        const explainModel = config.model.explain ?? config.model.query;
        const provider = config.provider ?? 'claude-cli';

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        try {
          const stream = callLLMStream({
            model: explainModel,
            system: systemPrompt,
            user: userPrompt,
            maxTokens: 4096,
            provider,
          });

          for await (const chunk of stream) {
            if (res.writableEnded) break;
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          }
          if (!res.writableEnded) {
            res.write('event: done\ndata: {}\n\n');
            res.end();
          }
        } catch (err: any) {
          if (!res.writableEnded) {
            res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
            res.end();
          }
        }
        return;
      }

      // === /api/explain/project — scan project and return JSON ===
      if (url === '/api/explain/project' && req.method === 'GET') {
        if (!cachedExplainData) {
          cachedExplainData = await scanProject(root, config.projectName);
        }
        const json = JSON.stringify(cachedExplainData);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        });
        res.end(json);
        return;
      }

      // === /api/explain/file — file detail JSON ===
      if (url === '/api/explain/file' && req.method === 'GET') {
        if (!cachedExplainData) {
          cachedExplainData = await scanProject(root, config.projectName);
        }
        const queryString = (req.url ?? '').includes('?') ? (req.url ?? '').slice((req.url ?? '').indexOf('?') + 1) : '';
        const fp = new URLSearchParams(queryString).get('path');
        if (!fp) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing path parameter' }));
          return;
        }
        const detail = getFileDetail(fp, root, cachedExplainData);
        if (!detail) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
        res.end(JSON.stringify(detail));
        return;
      }

      // === /api/explain/content — raw source text for in-panel viewing ===
      if (url === '/api/explain/content' && req.method === 'GET') {
        const qs = (req.url ?? '').includes('?') ? (req.url ?? '').slice((req.url ?? '').indexOf('?') + 1) : '';
        const fp = new URLSearchParams(qs).get('path') || '';
        // Path sanitization: relative, no traversal, no absolutes.
        if (!fp || fp.indexOf('..') !== -1 || fp.startsWith('/') || /^[a-zA-Z]:/.test(fp)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid path' }));
          return;
        }
        const absPath = join(root, fp);
        if (!existsSync(absPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
        }
        try {
          let text = readFileSync(absPath, 'utf-8');
          const truncated = text.length > 120_000;
          if (truncated) text = text.slice(0, 120_000);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache',
          });
          res.end(JSON.stringify({ path: fp, content: text, truncated }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // === /api/explain/analyze — LLM file analysis (streaming) ===
      if (url === '/api/explain/analyze' && req.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: any;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        const filePath = body.path;
        if (!filePath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing path' }));
          return;
        }

        const absFilePath = join(root, filePath);
        if (!existsSync(absFilePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found' }));
          return;
        }

        const fileContent = readFileSync(absFilePath, 'utf-8').slice(0, 50000);

        // Gather graph context so Claude knows how the file is wired into the project
        if (!cachedExplainData) {
          cachedExplainData = await scanProject(root, config.projectName);
        }
        const fileDetail = getFileDetail(filePath, root, cachedExplainData);
        const importsList = fileDetail && fileDetail.imports.length
          ? fileDetail.imports.slice(0, 30).map((p) => '  - ' + p).join('\n')
          : '  (none)';
        const importedByList = fileDetail && fileDetail.importedBy.length
          ? fileDetail.importedBy.slice(0, 30).map((p) => '  - ' + p).join('\n')
          : '  (none)';

        const langLabel = config.language === 'ja' ? '日本語' : 'English';
        const analyzeSystem = `You are a senior engineer reviewing a single source file for a developer who needs to quickly decide what this file does, whether it's healthy, and what to do about it.\n\nAnswer in ${langLabel}. Use Markdown. Be direct and concrete, not vague. No filler like "this file is important" or "plays a role". Give verdicts.`;
        const analyzeUser = `FILE: ${filePath}\n\nIMPORTS (uses these files):\n${importsList}\n\nIMPORTED BY (used by these files):\n${importedByList}\n\nSOURCE:\n\`\`\`\n${fileContent}\n\`\`\`\n\n---\n\nWrite a short assessment under 180 words with this exact structure:\n\n**Verdict:** one line — one of: Healthy / Has issues / Likely redundant / Critical bug risk — and the single strongest reason.\n\n**What it does:** 1-2 sentences in plain language. Describe the actual behavior, not the category.\n\n**Context:** 1-2 sentences on WHO uses it (pick 1-3 concrete importers from the list) and WHY it exists in the system. Reference the real file names.\n\n**Good / Bad:** a short bulleted list. 1-3 concrete pros, 1-3 concrete problems if any (code smells, complexity, dead code, security risks, redundancy with other files). Cite line numbers or function names when possible.\n\n**Next action:** one imperative sentence — what would you do next?\n\nDo not pad. Do not hedge. If there's nothing wrong, say so.`;

        const explainModel = config.model.explain ?? config.model.query;
        const provider = config.provider ?? 'claude-cli';

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        try {
          const stream = callLLMStream({
            model: explainModel,
            system: analyzeSystem,
            user: analyzeUser,
            maxTokens: 4096,
            provider,
          });
          for await (const chunk of stream) {
            if (res.writableEnded) break;
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          }
          if (!res.writableEnded) {
            res.write('event: done\ndata: {}\n\n');
            res.end();
          }
        } catch (err: any) {
          if (!res.writableEnded) {
            res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
            res.end();
          }
        }
        return;
      }

      const rawUrl = req.url ?? '/';

      // Motif cache: serve AI-generated SVG sigils from .brandwiki/.motif-cache/
      if (url.startsWith('/motifs/') && url.endsWith('.svg')) {
        const key = url.slice('/motifs/'.length, -'.svg'.length);
        if (/^[a-f0-9]{12,64}$/.test(key)) {
          const path = motifPathFor(root, key);
          if (existsSync(path)) {
            const svg = readFileSync(path, 'utf-8');
            res.writeHead(200, {
              'Content-Type': 'image/svg+xml; charset=utf-8',
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(svg);
            return;
          }
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('motif not found');
        return;
      }

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
      } else if (url === '/explain') {
        html = explainPageHtml(config.projectName);
      } else if (url === '/graph') {
        html = renderGraphPage(articles, manifest);
      } else if (url === '/explore') {
        // Check mode: 'files' for source code graph, 'articles' (default) for wiki articles
        const graphMode = config.graph3d?.mode || 'articles';
        if (graphMode === 'files') {
          html = await render3DFileGraphPage(manifest, articles);
        } else {
          html = render3DGraphPage(articles, manifest);
        }
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

  // === LIVE DEV DASHBOARD ===
  // Watch every service's src/ so editing any file in any terminal reloads the park.
  // Source changes → reload in 400ms. Content changes → regenerate motif 5s after
  // last keystroke (per-file debounce), gated by content-hash so no-op edits are free.
  if (!options.noLiveReload) {
    const chokidar = await import('chokidar');
    const sourceDirs = [
      join(root, 'backend', 'src'),
      join(root, 'frontend', 'src'),
      join(root, 'autocall', 'src'),
      join(root, 'scraper', 'src'),
      join(root, '.brandwiki', 'src'),
    ].filter((p) => existsSync(p));
    if (sourceDirs.length > 0) {
      let debounceTimer: NodeJS.Timeout | null = null;
      const scheduleReload = (path: string) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          console.log(pc.gray('  \u21bb live update: ') + pc.cyan(relative(root, path).replaceAll('\\', '/')));
          broadcastReload();
        }, 400);
      };

      // Per-file motif regeneration — debounced 5s, content-hash gated.
      const motifTimers = new Map<string, NodeJS.Timeout>();
      const motifRegenning = new Set<string>();
      const MOTIF_DELAY_MS = 5000;
      const scheduleMotifRegen = (absPath: string) => {
        const rel = relative(root, absPath).replaceAll('\\', '/');
        if (!/\.(ts|tsx|js|jsx)$/.test(rel)) return;
        if (!/^(backend|frontend|autocall|scraper)\/src\//.test(rel)) return;
        const existing = motifTimers.get(rel);
        if (existing) clearTimeout(existing);
        const t = setTimeout(async () => {
          motifTimers.delete(rel);
          if (motifRegenning.has(rel)) return;
          if (!cachedFileGraph) return;
          const node = cachedFileGraph.nodes.find((n) => n.id === rel);
          if (!node) return;
          motifRegenning.add(rel);
          buildingPaths.add(rel);
          broadcastBuilding();
          try {
            const cls = classifyRoleForMotif(rel);
            const result = await generateMotif(root, {
              id: rel,
              role: cls.role,
              roleDesc: cls.desc,
              health: node.health,
              lineCount: node.size,
              fanIn: node.importedBy.length,
              fanOut: node.imports.length,
              absolutePath: absPath,
            });
            if (result.generated) {
              console.log(pc.gray('  \u2737 motif regenerated: ') + pc.cyan(rel));
              invalidateCache();
              broadcastReload();
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(pc.gray('  \u2737 motif skipped: ') + pc.yellow(rel + ' (' + msg + ')'));
          } finally {
            motifRegenning.delete(rel);
            buildingPaths.delete(rel);
            broadcastBuilding();
          }
        }, MOTIF_DELAY_MS);
        motifTimers.set(rel, t);
      };

      const sourceWatcher = chokidar.default.watch(sourceDirs, {
        ignored: [/node_modules/, /dist/, /\.next/, /\.turbo/, /build/, /\.motif-cache/],
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 80 },
      });
      sourceWatcher.on('change', (p) => { scheduleReload(p); scheduleMotifRegen(p); });
      sourceWatcher.on('add',    (p) => { scheduleReload(p); scheduleMotifRegen(p); });
      sourceWatcher.on('unlink', (p) => scheduleReload(p));
    }
  }

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(pc.green(`\u2713 Brand Wiki server running`));
      console.log(pc.cyan(`  http://localhost:${port}`));
      console.log(pc.dim(`  Serving ${bwDir}/wiki`));
      if (!options.noLiveReload) {
        console.log(pc.dim(`  Live update: watching backend/frontend/autocall/scraper/.brandwiki src/ (debounced 400ms)`));
      }
      resolve();
    });
  });
}
