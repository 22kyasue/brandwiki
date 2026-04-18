#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIKI_DIR = path.join(__dirname, 'wiki');
const CONFIG = JSON.parse(await fs.readFile(path.join(__dirname, 'config.json'), 'utf8'));
const PORT = 8788;

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderMarkdown(md) {
  const lines = md.split(/\r?\n/);
  let html = '';
  let inCode = false;
  let inList = false;
  let inTable = false;
  let paraBuf = [];

  const flushPara = () => {
    if (paraBuf.length) {
      html += `<p>${inline(paraBuf.join(' '))}</p>\n`;
      paraBuf = [];
    }
  };
  const closeList = () => { if (inList) { html += '</ul>\n'; inList = false; } };
  const closeTable = () => { if (inTable) { html += '</table>\n'; inTable = false; } };

  function inline(s) {
    s = escapeHtml(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => {
      let href = u;
      if (/\.md($|#)/.test(u) && !/^https?:/.test(u)) href = u.replace(/\.md/, '.html');
      return `<a href="${href}">${t}</a>`;
    });
    return s;
  }

  for (const raw of lines) {
    const line = raw;
    if (/^```/.test(line)) {
      flushPara(); closeList(); closeTable();
      if (!inCode) { html += '<pre><code>'; inCode = true; }
      else { html += '</code></pre>\n'; inCode = false; }
      continue;
    }
    if (inCode) { html += escapeHtml(line) + '\n'; continue; }
    if (/^\s*$/.test(line)) { flushPara(); closeList(); closeTable(); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushPara(); closeList(); closeTable(); html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>\n`; continue; }
    if (/^[-*]\s+/.test(line)) {
      flushPara(); closeTable();
      if (!inList) { html += '<ul>\n'; inList = true; }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>\n`;
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      flushPara(); closeList();
      if (/^\|[\s:|-]+\|$/.test(line)) continue;
      if (!inTable) { html += '<table>\n'; inTable = true; }
      const cells = line.slice(1, -1).split('|').map(c => `<td>${inline(c.trim())}</td>`).join('');
      html += `<tr>${cells}</tr>\n`;
      continue;
    }
    if (/^---+$/.test(line)) { flushPara(); closeList(); closeTable(); html += '<hr/>\n'; continue; }
    closeList(); closeTable();
    paraBuf.push(line);
  }
  flushPara(); closeList(); closeTable();
  if (inCode) html += '</code></pre>\n';
  return html;
}

async function buildIndex() {
  const cats = {};
  const walk = async (dir, rel = '') => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      const r = path.posix.join(rel, e.name);
      if (e.isDirectory()) await walk(p, r);
      else if (e.name.endsWith('.md') && e.name !== 'README.md') {
        const cat = r.split('/')[0];
        (cats[cat] ||= []).push(r);
      }
    }
  };
  await walk(WIKI_DIR);
  return cats;
}

function pageShell(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)} — ${CONFIG.projectName} Wiki</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:900px;margin:2rem auto;padding:0 1.5rem;color:#222;line-height:1.6}
nav{background:#f5f5f7;padding:1rem;border-radius:8px;margin-bottom:2rem}
nav a{margin-right:1rem;color:#0366d6;text-decoration:none}
h1,h2,h3{border-bottom:1px solid #eee;padding-bottom:.3rem}
code{background:#f5f5f7;padding:.15rem .35rem;border-radius:3px;font-size:.9em}
pre{background:#1e1e1e;color:#d4d4d4;padding:1rem;border-radius:6px;overflow-x:auto}
pre code{background:none;color:inherit;padding:0}
table{border-collapse:collapse;margin:1rem 0}
td{border:1px solid #ddd;padding:.5rem .8rem}
tr:first-child td{background:#f5f5f7;font-weight:600}
a{color:#0366d6}
.cat{margin-bottom:1.5rem}
.cat h2{margin-bottom:.5rem}
.cat ul{margin-top:.3rem}
</style></head><body>
<nav><a href="/">🏠 Home</a> <strong>${CONFIG.projectName} Brand Wiki</strong></nav>
${body}
</body></html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/' || url === '/index.html') {
      const cats = await buildIndex();
      const catMeta = Object.fromEntries((CONFIG.categories || []).map(c => [c.id, c]));
      let body = `<h1>${CONFIG.projectName} Brand Wiki</h1><p>Knowledge base compiled from repo notes and decisions.</p>`;
      for (const cat of Object.keys(cats).sort()) {
        const meta = catMeta[cat] || { title: cat };
        body += `<div class="cat"><h2>${escapeHtml(meta.title)}</h2>`;
        if (meta.description) body += `<p><em>${escapeHtml(meta.description)}</em></p>`;
        body += '<ul>';
        for (const f of cats[cat].sort()) {
          const name = path.basename(f, '.md').replace(/-/g, ' ');
          body += `<li><a href="/${f.replace(/\.md$/, '.html')}">${escapeHtml(name)}</a></li>`;
        }
        body += '</ul></div>';
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(pageShell('Home', body));
      return;
    }
    if (url.endsWith('.html')) {
      const mdPath = path.join(WIKI_DIR, url.replace(/\.html$/, '.md'));
      if (!mdPath.startsWith(WIKI_DIR)) { res.writeHead(403); res.end('forbidden'); return; }
      const md = await fs.readFile(mdPath, 'utf8');
      const title = (md.match(/^#\s+(.*)$/m) || [, path.basename(mdPath)])[1];
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(pageShell(title, renderMarkdown(md)));
      return;
    }
    if (url.endsWith('.md')) {
      const p = path.join(WIKI_DIR, url);
      if (!p.startsWith(WIKI_DIR)) { res.writeHead(403); res.end('forbidden'); return; }
      const md = await fs.readFile(p, 'utf8');
      res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
      res.end(md);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end(pageShell('Not Found', '<h1>404</h1><p><a href="/">Back to home</a></p>'));
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`Brand wiki serving at http://localhost:${PORT}`);
});
