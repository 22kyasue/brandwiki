export const SITE_CSS = `
/* Wikipedia-inspired Brand Wiki */
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic', 'Meiryo', sans-serif;
  font-size: 14.5px;
  line-height: 1.65;
  color: #202122;
  background: #f6f6f6;
}
a { color: #3366cc; text-decoration: none; transition: color 0.18s ease; }
a:visited { color: #6b4ba1; }
a:hover { text-decoration: underline; }
a.new { color: #ba0000; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}

/* === Top header bar === */
.bw-topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 54px;
  background: #ffffff;
  border-bottom: 1px solid #d8dce0;
  display: flex;
  align-items: center;
  padding: 0 28px;
  gap: 32px;
}
.bw-topbar-brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: #202122;
  font-family: 'Linux Libertine', 'Georgia', 'Hiragino Mincho ProN', 'Yu Mincho', serif;
}
.bw-topbar-brand:hover { text-decoration: none; }
.bw-topbar-brand-mark {
  color: #3366cc;
  font-size: 14px;
  line-height: 1;
}
.bw-topbar-brand-name {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.2px;
}
.bw-topbar-brand-sub {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 9px;
  letter-spacing: 2px;
  color: #72777d;
  font-weight: 700;
  margin-left: 2px;
  align-self: center;
  margin-top: 4px;
}
.bw-topbar-nav {
  display: flex;
  gap: 22px;
  font-size: 12.5px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.bw-topbar-nav a {
  color: #54595d;
  padding: 20px 0;
  border-bottom: 2px solid transparent;
  transition: color 0.12s steps(3, end), border-color 0.12s steps(3, end);
  font-weight: 500;
}
.bw-topbar-nav a:hover {
  color: #202122;
  border-bottom-color: #3366cc;
  text-decoration: none;
}
.bw-topbar-search {
  margin-left: auto;
  position: relative;
  display: flex;
  align-items: center;
}
.bw-topbar-search input {
  width: 280px;
  padding: 8px 40px 8px 36px;
  border: 1px solid #d8dce0;
  border-radius: 0;
  font-size: 12.5px;
  font-family: inherit;
  background: #f8f9fa;
  color: #202122;
  transition: border-color 0.12s steps(3, end), background 0.12s steps(3, end), width 0.18s steps(4, end);
}
.bw-topbar-search input:focus {
  outline: none;
  border-color: #3366cc;
  background: #ffffff;
  width: 340px;
}
.bw-topbar-search input::placeholder { color: #a2a9b1; }
.bw-topbar-search-icon {
  position: absolute;
  left: 12px;
  font-size: 16px;
  color: #72777d;
  pointer-events: none;
}
.bw-topbar-search-kbd {
  position: absolute;
  right: 12px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 10px;
  color: #a2a9b1;
  background: #eaecf0;
  padding: 1px 6px;
  border-radius: 2px;
  pointer-events: none;
}
@media (max-width: 800px) {
  .bw-topbar-nav { display: none; }
  .bw-topbar-search input { width: 180px; }
  .bw-topbar-search input:focus { width: 220px; }
}

/* === Live indicator (watch mode) === */
.bw-live {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
  border: 1px solid #d8dce0;
  background: #f8f9fa;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 11px;
  color: #54595d;
  user-select: none;
  white-space: nowrap;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.bw-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9aa0a6;
  flex-shrink: 0;
  transition: background 0.2s ease;
}
.bw-live.connected {
  background: #f0faf4;
  border-color: #b6e0c4;
  color: #1b6e3e;
}
.bw-live.connected .bw-live-dot {
  background: #00a86b;
  box-shadow: 0 0 0 0 rgba(0, 168, 107, 0.55);
  animation: bw-live-pulse 2.2s ease-in-out infinite;
}
@keyframes bw-live-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 168, 107, 0.55); }
  50%      { box-shadow: 0 0 0 5px rgba(0, 168, 107, 0); }
}
.bw-live.disconnected {
  background: #fdf4f5;
  border-color: #e8c4c8;
  color: #a12a2a;
}
.bw-live.disconnected .bw-live-dot { background: #c94a4a; }
.bw-live-text { font-weight: 600; letter-spacing: 0.3px; }
.bw-live-time { color: #72777d; font-weight: 500; }
.bw-live.connected .bw-live-time { color: #47856a; }
@media (max-width: 800px) {
  .bw-live { padding: 5px 8px; font-size: 10px; gap: 5px; }
  .bw-live-text { display: none; }
}

/* === Page body === */
.bw-page {
  min-height: calc(100vh - 54px);
  background: #ffffff;
}
.bw-page-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px 32px 60px;
}

/* === Article layout: 3-column grid (TOC | body | infobox) === */
.bw-article-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 300px;
  gap: 36px;
  align-items: start;
}
.bw-article-layout.no-toc {
  grid-template-columns: minmax(0, 1fr) 300px;
}
.bw-article-layout.no-infobox {
  grid-template-columns: 220px minmax(0, 1fr);
}
.bw-toc-sidebar {
  position: sticky;
  top: 74px;
  max-height: calc(100vh - 94px);
  overflow-y: auto;
  font-size: 12px;
  padding: 4px 16px 16px 0;
  border-right: 1px solid #e4e6ea;
}
.bw-toc-sidebar-header {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: #54595d;
  margin: 0 0 10px;
  padding: 0 0 6px;
  border-bottom: 1px solid #d8dce0;
}
.bw-toc-sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.bw-toc-sidebar ul ul {
  padding-left: 14px;
  margin-top: 2px;
  margin-bottom: 2px;
  border-left: 1px solid #eaecf0;
  padding-left: 10px;
  margin-left: 4px;
}
.bw-toc-sidebar li {
  padding: 3px 0;
  line-height: 1.45;
}
.bw-toc-sidebar a {
  color: #54595d;
  display: inline-block;
  padding: 1px 2px;
  border-bottom: 2px solid transparent;
  transition: color 0.12s steps(3, end), border-color 0.12s steps(3, end);
}
.bw-toc-sidebar a:hover {
  color: #3366cc;
  text-decoration: none;
}
.bw-toc-sidebar a.active {
  color: #b84949;
  border-bottom-color: #b84949;
  font-weight: 600;
}
.bw-toc-sidebar-num {
  display: inline-block;
  min-width: 22px;
  color: #a2a9b1;
  font-variant-numeric: tabular-nums;
  margin-right: 4px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 10.5px;
}
.bw-article-main {
  min-width: 0;
  max-width: 860px;
}
.bw-article-infobox-col {
  position: sticky;
  top: 74px;
  max-height: calc(100vh - 94px);
  overflow-y: auto;
}

/* Narrow viewports: collapse to single column */
@media (max-width: 1180px) {
  .bw-article-layout,
  .bw-article-layout.no-toc,
  .bw-article-layout.no-infobox {
    grid-template-columns: 220px minmax(0, 1fr);
  }
  .bw-article-infobox-col {
    grid-column: 1 / -1;
    position: static;
    max-height: none;
    overflow: visible;
  }
  .bw-article-layout.no-toc .bw-article-infobox-col { grid-column: 1 / -1; }
}
@media (max-width: 960px) {
  .bw-article-layout,
  .bw-article-layout.no-toc,
  .bw-article-layout.no-infobox {
    grid-template-columns: 1fr;
  }
  .bw-toc-sidebar {
    position: static;
    border-right: none;
    border-bottom: 1px solid #e4e6ea;
    padding: 0 0 14px 0;
    max-height: none;
    width: 100%;
  }
}

/* === Dashboard cards (main page) === */
.bw-dashboard {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
  margin: 18px 0;
}
.bw-dashboard .full-width { grid-column: 1 / -1; }
.bw-dash-card {
  background: #ffffff;
  border: 1px solid #d8dce0;
  border-radius: 0;
  overflow: hidden;
  animation: bw-step-in 0.3s steps(5, end) both;
}
.bw-dash-card-header {
  padding: 10px 18px;
  font-family: 'Linux Libertine', 'Georgia', serif;
  font-size: 15px;
  font-weight: 700;
  color: #202122;
  border-bottom: 1px solid #d8dce0;
}
.bw-dash-card-header.green { background: #d9f3e6; border-bottom-color: #86cfad; }
.bw-dash-card-header.blue { background: #dbe9fb; border-bottom-color: #7fa8e0; }
.bw-dash-card-header.purple { background: #e6dcf2; border-bottom-color: #a78bc9; }
.bw-dash-card-header.yellow { background: #fbe8c4; border-bottom-color: #dcb66b; }
.bw-dash-card-header.pink { background: #f8dce0; border-bottom-color: #dba0a9; }
.bw-dash-card-body {
  padding: 14px 18px 16px;
  font-size: 13px;
  line-height: 1.65;
  color: #202122;
}
.bw-welcome-header {
  text-align: center;
  font-family: 'Linux Libertine', 'Georgia', 'Hiragino Mincho ProN', 'Yu Mincho', serif;
  padding: 16px 0 6px;
}
.bw-welcome-title {
  font-size: 30px;
  font-weight: 400;
  color: #202122;
}
.bw-welcome-title em {
  font-style: italic;
  font-weight: 600;
}
.bw-welcome-sub {
  font-size: 13.5px;
  color: #54595d;
  margin-top: 2px;
}
.bw-welcome-stats {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 11px;
  color: #72777d;
  margin: 6px 0 2px;
  letter-spacing: 0.5px;
}

/* Featured article preview with image (placeholder) */
.bw-dash-featured { display: flex; gap: 14px; }
.bw-dash-featured-avatar {
  width: 100px;
  height: 100px;
  flex-shrink: 0;
  background: linear-gradient(135deg, #eaecf0 0%, #c8ccd1 100%);
  border: 1px solid #c8ccd1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Linux Libertine', 'Georgia', serif;
  font-size: 32px;
  color: #72777d;
}
.bw-dash-featured-body { flex: 1; min-width: 0; }
.bw-dash-featured-title {
  font-size: 15px;
  font-weight: 600;
  color: #3366cc;
  margin-bottom: 2px;
}
.bw-dash-featured-tag {
  font-size: 10.5px;
  color: #72777d;
  font-style: italic;
  margin-bottom: 6px;
}
.bw-dash-featured-excerpt {
  font-size: 12.5px;
  color: #54595d;
  line-height: 1.65;
  margin-bottom: 8px;
}
.bw-dash-read-more {
  font-size: 12px;
  font-weight: 600;
}

.bw-dash-list { list-style: none; padding: 0; margin: 0; font-size: 13px; }
.bw-dash-list li {
  padding: 4px 0 4px 18px;
  position: relative;
}
.bw-dash-list li::before {
  content: '▸';
  position: absolute;
  left: 2px;
  color: #3366cc;
  font-size: 10px;
  top: 6px;
}
.bw-dash-list .bw-date {
  color: #72777d;
  font-size: 11px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  margin-left: 6px;
}

.bw-health-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 24px;
}
.bw-health-item { }
.bw-health-value {
  font-family: 'Linux Libertine', 'Georgia', serif;
  font-size: 28px;
  font-weight: 500;
  color: #202122;
  line-height: 1;
}
.bw-health-label {
  font-size: 11px;
  color: #72777d;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

/* Featured large category grid (main page hero) */
.bw-browse-featured {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  margin: 6px 0;
}
.bw-browse-card {
  position: relative;
  padding: 16px 18px 14px;
  background: #ffffff;
  border: 1px solid #d8dce0;
  border-top: 3px solid var(--cat-color, #72777d);
  text-decoration: none !important;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: box-shadow 0.18s ease, transform 0.18s cubic-bezier(0.22, 0.61, 0.36, 1), border-color 0.15s ease;
}
.bw-browse-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 18px rgba(20, 30, 50, 0.08), 0 1px 3px rgba(20, 30, 50, 0.05);
  border-color: #a2a9b1;
}
.bw-browse-card-title {
  font-family: 'Linux Libertine', 'Georgia', 'Hiragino Mincho ProN', serif;
  font-size: 17px;
  font-weight: 600;
  color: #202122;
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.bw-browse-card-mark {
  color: var(--cat-color, #72777d);
  font-size: 12px;
}
.bw-browse-card-desc {
  font-size: 12.5px;
  color: #54595d;
  line-height: 1.6;
  flex: 1;
}
.bw-browse-card-count {
  font-size: 10.5px;
  color: var(--cat-color, #72777d);
  font-weight: 700;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  margin-top: 2px;
}
.bw-browse-card:hover .bw-browse-card-count::after {
  content: ' →';
}

/* Compact category row (fallback / old style) */
.bw-browse-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 32px;
  font-size: 13px;
}
.bw-browse-cat { padding: 4px 0; }
.bw-browse-cat a { font-weight: 600; }
.bw-browse-cat .bw-browse-desc {
  color: #54595d;
  font-weight: 400;
}
.bw-browse-cat .bw-browse-count {
  color: #72777d;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 11px;
}

/* === Persistent context sidebar (on non-main pages) === */
.bw-page-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 36px;
  align-items: start;
}
.bw-context-nav {
  position: sticky;
  top: 74px;
  max-height: calc(100vh - 94px);
  overflow-y: auto;
  font-size: 12.5px;
  padding: 0 16px 16px 0;
  border-right: 1px solid #e4e6ea;
}
.bw-context-nav-section { margin-bottom: 18px; }
.bw-context-nav-header {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: #54595d;
  margin: 0 0 8px;
  padding: 0 0 6px;
  border-bottom: 1px solid #d8dce0;
}
.bw-context-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.bw-context-nav li { padding: 2px 0; line-height: 1.5; }
.bw-context-nav a {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: #202122;
  padding: 3px 8px;
  border-radius: 3px;
  border-left: 2px solid transparent;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}
.bw-context-nav a:hover {
  background: #f8f9fa;
  text-decoration: none;
}
.bw-context-nav a.active {
  background: #eaf3ff;
  border-left-color: var(--cat-color, #3366cc);
  color: var(--cat-color, #3366cc);
  font-weight: 600;
}
.bw-context-nav-count {
  margin-left: auto;
  font-size: 10.5px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  color: #a2a9b1;
  font-weight: 400;
}
.bw-context-nav a.active .bw-context-nav-count { color: var(--cat-color, #3366cc); }

/* Article-layout: categories embedded in TOC sidebar */
.bw-toc-sidebar .bw-context-nav-section { margin-bottom: 14px; }
.bw-toc-divider {
  height: 1px;
  background: #d8dce0;
  margin: 4px 16px 12px 0;
}

@media (max-width: 960px) {
  .bw-page-layout { grid-template-columns: 1fr; }
  .bw-context-nav {
    position: static;
    border-right: none;
    border-bottom: 1px solid #e4e6ea;
    padding: 0 0 14px 0;
    max-height: none;
  }
}

/* === Backlink graph (fused with wiki) === */
.bw-graph-container {
  position: relative;
  width: 100%;
  height: 680px;
  background: #ffffff;
  border: none;
  border-top: 1px solid #eaecf0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Hiragino Sans', 'Noto Sans JP', sans-serif;
}
.bw-graph-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 1px 1px, rgba(162, 169, 177, 0.14) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}
.bw-graph-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 10px 16px;
  font-size: 11.5px;
  font-family: -apple-system, 'Segoe UI', 'Inter', 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  border-bottom: 1px solid #eaecf0;
  background: #ffffff;
  color: #54595d;
  align-items: center;
}
.bw-graph-legend .bw-legend-label {
  font-weight: 600;
  color: #202122;
  margin-right: 10px;
  font-family: 'Linux Libertine', 'Georgia', 'Hiragino Mincho ProN', serif;
  font-size: 13px;
}
.bw-graph-legend .bw-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  user-select: none;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.bw-graph-legend .bw-legend-item:hover {
  background: #f8f9fa;
  border-color: #eaecf0;
}
.bw-graph-legend .bw-legend-item.disabled { opacity: 0.3; }
.bw-graph-legend .bw-legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}

/* Graph control panel — Obsidian-style minimal */
.bw-graph-controls {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #262626;
  border: 1px solid #3d3d3d;
  border-radius: 6px;
  padding: 14px 14px;
  font-family: -apple-system, 'Segoe UI', 'Inter', sans-serif;
  font-size: 11px;
  color: #a0a0a0;
  min-width: 220px;
}
.bw-graph-controls-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bw-graph-controls label {
  font-size: 11px;
  text-transform: none;
  letter-spacing: 0;
  color: #a0a0a0;
  font-weight: 400;
  min-width: 56px;
}
.bw-graph-controls input[type="range"] {
  flex: 1;
  height: 12px;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
}
.bw-graph-controls input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  height: 14px;
}
.bw-graph-controls input[type="range"]::-webkit-slider-runnable-track {
  height: 3px;
  background: #3d3d3d;
  border-radius: 3px;
}
.bw-graph-controls input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #c9d1d9;
  border: none;
  border-radius: 50%;
  margin-top: -4.5px;
  cursor: pointer;
  transition: background 0.12s ease;
}
.bw-graph-controls input[type="range"]:hover::-webkit-slider-thumb { background: #ffffff; }
.bw-graph-controls input[type="range"]::-moz-range-track { height: 3px; background: #3d3d3d; border-radius: 3px; }
.bw-graph-controls input[type="range"]::-moz-range-thumb {
  width: 12px; height: 12px; background: #c9d1d9; border: none; border-radius: 50%;
}
.bw-graph-controls input[type="search"] {
  flex: 1;
  font-family: inherit;
  font-size: 11px;
  padding: 6px 10px;
  border: 1px solid #3d3d3d;
  border-radius: 4px;
  background: #1a1a1a;
  color: #e8ecf1;
  min-width: 0;
}
.bw-graph-controls input[type="search"]:focus { outline: none; border-color: #7b6cd9; }
.bw-graph-controls input[type="search"]::placeholder { color: #5a5a5a; }
.bw-graph-btns { display: flex; gap: 4px; flex-wrap: wrap; }
.bw-graph-btn {
  background: transparent;
  border: 1px solid #3d3d3d;
  padding: 5px 11px;
  font-family: inherit;
  font-size: 10.5px;
  color: #a0a0a0;
  cursor: pointer;
  letter-spacing: 0;
  text-transform: none;
  border-radius: 4px;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.bw-graph-btn:hover { background: #333333; color: #e8ecf1; border-color: #4a4a4a; }
.bw-graph-btn.active { background: #7b6cd9; color: #ffffff; border-color: #7b6cd9; }

/* Graph stats HUD — minimal */
.bw-graph-hud {
  position: absolute;
  bottom: 14px;
  left: 14px;
  z-index: 5;
  background: #262626;
  border: 1px solid #3d3d3d;
  border-radius: 6px;
  color: #a0a0a0;
  padding: 10px 14px;
  font-family: -apple-system, 'Segoe UI', 'Inter', sans-serif;
  font-size: 11px;
  pointer-events: none;
  min-width: 170px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.bw-graph-hud .hud-label { color: #6a6a6a; }
.bw-graph-hud .hud-val { color: #e8ecf1; font-weight: 500; }
.bw-graph-hud .hud-pulse {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: #4ade80;
  border-radius: 50%;
  margin-right: 6px;
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.6);
}

/* Tooltip card — wiki-fused */
.bw-graph-tooltip {
  position: fixed;
  z-index: 10;
  background: #ffffff;
  border: 1px solid #a2a9b1;
  border-radius: 2px;
  padding: 10px 14px;
  font-size: 12px;
  max-width: 300px;
  pointer-events: none;
  box-shadow: 0 4px 14px rgba(20, 30, 50, 0.1), 0 1px 3px rgba(20, 30, 50, 0.06);
  display: none;
  font-family: -apple-system, 'Segoe UI', 'Inter', 'Hiragino Sans', 'Noto Sans JP', sans-serif;
}
.bw-graph-tooltip.visible { display: block; }
.bw-graph-tooltip .tt-cat {
  font-size: 10px;
  color: var(--tt-color, #72777d);
  font-weight: 600;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.bw-graph-tooltip .tt-cat::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tt-color, #72777d);
}
.bw-graph-tooltip .tt-title {
  font-family: 'Linux Libertine', 'Georgia', 'Hiragino Mincho ProN', serif;
  font-size: 15px;
  color: #202122;
  font-weight: 600;
  margin-bottom: 4px;
  line-height: 1.35;
}
.bw-graph-tooltip .tt-meta {
  font-size: 10.5px;
  color: #72777d;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #eaecf0;
}
.bw-graph-tooltip .tt-hint {
  font-size: 10px;
  color: #a2a9b1;
  margin-top: 3px;
}

/* SVG nodes & links — Obsidian style */
#bw-graph-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: grab;
}
#bw-graph-svg:active { cursor: grabbing; }
#bw-graph-svg .node {
  transition: opacity 0.2s ease;
}
#bw-graph-svg .node .atom {
  cursor: pointer;
  transition: r 0.2s cubic-bezier(0.22, 0.61, 0.36, 1);
  stroke: #ffffff;
  stroke-width: 1.5px;
}
#bw-graph-svg .node.pinned .atom-ring {
  stroke: rgba(32, 33, 34, 0.5);
  stroke-width: 1px;
  stroke-dasharray: 2 2;
  fill: none;
}
#bw-graph-svg .node.highlight .atom {
  stroke: #202122;
  stroke-width: 2px;
}
#bw-graph-svg .node.dim { opacity: 0.18; }
#bw-graph-svg .node.hit .atom {
  stroke: #202122;
  stroke-width: 2px;
}
#bw-graph-svg .node text.label {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  font-size: 11px;
  font-weight: 400;
  fill: #202122;
  pointer-events: none;
  text-anchor: middle;
  opacity: 0;
  transition: opacity 0.2s ease, fill 0.2s ease;
  paint-order: stroke;
  stroke: #ffffff;
  stroke-width: 3px;
  stroke-linejoin: round;
}
#bw-graph-svg .node.highlight text.label {
  fill: #202122;
  font-weight: 600;
  opacity: 1;
}
#bw-graph-svg .node.anchor text.label { opacity: 0.85; }
#bw-graph-svg .node.pinned text.label { opacity: 0.9; }
#bw-graph-svg .node.hit text.label { opacity: 1; }
#bw-graph-svg .node.dim text.label { opacity: 0 !important; }
/* When zoomed in, all labels appear */
#bw-graph-svg.zoomed-in .node text.label { opacity: 0.9; }
#bw-graph-svg.zoomed-in .node.dim text.label { opacity: 0 !important; }
#bw-graph-svg .link {
  stroke: #7a828c;
  stroke-opacity: 0.55;
  stroke-width: 1.3px;
  fill: none;
  transition: stroke-opacity 0.2s ease, stroke-width 0.2s ease, stroke 0.2s ease;
}
#bw-graph-svg .link.dim { stroke-opacity: 0.08; }
#bw-graph-svg .link.highlight {
  stroke: #3366cc;
  stroke-opacity: 0.95;
  stroke-width: 2px;
}

/* === Minimal wiki-fused graph UI === */
.bw-graph-mini-search {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 5;
}
.bw-graph-mini-search input {
  width: 200px;
  padding: 7px 12px;
  font-family: -apple-system, 'Segoe UI', 'Inter', 'Noto Sans JP', sans-serif;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #c8ccd1;
  border-radius: 2px;
  color: #202122;
  backdrop-filter: blur(4px);
  transition: border-color 0.15s ease, width 0.2s ease, background 0.15s ease;
}
.bw-graph-mini-search input::placeholder { color: #a2a9b1; }
.bw-graph-mini-search input:focus {
  outline: none;
  border-color: #3366cc;
  width: 260px;
  background: #ffffff;
}
.bw-graph-zoom {
  position: absolute;
  bottom: 14px;
  left: 14px;
  z-index: 5;
  display: flex;
  gap: 0;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #c8ccd1;
  border-radius: 2px;
  overflow: hidden;
  backdrop-filter: blur(4px);
  font-family: -apple-system, 'Segoe UI', 'Inter', sans-serif;
}
.bw-graph-zoom button {
  background: transparent;
  border: none;
  border-right: 1px solid #eaecf0;
  color: #54595d;
  width: 30px;
  height: 28px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: inherit;
}
.bw-graph-zoom button:last-child { border-right: none; }
.bw-graph-zoom button:hover {
  background: #f8f9fa;
  color: #3366cc;
}
.bw-graph-zoom .bw-graph-zoom-level {
  font-size: 10px;
  color: #72777d;
  padding: 0 10px;
  display: flex;
  align-items: center;
  min-width: 46px;
  justify-content: center;
  font-variant-numeric: tabular-nums;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  border-right: 1px solid #eaecf0;
  background: #f8f9fa;
}

.bw-graph-mini-hint {
  position: absolute;
  bottom: 14px;
  right: 14px;
  z-index: 5;
  font-family: -apple-system, 'Segoe UI', 'Inter', sans-serif;
  font-size: 10px;
  color: #a2a9b1;
  pointer-events: none;
  letter-spacing: 0.2px;
}
.bw-graph-mini-hint kbd {
  display: inline-block;
  padding: 0 5px;
  border: 1px solid #c8ccd1;
  background: rgba(255, 255, 255, 0.8);
  color: #72777d;
  border-radius: 2px;
  font-family: inherit;
  font-size: 10px;
  margin: 0 2px;
}

/* Graph help hint */
.bw-graph-hint {
  position: absolute;
  bottom: 14px;
  right: 14px;
  z-index: 5;
  font-family: -apple-system, 'Segoe UI', 'Inter', sans-serif;
  font-size: 10.5px;
  color: #6a6a6a;
  background: #262626;
  padding: 7px 12px;
  border: 1px solid #3d3d3d;
  border-radius: 6px;
  pointer-events: none;
}
.bw-graph-hint kbd {
  display: inline-block;
  padding: 1px 6px;
  border: 1px solid #4a4a4a;
  background: #1a1a1a;
  color: #a0a0a0;
  border-radius: 3px;
  font-family: inherit;
  font-size: 10px;
  margin: 0 2px;
}
.bw-breadcrumb {
  font-size: 12px;
  color: #54595d;
  margin-bottom: 8px;
}
.bw-breadcrumb a { color: #3366cc; }

.bw-title {
  font-family: 'Linux Libertine', 'Georgia', 'Hiragino Mincho ProN', 'Yu Mincho', serif;
  font-size: 30px;
  font-weight: 400;
  padding-bottom: 4px;
  margin: 0 0 4px;
  border-bottom: 1px solid #a2a9b1;
  line-height: 1.3;
}
.bw-subtitle {
  font-size: 12.5px;
  color: #54595d;
  margin-bottom: 16px;
  font-style: italic;
}

.bw-meta {
  background: #f8f9fa;
  border: 1px solid #a2a9b1;
  border-radius: 2px;
  padding: 10px 14px;
  margin: 0 0 18px;
  font-size: 12.5px;
  color: #54595d;
}
.bw-meta table { width: 100%; border-collapse: collapse; }
.bw-meta td { padding: 2px 8px 2px 0; vertical-align: top; }
.bw-meta td:first-child { font-weight: 600; white-space: nowrap; color: #202122; width: 100px; }
.bw-badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 2px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.bw-badge.status-draft { background: #fee7e6; color: #b32424; }
.bw-badge.status-stable { background: #d5fdf4; color: #14866d; }
.bw-badge.conf-high { background: #d5fdf4; color: #14866d; }
.bw-badge.conf-medium { background: #fef6e7; color: #ac6600; }
.bw-badge.conf-low { background: #fee7e6; color: #b32424; }

/* Article body */
.bw-article { font-size: 14.5px; }
.bw-article h1 {
  font-family: 'Linux Libertine', 'Georgia', serif;
  font-size: 26px;
  font-weight: 400;
  border-bottom: 1px solid #a2a9b1;
  padding-bottom: 3px;
  margin: 24px 0 8px;
}
.bw-article h2 {
  font-family: 'Linux Libertine', 'Georgia', serif;
  font-size: 22px;
  font-weight: 400;
  border-bottom: 1px solid #a2a9b1;
  padding-bottom: 3px;
  margin: 22px 0 8px;
}
.bw-article h3 { font-size: 17px; font-weight: 600; margin: 18px 0 6px; }
.bw-article h4 { font-size: 14.5px; font-weight: 700; margin: 14px 0 4px; }
.bw-article p { margin: 8px 0; }
.bw-article ul, .bw-article ol { margin: 6px 0 10px 0; padding-left: 26px; }
.bw-article li { margin: 3px 0; }
.bw-article code {
  background: #f8f9fa;
  border: 1px solid #eaecf0;
  border-radius: 2px;
  padding: 1px 4px;
  font-family: 'Consolas', 'Menlo', 'Courier New', monospace;
  font-size: 12.5px;
}
.bw-article pre {
  background: #f8f9fa;
  border: 1px solid #eaecf0;
  border-radius: 2px;
  padding: 10px 14px;
  overflow-x: auto;
  font-size: 12.5px;
  line-height: 1.5;
}
.bw-article pre code { background: none; border: none; padding: 0; }
.bw-article blockquote {
  margin: 10px 0;
  padding: 6px 14px;
  border-left: 4px solid #a2a9b1;
  background: #f8f9fa;
  color: #54595d;
}
.bw-article table {
  border-collapse: collapse;
  margin: 12px 0;
  background: #f8f9fa;
  border: 1px solid #a2a9b1;
}
.bw-article table th {
  background: #eaecf0;
  border: 1px solid #a2a9b1;
  padding: 6px 10px;
  text-align: left;
  font-weight: 600;
}
.bw-article table td {
  border: 1px solid #a2a9b1;
  padding: 6px 10px;
  vertical-align: top;
}
.bw-article hr {
  border: none;
  border-top: 1px solid #a2a9b1;
  margin: 18px 0;
}

/* Category page table */
.bw-cat-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin: 14px 0;
  background: #ffffff;
  border: 1px solid #a2a9b1;
}
.bw-cat-table th {
  background: #eaecf0;
  border: 1px solid #a2a9b1;
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
}
.bw-cat-table td {
  border: 1px solid #a2a9b1;
  padding: 8px 12px;
  vertical-align: middle;
}
.bw-cat-table td a { font-weight: 500; }
.bw-cat-table tr:hover td { background: #f8f9fa; }

/* Main page cards */
.bw-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
  margin: 18px 0;
}
.bw-card {
  background: #f8f9fa;
  border: 1px solid #a7d7f9;
  border-radius: 2px;
  padding: 14px 18px;
}
.bw-card h3 {
  margin: 0 0 6px;
  font-size: 15px;
  color: #202122;
  border-bottom: 1px solid #a7d7f9;
  padding-bottom: 4px;
}
.bw-card p { font-size: 12.5px; color: #54595d; margin: 4px 0 8px; }
.bw-card ul { list-style: none; padding: 0; margin: 0; font-size: 13px; }
.bw-card li { padding: 2px 0; }
.bw-card li::before { content: '▸ '; color: #a2a9b1; }

.bw-stats {
  display: flex;
  gap: 28px;
  margin: 8px 0 20px;
  padding: 10px 14px;
  background: #f8f9fa;
  border: 1px solid #eaecf0;
  border-radius: 2px;
  font-size: 12.5px;
  color: #54595d;
}
.bw-stats b { color: #202122; font-size: 15px; }

/* Wiki backlinks [[...]] */
.bw-backlink { color: #3366cc; }
.bw-backlink::before { content: '['; }
.bw-backlink::after { content: ']'; }

footer.bw-footer {
  margin-top: 40px;
  padding-top: 14px;
  border-top: 1px solid #c8ccd1;
  font-size: 11.5px;
  color: #72777d;
}

/* === TOC === */
.bw-toc {
  display: inline-block;
  background: #f8f9fa;
  border: 1px solid #a2a9b1;
  padding: 8px 14px 10px;
  margin: 16px 0 14px;
  font-size: 12.5px;
  min-width: 240px;
  max-width: 420px;
}
.bw-toc-header {
  text-align: center;
  padding-bottom: 4px;
  margin-bottom: 4px;
}
.bw-toc-title {
  font-weight: 700;
  font-size: 13px;
}
.bw-toc-toggle { margin-left: 8px; font-size: 11px; color: #54595d; }
.bw-toc-list, .bw-toc-sub {
  list-style: none;
  padding-left: 0;
  margin: 0;
}
.bw-toc-sub { padding-left: 18px; margin-top: 2px; }
.bw-toc-list li { padding: 1px 0; }
.bw-toc-num {
  display: inline-block;
  min-width: 24px;
  color: #54595d;
  margin-right: 2px;
}
.bw-toc.collapsed .bw-toc-list { display: none; }

/* === Heading edit pencils === */
.bw-edit-section {
  font-size: 11px;
  font-weight: 400;
  margin-left: 8px;
  color: #72777d;
  visibility: hidden;
}
.bw-article h1:hover .bw-edit-section,
.bw-article h2:hover .bw-edit-section,
.bw-article h3:hover .bw-edit-section { visibility: visible; }
.bw-edit-section a { color: #3366cc; }

/* === Infobox (grid column, not float) === */
.bw-infobox {
  width: 100%;
  margin: 0;
  background: #f8f9fa;
  border: 1px solid #a2a9b1;
  font-size: 12.5px;
}
.bw-infobox-title {
  background: #eaecf0;
  padding: 8px 12px;
  text-align: center;
  font-weight: 700;
  font-size: 14px;
  border-bottom: 1px solid #a2a9b1;
  font-family: 'Linux Libertine', 'Georgia', 'Hiragino Mincho ProN', 'Yu Mincho', serif;
}
.bw-infobox-caption {
  text-align: center;
  font-style: italic;
  color: #54595d;
  padding: 4px 12px;
  font-size: 11.5px;
  border-bottom: 1px solid #c8ccd1;
}
.bw-infobox table {
  width: 100%;
  border-collapse: collapse;
  background: none;
  border: none;
}
.bw-infobox table th, .bw-infobox table td {
  border: none;
  border-bottom: 1px solid #eaecf0;
  padding: 5px 10px;
  text-align: left;
  font-size: 12px;
  background: none;
}
.bw-infobox table th {
  width: 90px;
  font-weight: 600;
  color: #54595d;
  background: #f1f3f5;
}

/* === Red links (missing articles) === */
.bw-redlink { color: #ba0000; border-bottom: 1px dotted #ba0000; cursor: help; }

/* === References === */
.bw-references {
  font-size: 12.5px;
  padding-left: 0;
  list-style: none;
  margin: 10px 0 20px;
}
.bw-references li {
  padding: 3px 0 3px 24px;
  position: relative;
}
.bw-cite-num {
  position: absolute;
  left: 0;
  font-weight: 600;
  color: #54595d;
}

/* === Categories footer === */
.bw-cat-footer {
  margin-top: 28px;
  padding: 8px 12px;
  border: 1px solid #c8ccd1;
  background: #f8f9fa;
  font-size: 12.5px;
}
.bw-cat-tag {
  display: inline-block;
  padding: 2px 8px;
  margin: 0 4px;
  background: #ffffff;
  border: 1px solid #a2a9b1;
  border-radius: 2px;
  font-size: 12px;
}

/* === Sidebar search === */
.bw-search-form {
  display: flex;
  gap: 4px;
  margin: 8px 0 14px;
}
.bw-search-input {
  flex: 1;
  min-width: 0;
  padding: 3px 6px;
  border: 1px solid #a2a9b1;
  border-radius: 2px;
  font-size: 12px;
  font-family: inherit;
  background: #ffffff;
}
.bw-search-button {
  padding: 3px 8px;
  border: 1px solid #a2a9b1;
  background: #f8f9fa;
  cursor: pointer;
  font-size: 11px;
  border-radius: 2px;
}
.bw-search-button:hover { background: #eaecf0; }

/* === Search results === */
.bw-search-result {
  padding: 10px 0;
  border-bottom: 1px solid #eaecf0;
}
.bw-search-result-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 3px;
}
.bw-search-snippet {
  font-size: 12.5px;
  color: #54595d;
  line-height: 1.5;
}
.bw-search-snippet mark {
  background: #fef6e7;
  color: #202122;
  padding: 0 2px;
  font-weight: 600;
}
.bw-search-meta {
  font-size: 11px;
  color: #72777d;
  margin-top: 2px;
}

/* === Featured article === */
.bw-featured {
  border: 1px solid #a7d7f9;
  background: #f0f7ff;
  padding: 14px 18px;
  margin: 18px 0;
  border-radius: 2px;
}
.bw-featured h2 {
  font-size: 16px;
  margin: 0 0 6px;
  font-family: 'Linux Libertine', 'Georgia', serif;
  font-weight: 400;
  border-bottom: 1px solid #a7d7f9;
  padding-bottom: 4px;
  color: #202122;
}
.bw-featured-snippet {
  font-size: 13px;
  color: #54595d;
  line-height: 1.6;
}
.bw-featured-more {
  font-size: 12px;
  margin-top: 6px;
}

/* === View toggle === */
.bw-view-toggle {
  display: inline-flex;
  gap: 0;
  margin: 8px 0 16px;
  border: 1px solid #a2a9b1;
  border-radius: 2px;
  overflow: hidden;
  font-size: 12px;
}
.bw-view-toggle a {
  padding: 6px 16px;
  background: #f8f9fa;
  color: #54595d;
  border-right: 1px solid #a2a9b1;
  text-decoration: none;
  transition: background 0.2s ease, color 0.2s ease;
}
.bw-view-toggle a:last-child { border-right: none; }
.bw-view-toggle a:hover { background: #eaecf0; color: #202122; }
.bw-view-toggle a.active {
  background: #3366cc;
  color: #ffffff;
}

/* === Animations === */
@keyframes bw-step-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes bw-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
@keyframes bw-scan-sweep {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}
@keyframes bw-tick-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
/* View Transitions API — smooth cross-page fades in Chrome 111+/Safari 18+ */
@view-transition { navigation: auto; }
::view-transition-old(root), ::view-transition-new(root) {
  animation-duration: 0.18s;
}
.bw-article { animation: bw-step-in 0.16s ease-out both; }

/* Link underline slide-in */
.bw-article a, .bw-content a:not(.bw-badge):not([class*="bw-toc"]) {
  position: relative;
  transition: color 0.2s ease;
}
.bw-sidebar a {
  transition: color 0.18s ease, background 0.18s ease;
  padding: 1px 2px;
  border-radius: 2px;
}
.bw-sidebar a:hover { background: rgba(51, 102, 204, 0.08); text-decoration: none; }

/* === Category cards view === */
.bw-article-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 18px;
  margin: 18px 0 32px;
}
a.bw-article-card { text-decoration: none !important; color: inherit; }
a.bw-article-card:hover { text-decoration: none !important; }
.bw-article-card {
  position: relative;
  background: #ffffff;
  border: 1px solid #d8dce0;
  border-left: 4px solid var(--cat-color, #c8ccd1);
  border-radius: 0;
  padding: 18px 22px 16px;
  display: flex;
  flex-direction: column;
  min-height: 200px;
  opacity: 0;
  transform: translateY(10px);
  animation: bw-step-in 0.36s steps(6, end) forwards;
  transition: transform 0.1s steps(2, end),
              border-color 0.12s steps(3, end),
              box-shadow 0.12s steps(3, end);
}
.bw-article-card:hover {
  transform: translateY(-2px);
  border-color: #202122;
  border-left-color: var(--cat-color, #3366cc);
  box-shadow: 4px 4px 0 0 var(--cat-color, #3366cc);
}
/* HUD arrow on hover */
.bw-article-card::after {
  content: '[ READ ▸ ]';
  position: absolute;
  right: 18px;
  bottom: 12px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Menlo', monospace;
  font-size: 10px;
  letter-spacing: 0.5px;
  color: var(--cat-color, #3366cc);
  opacity: 0;
  transition: opacity 0.12s steps(3, end);
}
.bw-article-card:hover::after { opacity: 1; }

/* Corner register marks (crosshair) */
.bw-article-card > .bw-corner {
  position: absolute;
  width: 10px;
  height: 10px;
  opacity: 0;
  transition: opacity 0.12s steps(3, end);
  pointer-events: none;
}
.bw-article-card:hover > .bw-corner { opacity: 0.7; }
.bw-corner::before, .bw-corner::after {
  content: '';
  position: absolute;
  background: var(--cat-color, #3366cc);
}
.bw-corner::before { top: 0; left: 0; width: 10px; height: 1px; }
.bw-corner::after { top: 0; left: 0; width: 1px; height: 10px; }
.bw-corner.tr { top: 4px; right: 4px; transform: scaleX(-1); }
.bw-corner.bl { bottom: 4px; left: 4px; transform: scaleY(-1); }
.bw-corner.br { bottom: 4px; right: 4px; transform: scale(-1, -1); }
.bw-corner.tl { top: 4px; left: 4px; }

/* staggered entrance — quick cascade */
.bw-article-card { animation-duration: 0.22s; animation-timing-function: ease-out; }
.bw-article-card:nth-child(1) { animation-delay: 0.00s; }
.bw-article-card:nth-child(2) { animation-delay: 0.02s; }
.bw-article-card:nth-child(3) { animation-delay: 0.04s; }
.bw-article-card:nth-child(4) { animation-delay: 0.06s; }
.bw-article-card:nth-child(5) { animation-delay: 0.08s; }
.bw-article-card:nth-child(6) { animation-delay: 0.10s; }
.bw-article-card:nth-child(7) { animation-delay: 0.12s; }
.bw-article-card:nth-child(8) { animation-delay: 0.14s; }
.bw-article-card:nth-child(n+9) { animation-delay: 0.16s; }

.bw-article-card-eyebrow {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Menlo', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--cat-color, #72777d);
  font-weight: 600;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.bw-article-card-eyebrow::before {
  content: '>';
  color: var(--cat-color, #72777d);
  opacity: 0.7;
  margin-right: 2px;
}
.bw-key-badge {
  background: #fff;
  color: #9c6100;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Menlo', monospace;
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 0;
  letter-spacing: 1px;
  border: 1px solid #d4a300;
  text-transform: uppercase;
  font-weight: 700;
}
.bw-article-card-title {
  font-family: 'Linux Libertine', 'Georgia', 'Hiragino Mincho ProN', 'Yu Mincho', serif;
  font-size: 19px;
  font-weight: 400;
  margin: 0 0 8px;
  line-height: 1.35;
  color: #202122;
}
.bw-article-card-title a {
  color: #202122;
  transition: color 0.12s steps(3, end);
}
.bw-article-card:hover .bw-article-card-title { color: var(--cat-color, #3366cc); }
.bw-article-card-excerpt {
  font-size: 13px;
  color: #54595d;
  line-height: 1.7;
  flex: 1;
  margin: 2px 0 14px;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bw-article-card-meta {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Menlo', monospace;
  font-size: 10.5px;
  color: #72777d;
  padding-top: 10px;
  border-top: 1px dashed #d8dce0;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  letter-spacing: 0.3px;
}
.bw-article-card-meta .bw-dot {
  display: inline-block;
  width: 3px;
  height: 3px;
  background: #a2a9b1;
  border-radius: 0;
}
.bw-article-card-meta strong {
  color: #202122;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

/* Featured card (first, full width) */
.bw-article-card.featured {
  grid-column: 1 / -1;
  min-height: 180px;
  background: #ffffff;
  border-left-width: 6px;
  padding: 26px 32px 22px;
  overflow: hidden;
}
/* Subtle scanline overlay — analog CRT feel */
.bw-article-card.featured::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent 0,
    transparent 2px,
    rgba(0, 0, 0, 0.014) 2px,
    rgba(0, 0, 0, 0.014) 3px
  );
  pointer-events: none;
  z-index: 0;
}
.bw-article-card.featured > * { position: relative; z-index: 1; }
.bw-article-card.featured .bw-article-card-title {
  font-size: 28px;
  margin-bottom: 10px;
}
.bw-article-card.featured .bw-article-card-title::after {
  content: '▊';
  display: inline-block;
  color: var(--cat-color, #3366cc);
  margin-left: 4px;
  font-size: 0.75em;
  vertical-align: baseline;
  animation: bw-blink 1.06s steps(2, end) infinite;
}
.bw-article-card.featured .bw-article-card-excerpt {
  font-size: 14.5px;
  line-height: 1.75;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  max-width: 760px;
}
.bw-article-card.featured .bw-article-card-title::first-letter {
  font-size: 1.25em;
  font-weight: 500;
  color: var(--cat-color, #202122);
}

/* === Alphabetical view === */
.bw-alpha-group { margin: 14px 0; }
.bw-alpha-header {
  font-family: 'Linux Libertine', 'Georgia', serif;
  font-size: 20px;
  font-weight: 400;
  padding: 2px 0 2px 10px;
  border-bottom: 1px solid #a2a9b1;
  background: #f8f9fa;
  color: #54595d;
  margin: 10px 0 6px;
}
.bw-alpha-list {
  list-style: disc;
  padding-left: 32px;
  font-size: 14px;
  margin: 4px 0;
}
.bw-alpha-list li { padding: 2px 0; }
.bw-conf-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  margin-left: 6px;
  vertical-align: middle;
}
.bw-conf-dot.high { background: #14866d; }
.bw-conf-dot.medium { background: #ac6600; }
.bw-conf-dot.low { background: #b32424; }

/* === Recent changes === */
.bw-recent-list { list-style: none; padding: 0; font-size: 13px; }
.bw-recent-list li { padding: 4px 0; border-bottom: 1px dashed #eaecf0; }
.bw-recent-date { color: #72777d; font-size: 11.5px; margin-right: 8px; }

/* === Mermaid === */
.mermaid { text-align: center; margin: 14px 0; }

/* === Print === */
@media print {
  body { background: #ffffff; }
  .bw-sidebar, .bw-header, .bw-edit-section, .bw-footer,
  .bw-toc-toggle, .bw-search-form { display: none !important; }
  .bw-main { border: none !important; }
  .bw-content { padding: 0; max-width: none; }
  .bw-infobox { float: none; width: 100%; margin: 10px 0; page-break-inside: avoid; }
  a { color: #000 !important; text-decoration: none !important; }
  pre, code { background: #f0f0f0 !important; }
}
`;

export function htmlShell(params: {
  title: string;
  projectName: string;
  categories: Array<{ id: string; title: string }>;
  currentCategory?: string;
  body: string;
  lastCompile?: string | null;
  extraHead?: string;
  extraBodyEnd?: string;
  needsMermaid?: boolean;
  needsHighlight?: boolean;
  needsD3?: boolean;
}): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(params.title)} — ${escapeHtml(params.projectName)} Wiki</title>
${params.needsHighlight ? `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>` : ''}
${params.needsD3 ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>` : ''}
<style>${SITE_CSS}</style>
${params.extraHead ?? ''}
</head>
<body>
<header class="bw-topbar">
  <a class="bw-topbar-brand" href="/">
    <span class="bw-topbar-brand-mark">◼</span>
    <span class="bw-topbar-brand-name">${escapeHtml(params.projectName)}</span>
    <span class="bw-topbar-brand-sub">WIKI</span>
  </a>
  <nav class="bw-topbar-nav">
    <a href="/">Main</a>
    <a href="/all">All</a>
    <a href="/special/recent-changes">Recent</a>
    <a href="/random">Random</a>
  </nav>
  <form class="bw-topbar-search" action="/search" method="get">
    <span class="bw-topbar-search-icon">⌕</span>
    <input type="text" name="q" placeholder="Search wiki..." autocomplete="off">
    <span class="bw-topbar-search-kbd">⏎</span>
  </form>
  <div class="bw-live disconnected" id="bw-live" title="Watch モードに接続中...">
    <span class="bw-live-dot" aria-hidden="true"></span>
    <span class="bw-live-text">Offline</span>
    <span class="bw-live-time" id="bw-live-time">—</span>
  </div>
</header>
<main class="bw-page">
  <div class="bw-page-inner">
    ${params.body}
    <footer class="bw-footer">
      ${params.lastCompile ? `Last compiled: ${escapeHtml(formatJST(params.lastCompile))} · ` : ''}
      Generated by brandwiki-engine · This wiki is compiled by LLM from raw sources. Do not edit manually.
    </footer>
  </div>
</main>
<script>
/* Hover + touch prefetch — warm the server cache before the click */
(function(){
  var seen = new Set();
  function shouldPrefetch(url){
    if (!url) return false;
    if (!url.startsWith('/')) return false;
    if (seen.has(url)) return false;
    if (url.startsWith('/_events') || url.startsWith('/random')) return false;
    return url === '/' || url.startsWith('/article/') || url.startsWith('/category/') ||
           url.startsWith('/all') || url.startsWith('/special/');
  }
  function prefetch(a){
    var url = a.getAttribute('href');
    if (!shouldPrefetch(url)) return;
    seen.add(url);
    try {
      fetch(url, { credentials: 'same-origin', priority: 'low' }).catch(function(){});
    } catch (e) {}
  }
  function handler(e){
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (a) prefetch(a);
  }
  document.addEventListener('mouseover', handler, { passive: true });
  document.addEventListener('touchstart', handler, { passive: true });
})();
</script>
${params.extraBodyEnd ?? ''}
${params.needsMermaid ? `<script type="module">
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs');
    mod.default.initialize({ startOnLoad: true, theme: 'neutral' });
  } catch (e) { console.warn('Mermaid failed to load', e); }
</script>` : ''}
${params.needsHighlight ? `<script>
  window.addEventListener('load', () => { try { if (window.hljs) hljs.highlightAll(); } catch (e) {} });
</script>` : ''}
</body>
</html>`;
}

export const CATEGORY_COLORS: Record<string, string> = {
  '01-brand': '#b84949',
  '02-product': '#3366cc',
  '03-medical': '#2c8a6d',
  '04-design': '#7856a8',
  '05-architecture': '#516581',
  '06-content': '#a16720',
  '07-operations': '#6b7280',
  '08-history': '#805e9c',
  '09-market': '#c1801f',
};

export function categoryColor(id: string): string {
  return CATEGORY_COLORS[id] ?? '#54595d';
}

export function readingTimeJa(wordCount: number): string {
  const minutes = Math.max(1, Math.round(wordCount / 180));
  return `${minutes}分で読める`;
}

export function relativeTimeJa(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHr < 24) return `${diffHr}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}週間前`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}ヶ月前`;
  return `${Math.floor(diffDay / 365)}年前`;
}

export function formatJST(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} JST`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
