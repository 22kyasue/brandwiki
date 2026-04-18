export const SITE_CSS = `
/* Ambient Dark Brand Wiki */
:root {
  --bw-bg: #08080f;
  --bw-page-bg: #0c0c18;
  --bw-text: #d4d4e0;
  --bw-text-secondary: #8e92a8;
  --bw-text-muted: #505468;
  --bw-border: #1a1c30;
  --bw-border-light: #141628;
  --bw-card-bg: #101020;
  --bw-sidebar-bg: #0a0a14;
  --bw-topbar-bg: #0a0a14;
  --bw-link: #7b93ff;
  --bw-link-visited: #9a7ee8;
  --bw-code-bg: #0e0e1c;
  --bw-input-bg: #101020;
  --bw-input-focus-bg: #0c0c18;
  --bw-kbd-bg: #1a1c30;
  --bw-graph-legend-bg: #101020;
  --bw-search-border: #1a1c30;
  --bw-accent: #7b93ff;
  --bw-accent-secondary: #a78bfa;
  --bw-accent-glow: rgba(123, 147, 255, 0.12);
  --bw-accent-glow-strong: rgba(123, 147, 255, 0.25);
  --bw-warm-glow: rgba(251, 191, 114, 0.06);
  --bw-radius: 10px;
  --bw-featured-avatar-bg: linear-gradient(135deg, #1a1c30 0%, #101020 100%);
  --bw-featured-avatar-border: #1a1c30;
}
/* Light mode override — kept for accessibility but dark is default */
[data-theme="light"] {
  --bw-bg: #f0f2f5;
  --bw-page-bg: #ffffff;
  --bw-text: #1a1a2e;
  --bw-text-secondary: #444a5a;
  --bw-text-muted: #6b7280;
  --bw-border: #e0e4ea;
  --bw-border-light: #edf0f4;
  --bw-card-bg: #ffffff;
  --bw-sidebar-bg: #f7f8fa;
  --bw-topbar-bg: #ffffff;
  --bw-link: #4f6ef7;
  --bw-link-visited: #7c5cbf;
  --bw-code-bg: #f4f6f9;
  --bw-input-bg: #f4f6f9;
  --bw-input-focus-bg: #ffffff;
  --bw-kbd-bg: #e8ecf2;
  --bw-graph-legend-bg: #ffffff;
  --bw-search-border: #d0d5dd;
  --bw-accent: #4f6ef7;
  --bw-accent-secondary: #8b5cf6;
  --bw-accent-glow: rgba(79, 110, 247, 0.1);
  --bw-accent-glow-strong: rgba(79, 110, 247, 0.2);
  --bw-warm-glow: rgba(251, 191, 114, 0.08);
  --bw-featured-avatar-bg: linear-gradient(135deg, #e8ecf2 0%, #d0d5dd 100%);
  --bw-featured-avatar-border: #d0d5dd;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Inter', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', system-ui, -apple-system, sans-serif;
  font-size: 15.5px;
  line-height: 1.75;
  color: var(--bw-text);
  background: var(--bw-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
a { color: var(--bw-link); text-decoration: none; transition: color 0.25s ease; }
a:visited { color: var(--bw-link-visited); }
a:hover { color: #a0b4ff; text-decoration: none; }
a.new { color: #f87171; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}

/* === Top header bar === */
.bw-topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 60px;
  background: rgba(10, 10, 20, 0.92);
  border-bottom: none;
  display: flex;
  align-items: center;
  padding: 0 32px;
  gap: 36px;
  backdrop-filter: blur(16px) saturate(1.3);
}
[data-theme="light"] .bw-topbar {
  background: rgba(255, 255, 255, 0.88);
}
.bw-topbar::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--bw-accent) 20%,
    var(--bw-accent-secondary) 50%,
    var(--bw-accent) 80%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: bw-topbar-glow 6s ease-in-out infinite;
  opacity: 0.5;
  box-shadow: 0 0 20px var(--bw-accent-glow), 0 0 6px var(--bw-accent-glow);
}
.bw-topbar-brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--bw-text);
  font-family: 'Inter', 'Hiragino Sans', system-ui, sans-serif;
}
.bw-topbar-brand:hover { text-decoration: none; }
.bw-topbar-brand-mark {
  color: var(--bw-accent);
  font-size: 16px;
  line-height: 1;
}
.bw-topbar-brand-name {
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.5px;
}
.bw-topbar-brand-sub {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 9.5px;
  letter-spacing: 2.5px;
  color: var(--bw-text-muted);
  font-weight: 600;
  margin-left: 2px;
  align-self: center;
  margin-top: 4px;
  opacity: 0.7;
}
.bw-topbar-nav {
  display: flex;
  gap: 6px;
  font-size: 12.5px;
  font-family: 'Inter', system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}
.bw-topbar-nav a {
  color: var(--bw-text-secondary);
  padding: 8px 14px;
  border-radius: 8px;
  border-bottom: none;
  transition: color 0.2s ease, background 0.2s ease;
  font-weight: 500;
}
.bw-topbar-nav a:hover {
  color: var(--bw-text);
  background: var(--bw-accent-glow);
  text-decoration: none;
}
.bw-topbar-search {
  margin-left: auto;
  position: relative;
  display: flex;
  align-items: center;
}
.bw-topbar-search input {
  width: 260px;
  padding: 10px 40px 10px 38px;
  border: 1px solid var(--bw-search-border);
  border-radius: 22px;
  font-size: 13.5px;
  font-family: inherit;
  background: var(--bw-input-bg);
  color: var(--bw-text);
  transition: border-color 0.2s ease, background 0.2s ease, width 0.25s ease, box-shadow 0.2s ease;
}
.bw-topbar-search input:focus {
  outline: none;
  border-color: var(--bw-accent);
  background: var(--bw-input-focus-bg);
  width: 340px;
  box-shadow: 0 0 0 3px var(--bw-accent-glow);
}
.bw-topbar-search input::placeholder { color: var(--bw-text-muted); opacity: 0.6; }
.bw-topbar-search-icon {
  position: absolute;
  left: 14px;
  font-size: 16px;
  color: var(--bw-text-muted);
  pointer-events: none;
}
.bw-topbar-search-kbd {
  position: absolute;
  right: 14px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 10px;
  color: var(--bw-text-muted);
  background: var(--bw-kbd-bg);
  padding: 2px 7px;
  border-radius: 4px;
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
  min-height: calc(100vh - 60px);
  background: var(--bw-page-bg);
  position: relative;
}
.bw-page::before {
  content: '';
  position: fixed;
  top: -20%;
  left: -10%;
  width: 50%;
  height: 50%;
  background: radial-gradient(ellipse, rgba(123, 147, 255, 0.04) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}
.bw-page::after {
  content: '';
  position: fixed;
  bottom: -20%;
  right: -10%;
  width: 50%;
  height: 50%;
  background: radial-gradient(ellipse, rgba(167, 139, 250, 0.03) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}
[data-theme="light"] .bw-page::before,
[data-theme="light"] .bw-page::after { display: none; }
.bw-page-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 36px 40px 72px;
  position: relative;
  z-index: 1;
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
  top: 80px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  overflow-x: hidden;
  font-size: 13px;
  padding: 4px 20px 20px 0;
  border-right: 1px solid var(--bw-border-light);
  z-index: 1;
  word-break: break-word;
}
.bw-toc-sidebar-header {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--bw-text-muted);
  margin: 0 0 12px;
  padding: 0 0 8px;
  border-bottom: 1px solid var(--bw-border);
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
  border-left: 1px solid var(--bw-border-light, #eaecf0);
  padding-left: 10px;
  margin-left: 4px;
}
.bw-toc-sidebar li {
  padding: 3px 0;
  line-height: 1.45;
}
.bw-toc-sidebar a {
  color: var(--bw-text-secondary);
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
  overflow: hidden;
}
.bw-article-infobox-col {
  position: sticky;
  top: 74px;
  max-height: calc(100vh - 94px);
  overflow-y: auto;
  z-index: 2;
}

/* Narrow viewports: collapse to two columns */
@media (max-width: 1180px) {
  .bw-article-layout,
  .bw-article-layout.no-toc,
  .bw-article-layout.no-infobox {
    grid-template-columns: 200px minmax(0, 1fr);
  }
  .bw-article-infobox-col {
    grid-column: 1 / -1;
    position: static;
    max-height: none;
    overflow: visible;
    z-index: auto;
  }
  .bw-toc-sidebar {
    position: static;
    max-height: none;
    overflow: visible;
    z-index: auto;
  }
  .bw-article-layout.no-toc .bw-article-infobox-col { grid-column: 1 / -1; }
}
/* Very narrow: single column */
@media (max-width: 960px) {
  .bw-article-layout,
  .bw-article-layout.no-toc,
  .bw-article-layout.no-infobox {
    grid-template-columns: 1fr;
  }
  .bw-toc-sidebar {
    position: static;
    border-right: none;
    border-bottom: 1px solid var(--bw-border-light, #e4e6ea);
    padding: 0 0 14px 0;
    max-height: none;
    width: 100%;
    overflow: visible;
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
  background: var(--bw-card-bg);
  border: 1px solid var(--bw-border);
  border-radius: var(--bw-radius);
  overflow: hidden;
  animation: bw-step-in 0.4s ease-out both;
  transition: box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease;
}
.bw-dash-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 24px var(--bw-accent-glow);
  border-color: rgba(123, 147, 255, 0.2);
}
[data-theme="light"] .bw-dash-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  border-color: #d0d5dd;
}
.bw-dash-card-header {
  padding: 12px 20px;
  font-family: 'Inter', 'Hiragino Sans', system-ui, sans-serif;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--bw-text);
  border-bottom: 1px solid var(--bw-border);
  letter-spacing: -0.2px;
}
.bw-dash-card-header.green { background: rgba(34, 197, 94, 0.08); border-bottom-color: rgba(34, 197, 94, 0.3); }
.bw-dash-card-header.blue { background: rgba(59, 130, 246, 0.08); border-bottom-color: rgba(59, 130, 246, 0.3); }
.bw-dash-card-header.purple { background: rgba(139, 92, 246, 0.08); border-bottom-color: rgba(139, 92, 246, 0.3); }
.bw-dash-card-header.yellow { background: rgba(245, 158, 11, 0.08); border-bottom-color: rgba(245, 158, 11, 0.3); }
.bw-dash-card-header.pink { background: rgba(236, 72, 153, 0.08); border-bottom-color: rgba(236, 72, 153, 0.3); }
[data-theme="light"] .bw-dash-card-header.green { background: #ecfdf5; border-bottom-color: #86efac; }
[data-theme="light"] .bw-dash-card-header.blue { background: #eff6ff; border-bottom-color: #93bbfd; }
[data-theme="light"] .bw-dash-card-header.purple { background: #f5f3ff; border-bottom-color: #c4b5fd; }
[data-theme="light"] .bw-dash-card-header.yellow { background: #fffbeb; border-bottom-color: #fcd34d; }
[data-theme="light"] .bw-dash-card-header.pink { background: #fdf2f8; border-bottom-color: #f9a8d4; }
.bw-dash-card-body {
  padding: 16px 20px 18px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--bw-text);
}
.bw-welcome-header {
  text-align: center;
  font-family: 'Inter', 'Hiragino Sans', system-ui, sans-serif;
  padding: 24px 0 10px;
}
.bw-welcome-title {
  font-size: 38px;
  font-weight: 300;
  color: var(--bw-text);
  letter-spacing: -0.5px;
}
.bw-welcome-title em {
  font-style: normal;
  font-weight: 700;
  background: linear-gradient(135deg, var(--bw-accent), var(--bw-accent-secondary), #f0abfc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.bw-welcome-sub {
  font-size: 15px;
  color: var(--bw-text-secondary);
  margin-top: 4px;
  font-weight: 400;
}
.bw-welcome-stats {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 11.5px;
  color: var(--bw-text-muted);
  margin: 8px 0 2px;
  letter-spacing: 0.5px;
}

/* Featured article preview with image (placeholder) */
.bw-dash-featured { display: flex; gap: 14px; }
.bw-dash-featured-avatar {
  width: 100px;
  height: 100px;
  flex-shrink: 0;
  background: var(--bw-featured-avatar-bg);
  border: 1px solid var(--bw-featured-avatar-border);
  border-radius: var(--bw-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 34px;
  color: var(--bw-text-muted);
}
.bw-dash-featured-body { flex: 1; min-width: 0; }
.bw-dash-featured-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--bw-link);
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
  color: var(--bw-text-secondary);
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
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 32px;
  font-weight: 800;
  color: var(--bw-text);
  line-height: 1;
  letter-spacing: -0.5px;
}
.bw-health-label {
  font-size: 11.5px;
  color: var(--bw-text-muted);
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  letter-spacing: 0.5px;
  margin-top: 6px;
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
  padding: 20px 22px 18px;
  background: var(--bw-card-bg);
  border: 1px solid var(--bw-border);
  border-top: 3px solid var(--cat-color, var(--bw-text-muted));
  border-radius: var(--bw-radius);
  text-decoration: none !important;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: box-shadow 0.25s ease, transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1), border-color 0.2s ease;
}
.bw-browse-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 12px 36px rgba(0, 0, 0, 0.5),
    0 0 30px var(--bw-accent-glow);
  border-color: rgba(123, 147, 255, 0.2);
}
[data-theme="light"] .bw-browse-card:hover {
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
  border-color: #d0d5dd;
}
.bw-browse-card-title {
  font-family: 'Inter', 'Hiragino Sans', system-ui, sans-serif;
  font-size: 17px;
  font-weight: 700;
  color: var(--bw-text);
  display: flex;
  align-items: baseline;
  gap: 6px;
  letter-spacing: -0.2px;
}
.bw-browse-card-mark {
  color: var(--cat-color, #72777d);
  font-size: 12px;
}
.bw-browse-card-desc {
  font-size: 12.5px;
  color: var(--bw-text-secondary);
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
  top: 80px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  font-size: 13.5px;
  padding: 0 20px 20px 0;
  border-right: 1px solid var(--bw-border-light);
}
.bw-context-nav-section { margin-bottom: 22px; }
.bw-context-nav-header {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--bw-text-muted);
  margin: 0 0 10px;
  padding: 0 0 8px;
  border-bottom: 1px solid var(--bw-border);
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
  gap: 8px;
  color: var(--bw-text);
  padding: 6px 10px;
  border-radius: 8px;
  border-left: 2px solid transparent;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}
.bw-context-nav a:hover {
  background: var(--bw-accent-glow);
  text-decoration: none;
}
.bw-context-nav a.active {
  background: var(--bw-accent-glow);
  border-left-color: var(--cat-color, var(--bw-accent));
  color: var(--cat-color, var(--bw-accent));
  font-weight: 700;
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
  background: #1a1a2e;
  border: none;
  border-top: 1px solid #2a2a3e;
  border-radius: 0 0 4px 4px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Hiragino Sans', 'Noto Sans JP', sans-serif;
}
.bw-graph-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
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
  border-bottom: 1px solid var(--bw-border-light);
  background: var(--bw-graph-legend-bg);
  color: var(--bw-text-secondary);
  align-items: center;
}
.bw-graph-legend .bw-legend-label {
  font-weight: 700;
  color: var(--bw-text);
  margin-right: 10px;
  font-family: 'Inter', 'Hiragino Sans', system-ui, sans-serif;
  font-size: 13.5px;
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

/* Edge type legend */
.bw-edge-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 16px;
  font-size: 12px;
  color: #72777d;
  background: #fafafa;
  border-top: 1px solid #eaecf0;
}
.bw-edge-legend-label {
  font-weight: 600;
  color: #54595d;
}
.bw-edge-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.bw-edge-line {
  display: inline-block;
  width: 20px;
  height: 2px;
  border-radius: 1px;
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
  font-family: 'Inter', 'Hiragino Sans', system-ui, sans-serif;
  font-size: 15px;
  color: #1a1a2e;
  font-weight: 700;
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
  stroke: rgba(255, 255, 255, 0.15);
  stroke-width: 1.5px;
  filter: saturate(1.2) brightness(1.1);
}
#bw-graph-svg .node.pinned .atom-ring {
  stroke: rgba(255, 255, 255, 0.4);
  stroke-width: 1px;
  stroke-dasharray: 2 2;
  fill: none;
}
#bw-graph-svg .node.highlight .atom {
  stroke: rgba(255, 255, 255, 0.6);
  stroke-width: 2px;
}
#bw-graph-svg .node.dim { opacity: 0.12; }
#bw-graph-svg .node.hit .atom {
  stroke: rgba(255, 255, 255, 0.8);
  stroke-width: 2px;
}
#bw-graph-svg .node text.label {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  font-size: 11px;
  font-weight: 400;
  fill: #e0e0e8;
  pointer-events: none;
  text-anchor: middle;
  opacity: 0.7;
  transition: opacity 0.2s ease, fill 0.2s ease;
  paint-order: stroke;
  stroke: #1a1a2e;
  stroke-width: 3.5px;
  stroke-linejoin: round;
}
#bw-graph-svg .node.highlight text.label {
  fill: #ffffff;
  font-weight: 600;
  opacity: 1;
}
#bw-graph-svg .node.anchor text.label { opacity: 0.8; }
#bw-graph-svg .node.pinned text.label { opacity: 0.9; }
#bw-graph-svg .node.hit text.label { opacity: 1; fill: #ffffff; }
#bw-graph-svg .node.dim text.label { opacity: 0 !important; }
/* When zoomed in, all labels appear */
#bw-graph-svg.zoomed-in .node text.label { opacity: 0.85; }
#bw-graph-svg.zoomed-in .node.dim text.label { opacity: 0 !important; }
#bw-graph-svg .link {
  stroke: rgba(160, 170, 200, 0.35);
  stroke-opacity: 1;
  stroke-width: 1px;
  fill: none;
  transition: stroke-opacity 0.2s ease, stroke-width 0.2s ease, stroke 0.2s ease;
}
#bw-graph-svg .link[data-type="competitor"] { stroke: #ef4444; stroke-opacity: 0.7; }
#bw-graph-svg .link[data-type="partner"] { stroke: #22c55e; stroke-opacity: 0.7; }
#bw-graph-svg .link[data-type="investment"] { stroke: #f59e0b; stroke-opacity: 0.7; }
#bw-graph-svg .link.dim { stroke-opacity: 0.06; }
#bw-graph-svg .link.highlight {
  stroke: #6699ff;
  stroke-opacity: 1;
  stroke-width: 2px;
  stroke-dasharray: 8 4;
  animation: bw-link-flow 1s linear infinite;
}
@keyframes bw-link-flow {
  to { stroke-dashoffset: -12; }
}
#bw-graph-svg .node.highlight .atom {
  filter: drop-shadow(0 0 6px currentColor);
}
#bw-graph-svg .node .atom { transition: filter .2s ease, r .25s ease; }
#bw-graph-svg .node.new .atom {
  animation: bw-node-popin .7s cubic-bezier(.2,.9,.3,1.3);
  transform-box: fill-box; transform-origin: center;
}
@keyframes bw-node-popin {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.35); }
  100% { transform: scale(1); opacity: 1; }
}
#bw-graph-svg.bw-pulse .node .atom {
  animation: bw-node-pulse .9s ease;
}
@keyframes bw-node-pulse {
  0% { filter: brightness(1); }
  40% { filter: brightness(1.7) drop-shadow(0 0 8px currentColor); }
  100% { filter: brightness(1); }
}
#bw-graph-svg.bw-pulse .link {
  animation: bw-link-pulse .9s ease;
}
@keyframes bw-link-pulse {
  0% { stroke-opacity: 0.55; }
  40% { stroke-opacity: 1; stroke-width: 2px; }
  100% { stroke-opacity: 0.55; }
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
  background: rgba(30, 30, 50, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #e0e0e8;
  backdrop-filter: blur(6px);
  transition: border-color 0.15s ease, width 0.2s ease, background 0.15s ease;
}
.bw-graph-mini-search input::placeholder { color: rgba(255, 255, 255, 0.35); }
.bw-graph-mini-search input:focus {
  outline: none;
  border-color: #6699ff;
  width: 260px;
  background: rgba(20, 20, 40, 0.95);
}
.bw-graph-zoom {
  position: absolute;
  bottom: 14px;
  left: 14px;
  z-index: 5;
  display: flex;
  gap: 0;
  background: rgba(30, 30, 50, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  overflow: hidden;
  backdrop-filter: blur(6px);
  font-family: -apple-system, 'Segoe UI', 'Inter', sans-serif;
}
.bw-graph-zoom button {
  background: transparent;
  border: none;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
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
  background: rgba(255, 255, 255, 0.1);
  color: #6699ff;
}
.bw-graph-zoom .bw-graph-zoom-level {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  padding: 0 10px;
  display: flex;
  align-items: center;
  min-width: 46px;
  justify-content: center;
  font-variant-numeric: tabular-nums;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.bw-graph-mini-hint {
  position: absolute;
  bottom: 14px;
  right: 14px;
  z-index: 5;
  font-family: -apple-system, 'Segoe UI', 'Inter', sans-serif;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  pointer-events: none;
  letter-spacing: 0.2px;
}
.bw-graph-mini-hint kbd {
  display: inline-block;
  padding: 0 5px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.4);
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
  color: var(--bw-text-secondary);
  margin-bottom: 8px;
}
.bw-breadcrumb a { color: var(--bw-link); }

.bw-title {
  font-family: 'Inter', 'Hiragino Sans', system-ui, sans-serif;
  font-size: 34px;
  font-weight: 800;
  padding-bottom: 8px;
  margin: 0 0 6px;
  border-bottom: 2px solid var(--bw-border);
  line-height: 1.25;
  letter-spacing: -0.5px;
}
.bw-subtitle {
  font-size: 14px;
  color: var(--bw-text-secondary);
  margin-bottom: 20px;
  font-style: normal;
  font-weight: 400;
}

.bw-meta {
  background: var(--bw-code-bg);
  border: 1px solid var(--bw-border);
  border-radius: var(--bw-radius);
  padding: 14px 18px;
  margin: 0 0 22px;
  font-size: 13.5px;
  color: var(--bw-text-secondary);
}
.bw-meta table { width: 100%; border-collapse: collapse; }
.bw-meta td { padding: 4px 10px 4px 0; vertical-align: top; }
.bw-meta td:first-child { font-weight: 700; white-space: nowrap; color: var(--bw-text); width: 110px; font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.3px; }
.bw-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.bw-badge.status-draft { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
.bw-badge.status-stable { background: rgba(34, 197, 94, 0.1); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.2); }
.bw-badge.conf-high { background: rgba(34, 197, 94, 0.1); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.2); }
.bw-badge.conf-medium { background: rgba(245, 158, 11, 0.1); color: #fbbf72; border: 1px solid rgba(245, 158, 11, 0.2); }
.bw-badge.conf-low { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
[data-theme="light"] .bw-badge.status-draft { background: #fef2f2; color: #dc2626; border: none; }
[data-theme="light"] .bw-badge.status-stable { background: #ecfdf5; color: #059669; border: none; }
[data-theme="light"] .bw-badge.conf-high { background: #ecfdf5; color: #059669; border: none; }
[data-theme="light"] .bw-badge.conf-medium { background: #fffbeb; color: #d97706; border: none; }
[data-theme="light"] .bw-badge.conf-low { background: #fef2f2; color: #dc2626; border: none; }

/* Article body */
.bw-article { font-size: 15.5px; }
.bw-article h1 {
  font-family: 'Inter', 'Hiragino Sans', system-ui, sans-serif;
  font-size: 28px;
  font-weight: 700;
  border-bottom: 2px solid var(--bw-border);
  padding-bottom: 6px;
  margin: 32px 0 12px;
  letter-spacing: -0.3px;
}
.bw-article h2 {
  font-family: 'Inter', 'Hiragino Sans', system-ui, sans-serif;
  font-size: 23px;
  font-weight: 700;
  border-bottom: 1px solid var(--bw-border);
  padding-bottom: 5px;
  margin: 28px 0 10px;
  letter-spacing: -0.2px;
}
.bw-article h3 { font-size: 18px; font-weight: 700; margin: 22px 0 8px; }
.bw-article h4 { font-size: 15.5px; font-weight: 700; margin: 18px 0 6px; }
.bw-article p { margin: 10px 0; }
.bw-article ul, .bw-article ol { margin: 8px 0 14px 0; padding-left: 28px; }
.bw-article li { margin: 4px 0; }
.bw-article code {
  background: var(--bw-code-bg);
  border: 1px solid var(--bw-border-light);
  border-radius: 5px;
  padding: 2px 6px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
}
.bw-article pre {
  background: var(--bw-code-bg);
  border: 1px solid var(--bw-border-light);
  border-radius: var(--bw-radius);
  padding: 16px 20px;
  overflow-x: auto;
  font-size: 13.5px;
  line-height: 1.6;
}
.bw-article pre code { background: none; border: none; padding: 0; }
.bw-article blockquote {
  margin: 14px 0;
  padding: 12px 20px;
  border-left: 3px solid rgba(123, 147, 255, 0.4);
  background: rgba(123, 147, 255, 0.04);
  color: var(--bw-text-secondary);
  border-radius: 0 var(--bw-radius) var(--bw-radius) 0;
}
.bw-article table {
  border-collapse: separate;
  border-spacing: 0;
  margin: 16px 0;
  background: var(--bw-card-bg);
  border: 1px solid var(--bw-border);
  border-radius: var(--bw-radius);
  overflow: hidden;
}
.bw-article table th {
  background: var(--bw-code-bg);
  border-bottom: 2px solid var(--bw-border);
  padding: 10px 14px;
  text-align: left;
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.bw-article table td {
  border-bottom: 1px solid var(--bw-border-light);
  padding: 10px 14px;
  vertical-align: top;
}
.bw-article table tr:last-child td { border-bottom: none; }
.bw-article hr {
  border: none;
  border-top: 1px solid var(--bw-border);
  margin: 24px 0;
}

/* Category page table */
.bw-cat-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 14px;
  margin: 18px 0;
  background: var(--bw-card-bg);
  border: 1px solid var(--bw-border);
  border-radius: var(--bw-radius);
  overflow: hidden;
}
.bw-cat-table th {
  background: var(--bw-code-bg);
  border-bottom: 2px solid var(--bw-border);
  padding: 12px 16px;
  text-align: left;
  font-weight: 700;
  font-size: 12.5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--bw-text-secondary);
}
.bw-cat-table td {
  border-bottom: 1px solid var(--bw-border-light);
  padding: 12px 16px;
  vertical-align: middle;
}
.bw-cat-table tr:last-child td { border-bottom: none; }
.bw-cat-table td a { font-weight: 600; }
.bw-cat-table tr:hover td { background: var(--bw-accent-glow); }

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
  border-top: 1px solid var(--bw-border);
  font-size: 11.5px;
  color: var(--bw-text-muted);
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
  background: var(--bw-code-bg);
  border: 1px solid var(--bw-border);
  border-radius: var(--bw-radius);
  font-size: 13.5px;
  overflow: hidden;
}
.bw-infobox-title {
  background: var(--bw-card-bg);
  padding: 12px 16px;
  text-align: center;
  font-weight: 800;
  font-size: 15px;
  border-bottom: 2px solid var(--bw-border);
  font-family: 'Inter', 'Hiragino Sans', system-ui, sans-serif;
  letter-spacing: -0.2px;
}
.bw-infobox-caption {
  text-align: center;
  font-style: normal;
  color: var(--bw-text-secondary);
  padding: 6px 14px;
  font-size: 12px;
  border-bottom: 1px solid var(--bw-border-light);
}
.bw-infobox table {
  width: 100%;
  border-collapse: collapse;
  background: none;
  border: none;
}
.bw-infobox table th, .bw-infobox table td {
  border: none;
  border-bottom: 1px solid var(--bw-border-light, #eaecf0);
  padding: 5px 10px;
  text-align: left;
  font-size: 12px;
  background: none;
  color: var(--bw-text, #202122);
}
.bw-infobox table th {
  width: 90px;
  font-weight: 600;
  color: var(--bw-text-secondary, #54595d);
  background: var(--bw-sidebar-bg, #f1f3f5);
}

/* === Red links (missing articles) === */
.bw-redlink { color: #ba0000; border-bottom: 1px dotted #ba0000; cursor: help; }

/* === Brandbook Consulting Report Style === */
.bb-report {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 32px;
  font-family: 'Inter', -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
}
.bb-report-header {
  border-bottom: 3px solid var(--bw-link, #3366cc);
  padding-bottom: 24px;
  margin-bottom: 32px;
}
.bb-report-badge {
  display: inline-block;
  padding: 4px 14px;
  background: var(--bw-link, #3366cc);
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 16px;
}
.bb-report-title {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.5px;
  line-height: 1.2;
  margin: 0 0 12px;
  color: var(--bw-text, #202122);
}
.bb-report-meta {
  font-size: 13px;
  color: var(--bw-text-muted, #72777d);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.bb-separator { color: var(--bw-border, #ddd); }
.bb-confidence {
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: 600;
  font-size: 11px;
}
.bb-conf-high { background: #dcfce7; color: #166534; }
.bb-conf-medium { background: #fef3c7; color: #92400e; }
.bb-conf-low { background: #fee2e2; color: #991b1b; }
[data-theme="dark"] .bb-conf-high { background: #14532d; color: #86efac; }
[data-theme="dark"] .bb-conf-medium { background: #78350f; color: #fcd34d; }
[data-theme="dark"] .bb-conf-low { background: #7f1d1d; color: #fca5a5; }

.bb-report-body {
  font-size: 15px;
  line-height: 1.8;
  color: var(--bw-text, #202122);
}
.bb-report-body .bb-section-title {
  font-size: 22px;
  font-weight: 700;
  margin: 40px 0 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--bw-border-light, #eaecf0);
  letter-spacing: -0.3px;
}
.bb-report-body .bb-subsection-title {
  font-size: 17px;
  font-weight: 600;
  margin: 28px 0 12px;
  color: var(--bw-link, #3366cc);
}
.bb-report-body .bb-callout {
  border-left: 4px solid var(--bw-link, #3366cc);
  background: var(--bw-sidebar-bg, #f8f9fa);
  padding: 16px 20px;
  margin: 20px 0;
  border-radius: 0 6px 6px 0;
  font-style: normal;
  font-size: 14px;
}
.bb-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 20px 0;
  font-size: 13.5px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--bw-border, #ddd);
}
.bb-table th {
  background: var(--bw-link, #3366cc);
  color: #fff;
  padding: 10px 14px;
  text-align: left;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.bb-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--bw-border-light, #eaecf0);
  background: var(--bw-card-bg, #fff);
}
.bb-table tr:last-child td { border-bottom: none; }
.bb-table tr:hover td {
  background: var(--bw-sidebar-bg, #f8f9fa);
}

/* SWOT 2x2 grid */
.bb-swot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  margin: 24px 0;
  border-radius: 12px;
  overflow: hidden;
}
.bb-swot-cell {
  padding: 20px;
  min-height: 80px;
}
.bb-swot-label {
  font-size: 28px;
  font-weight: 900;
  opacity: 0.2;
  margin-bottom: 4px;
}
.bb-swot-title {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.bb-swot-s { background: #dcfce7; color: #166534; }
.bb-swot-w { background: #fee2e2; color: #991b1b; }
.bb-swot-o { background: #dbeafe; color: #1e40af; }
.bb-swot-t { background: #fef3c7; color: #92400e; }
[data-theme="dark"] .bb-swot-s { background: #14532d; color: #86efac; }
[data-theme="dark"] .bb-swot-w { background: #7f1d1d; color: #fca5a5; }
[data-theme="dark"] .bb-swot-o { background: #1e3a5f; color: #93c5fd; }
[data-theme="dark"] .bb-swot-t { background: #78350f; color: #fcd34d; }

.bb-kpi-hint {
  background: var(--bw-sidebar-bg, #f8f9fa);
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--bw-text-secondary, #555);
  margin-bottom: 24px;
}

/* Related reports */
.bb-related {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--bw-border-light, #eaecf0);
}
.bb-related-title {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--bw-text-muted, #888);
  margin-bottom: 12px;
}
.bb-related-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.bb-related-link {
  display: inline-block;
  padding: 8px 16px;
  background: var(--bw-sidebar-bg, #f8f9fa);
  border: 1px solid var(--bw-border, #ddd);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--bw-link, #3366cc);
  transition: all 0.15s ease;
}
.bb-related-link:hover {
  background: var(--bw-link, #3366cc);
  color: #fff;
  border-color: var(--bw-link, #3366cc);
}

/* Report footer */
.bb-report-footer {
  margin-top: 48px;
  padding-top: 20px;
  border-top: 1px solid var(--bw-border-light, #eaecf0);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.bb-disclaimer {
  font-size: 11px;
  color: var(--bw-text-muted, #999);
  max-width: 500px;
  line-height: 1.5;
}
.bb-back-link {
  font-size: 13px;
  font-weight: 600;
}

/* Report body: enhance lists */
.bb-report-body ul {
  padding-left: 0;
  list-style: none;
}
.bb-report-body ul > li {
  position: relative;
  padding-left: 20px;
  margin-bottom: 8px;
}
.bb-report-body ul > li::before {
  content: '▸';
  position: absolute;
  left: 0;
  color: var(--bw-link, #3366cc);
  font-weight: 700;
}

@media print {
  .bb-report { padding: 0; }
  .bb-report-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bb-swot-grid { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bb-related, .bb-back-link { display: none; }
}

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
  margin-top: 32px;
  padding: 12px 16px;
  border: 1px solid var(--bw-border);
  background: var(--bw-code-bg);
  font-size: 13px;
  border-radius: var(--bw-radius);
}
.bw-cat-tag {
  display: inline-block;
  padding: 4px 12px;
  margin: 2px 4px;
  background: var(--bw-card-bg);
  border: 1px solid var(--bw-border);
  border-radius: 6px;
  font-size: 12.5px;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.bw-cat-tag:hover {
  border-color: var(--bw-accent);
  background: var(--bw-accent-glow);
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
  border: 1px solid var(--bw-border);
  background: var(--bw-accent-glow);
  padding: 20px 24px;
  margin: 22px 0;
  border-radius: var(--bw-radius);
}
.bw-featured h2 {
  font-size: 17px;
  margin: 0 0 8px;
  font-family: 'Inter', 'Hiragino Sans', system-ui, sans-serif;
  font-weight: 700;
  border-bottom: 1px solid var(--bw-border);
  padding-bottom: 6px;
  color: var(--bw-text);
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
  margin: 10px 0 20px;
  border: 1px solid var(--bw-border);
  border-radius: 8px;
  overflow: hidden;
  font-size: 13px;
}
.bw-view-toggle a {
  padding: 8px 20px;
  background: var(--bw-card-bg);
  color: var(--bw-text-secondary);
  border-right: 1px solid var(--bw-border);
  text-decoration: none;
  transition: background 0.2s ease, color 0.2s ease;
  font-weight: 500;
}
.bw-view-toggle a:last-child { border-right: none; }
.bw-view-toggle a:hover { background: var(--bw-code-bg); color: var(--bw-text); }
.bw-view-toggle a.active {
  background: var(--bw-accent);
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
@keyframes bw-topbar-glow {
  0% { background-position: 200% 0; opacity: 0.3; }
  50% { background-position: 0% 0; opacity: 0.6; }
  100% { background-position: 200% 0; opacity: 0.3; }
}
@keyframes bw-holo-shimmer {
  0% { background-position: 0 0, -100% 0; }
  50% { background-position: 0 0, 200% 0; }
  100% { background-position: 0 0, -100% 0; }
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
  background: var(--bw-card-bg);
  border: 1px solid var(--bw-border);
  border-left: 4px solid var(--cat-color, var(--bw-border));
  border-radius: var(--bw-radius);
  padding: 22px 26px 20px;
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
  transform: translateY(-4px);
  border-color: rgba(123, 147, 255, 0.15);
  border-left-color: var(--cat-color, var(--bw-accent));
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.5),
    0 0 30px var(--bw-accent-glow);
}
[data-theme="light"] .bw-article-card:hover {
  border-color: var(--bw-border);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
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
  font-family: 'Inter', 'Hiragino Sans', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 10px;
  line-height: 1.3;
  color: var(--bw-text);
  letter-spacing: -0.3px;
}
.bw-article-card-title a {
  color: var(--bw-text);
  transition: color 0.2s ease;
}
.bw-article-card:hover .bw-article-card-title { color: var(--cat-color, var(--bw-accent)); }
.bw-article-card-excerpt {
  font-size: 14px;
  color: var(--bw-text-secondary);
  line-height: 1.7;
  flex: 1;
  margin: 2px 0 16px;
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
  min-height: 200px;
  background: var(--bw-card-bg);
  border-left-width: 6px;
  padding: 32px 38px 28px;
  overflow: hidden;
}
/* Holographic shimmer overlay — ambient iridescent feel */
.bw-article-card.featured::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(
      0deg,
      transparent 0,
      transparent 2px,
      rgba(255, 255, 255, 0.008) 2px,
      rgba(255, 255, 255, 0.008) 3px
    ),
    linear-gradient(
      105deg,
      transparent 25%,
      rgba(123, 147, 255, 0.06) 38%,
      rgba(167, 139, 250, 0.08) 50%,
      rgba(240, 171, 252, 0.05) 62%,
      transparent 75%
    );
  background-size: 100% 100%, 300% 100%;
  animation: bw-holo-shimmer 8s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
  border-radius: inherit;
}
.bw-article-card.featured:hover::before {
  background-size: 100% 100%, 200% 100%;
  animation-duration: 4s;
}
.bw-article-card.featured > * { position: relative; z-index: 1; }
.bw-article-card.featured .bw-article-card-title {
  font-size: 32px;
  margin-bottom: 12px;
  font-weight: 800;
  letter-spacing: -0.5px;
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


/* === Timeline === */
.bw-timeline { padding: 0 0 24px 0; }
.bw-timeline-month { margin-bottom: 28px; }
.bw-timeline-month h2 {
  font-family: 'Linux Libertine', 'Georgia', serif;
  font-size: 20px;
  font-weight: 400;
  color: #54595d;
  padding: 4px 0 6px 12px;
  border-bottom: 1px solid #a2a9b1;
  margin: 0 0 12px;
}
.bw-timeline-entries {
  position: relative;
  padding-left: 28px;
  margin-left: 10px;
  border-left: 2px solid #c8ccd1;
}
.bw-timeline-entry {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 0;
}
.bw-timeline-dot {
  position: absolute;
  left: -34px;
  top: 12px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.08);
  flex-shrink: 0;
}
.bw-timeline-content {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 12px;
  font-size: 14px;
}
.bw-timeline-content a {
  color: #3366cc;
  text-decoration: none;
  font-weight: 500;
}
.bw-timeline-content a:hover { text-decoration: underline; }
.bw-timeline-meta {
  color: #72777d;
  font-size: 12px;
}
.bw-timeline-date {
  color: #a2a9b1;
  font-size: 11.5px;
  margin-left: auto;
}
@media (max-width: 640px) {
  .bw-timeline-entries { padding-left: 18px; margin-left: 6px; }
  .bw-timeline-dot { left: -24px; width: 10px; height: 10px; }
  .bw-timeline-content { font-size: 13px; }
}

/* === Mini Graph === */
.bw-mini-graph {
  background: #1a1a2e;
  border-radius: 8px;
  margin-top: 24px;
  overflow: hidden;
}
.bw-mini-graph-header {
  padding: 12px 16px;
  font-weight: 600;
  border-bottom: 1px solid #2a2a3e;
  color: #e0e0e8;
  font-size: 14px;
}
.bw-mini-graph svg {
  display: block;
  width: 100%;
  height: 300px;
}
.bw-mini-graph .mini-link {
  stroke: #3a3a5e;
  stroke-width: 1;
  stroke-opacity: 0.6;
}
.bw-mini-graph .mini-node circle {
  cursor: pointer;
  stroke: #2a2a3e;
  stroke-width: 1.5;
}
.bw-mini-graph .mini-node.current circle {
  stroke: #e0e0e8;
  stroke-width: 2.5;
  filter: drop-shadow(0 0 6px rgba(255,255,255,0.3));
}
.bw-mini-graph .mini-node text {
  fill: #c0c0d0;
  font-size: 11px;
  text-anchor: middle;
  pointer-events: none;
}
.bw-mini-graph .mini-node.current text {
  fill: #ffffff;
  font-weight: 600;
}
.bw-mini-graph .mini-tooltip {
  position: absolute;
  padding: 4px 10px;
  background: rgba(0,0,0,0.85);
  color: #fff;
  font-size: 12px;
  border-radius: 4px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.bw-mini-graph .mini-tooltip.visible { opacity: 1; }

/* === Dark mode toggle button === */
.bw-theme-toggle {
  background: none;
  border: 1px solid var(--bw-border);
  border-radius: 4px;
  width: 34px;
  height: 34px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--bw-text-secondary);
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  margin-left: 12px;
  flex-shrink: 0;
}
.bw-theme-toggle:hover {
  background: var(--bw-sidebar-bg);
  color: var(--bw-text);
  border-color: var(--bw-link);
}

/* === Fullscreen graph link === */
.bw-graph-fullscreen-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 11px;
  color: var(--bw-text-secondary);
  text-decoration: none;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.bw-graph-fullscreen-link:hover {
  background: var(--bw-sidebar-bg);
  border-color: var(--bw-border);
  color: var(--bw-link);
  text-decoration: none;
}
.bw-graph-fullscreen-link .bw-fs-icon {
  font-size: 13px;
}

/* === Editor === */
.bw-article-main { position: relative; }
.bw-editor-toolbar { display: flex; gap: 4px; padding: 8px; background: #f8f9fa; border: 1px solid #ddd; border-bottom: none; }
.bw-editor-toolbar button { padding: 4px 8px; font-size: 12px; cursor: pointer; background: #fff; border: 1px solid #ccc; border-radius: 3px; }
.bw-editor-toolbar button:hover { background: #e8e8e8; }
.bw-editor-textarea { width: 100%; min-height: 400px; font-family: monospace; padding: 12px; border: 1px solid #ddd; font-size: 14px; resize: vertical; box-sizing: border-box; }
.bw-edit-btn { position: absolute; top: 8px; right: 8px; padding: 6px 14px; font-size: 13px; cursor: pointer; background: #fff; border: 1px solid #ccc; border-radius: 4px; color: var(--bw-text-secondary); z-index: 10; }
.bw-edit-btn:hover { background: #f0f0f0; border-color: #999; }
.bw-edit-actions { display: flex; gap: 8px; margin-top: 8px; }
.bw-edit-actions button { padding: 6px 16px; font-size: 13px; cursor: pointer; border-radius: 4px; border: 1px solid #ccc; }
.bw-edit-actions .bw-save-btn { background: #3366cc; color: #fff; border-color: #3366cc; }
.bw-edit-actions .bw-save-btn:hover { background: #2952a3; }
.bw-edit-actions .bw-cancel-btn { background: #fff; }
.bw-edit-actions .bw-cancel-btn:hover { background: #f0f0f0; }
.bw-toast { position: fixed; bottom: 60px; right: 20px; background: #22c55e; color: #fff; padding: 10px 20px; border-radius: 6px; font-size: 14px; z-index: 9999; box-shadow: 0 2px 8px rgba(0,0,0,0.2); animation: bw-toast-fade 2s forwards; }
@keyframes bw-toast-fade { 0%,70% { opacity: 1; } 100% { opacity: 0; } }

/* === Comments === */
.bw-comments { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 16px; }
.bw-comments-header { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
.bw-comment { padding: 12px; margin: 8px 0; background: #f8f9fa; border-radius: 4px; position: relative; }
.bw-comment-meta { font-size: 11px; color: #666; margin-bottom: 4px; }
.bw-comment-text { font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
.bw-comment-delete { position: absolute; top: 8px; right: 8px; background: none; border: none; cursor: pointer; color: #999; font-size: 14px; line-height: 1; padding: 2px 6px; border-radius: 3px; }
.bw-comment-delete:hover { background: #e8e8e8; color: #c00; }
.bw-comment-form { margin-top: 16px; }
.bw-comment-form textarea { width: 100%; min-height: 80px; padding: 10px; border: 1px solid var(--bw-border); border-radius: 8px; font-size: 14px; font-family: inherit; resize: vertical; box-sizing: border-box; background: var(--bw-input-bg); color: var(--bw-text); }
.bw-comment-form input[type="text"] { width: 200px; padding: 6px 10px; border: 1px solid var(--bw-border); border-radius: 8px; font-size: 13px; margin-right: 8px; background: var(--bw-input-bg); color: var(--bw-text); }
.bw-comment-form-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.bw-comment-form button[type="submit"] { padding: 8px 20px; background: var(--bw-accent); color: #fff; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; font-weight: 600; transition: background 0.2s ease, box-shadow 0.2s ease; }
.bw-comment-form button[type="submit"]:hover { background: #6b8aff; box-shadow: 0 0 16px var(--bw-accent-glow); }
.bw-comment { background: var(--bw-card-bg); }
.bw-editor-toolbar { background: var(--bw-card-bg); border-color: var(--bw-border); }
.bw-editor-textarea { background: var(--bw-input-bg); color: var(--bw-text); border-color: var(--bw-border); }
.bw-edit-btn { background: var(--bw-card-bg); border-color: var(--bw-border); color: var(--bw-text-secondary); }

/* === Print === */
@media print {
  body { background: #ffffff; }
  .bw-sidebar, .bw-header, .bw-edit-section, .bw-footer,
  .bw-toc-toggle, .bw-search-form, .bw-theme-toggle { display: none !important; }
  .bw-main { border: none !important; }
  .bw-content { padding: 0; max-width: none; }
  .bw-infobox { float: none; width: 100%; margin: 10px 0; page-break-inside: avoid; }
  a { color: #000 !important; text-decoration: none !important; }
  pre, code { background: #f0f0f0 !important; }
  .bw-editor-toolbar, .bw-edit-btn, .bw-edit-actions, .bw-comments { display: none !important; }
}

/* === Lint results === */
.bw-lint-summary { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.bw-lint-stat { padding: 12px 20px; border-radius: var(--bw-radius); text-align: center; min-width: 100px; }
.bw-lint-stat.critical { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); }
.bw-lint-stat.warning { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); }
.bw-lint-stat.info { background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); }
.bw-lint-stat.total { background: var(--bw-card-bg); border: 1px solid var(--bw-border); }
.bw-lint-stat-value { font-size: 28px; font-weight: 800; }
.bw-lint-stat-label { font-size: 12px; color: var(--bw-text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.bw-lint-card { padding: 16px; margin: 8px 0; border-radius: var(--bw-radius); border-left: 4px solid; }
.bw-lint-card.critical { border-color: #ef4444; background: rgba(239, 68, 68, 0.06); }
.bw-lint-card.warning { border-color: #f59e0b; background: rgba(245, 158, 11, 0.06); }
.bw-lint-card.info { border-color: #3b82f6; background: rgba(59, 130, 246, 0.06); }
.bw-lint-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.bw-lint-card-severity { font-size: 18px; }
.bw-lint-card-category { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--bw-text-muted); font-weight: 600; }
.bw-lint-card-desc { margin-bottom: 6px; }
.bw-lint-card-suggestion { font-size: 13px; color: var(--bw-text-secondary); font-style: italic; }
.bw-lint-card-articles { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
.bw-lint-card-articles a {
  font-size: 12px; padding: 2px 8px; border-radius: 3px;
  background: rgba(0,0,0,0.05); border: 1px solid var(--bw-border-light);
}
.bw-lint-run-section { text-align: center; padding: 60px 20px; }
.bw-lint-run-btn {
  display: inline-block; padding: 12px 32px; font-size: 15px; font-weight: 600;
  background: var(--bw-link); color: #fff; border: none; border-radius: 4px;
  cursor: pointer; transition: background 0.15s ease;
}
.bw-lint-run-btn:hover { background: #2255aa; text-decoration: none; }
.bw-lint-run-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.bw-lint-raw { margin-top: 32px; padding: 16px; background: var(--bw-code-bg); border-radius: 4px; border: 1px solid var(--bw-border-light); white-space: pre-wrap; font-size: 13px; line-height: 1.6; font-family: 'JetBrains Mono', 'Consolas', monospace; }
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
  lang?: Lang;
}): string {
  const htmlLang = params.lang === 'en' ? 'en' : 'ja';
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(params.title)} — ${escapeHtml(params.projectName)} Wiki</title>
<script>(function(){try{var t=localStorage.getItem('bw-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})()</script>
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
    <a href="/timeline">Timeline</a>
    <a href="/changes">Changes</a>
    <a href="/chat">Chat</a>
    <a href="/lint">Lint</a>
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
  <button class="bw-theme-toggle" id="bw-theme-toggle" type="button" title="Toggle dark mode" aria-label="Toggle dark mode">
    <span id="bw-theme-icon">☾</span>
  </button>
</header>
<main class="bw-page">
  <div class="bw-page-inner">
    ${params.body}
    <footer class="bw-footer">
      ${params.lastCompile ? `Last compiled: ${escapeHtml(formatJST(params.lastCompile))} · ` : ''}
      Generated by brandwiki-engine · This wiki is compiled by LLM from raw sources. Do not edit manually. · <a href="/_export/pdf">PDF Export</a>
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
<script>
(function(){
  var btn = document.getElementById('bw-theme-toggle');
  var icon = document.getElementById('bw-theme-icon');
  if (!btn || !icon) return;
  function isLight(){ return document.documentElement.getAttribute('data-theme') === 'light'; }
  function updateIcon(){ icon.textContent = isLight() ? '☾' : '☀'; }
  updateIcon();
  btn.addEventListener('click', function(){
    if (isLight()) {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('bw-theme', 'dark'); } catch(e){}
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      try { localStorage.setItem('bw-theme', 'light'); } catch(e){}
    }
    updateIcon();
  });
})();
</script>
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

const PALETTE = [
  '#b84949', '#3366cc', '#2c8a6d', '#7856a8', '#516581',
  '#a16720', '#c1801f', '#805e9c', '#2e86ab', '#a23b72',
  '#c73e1d', '#3b7a57', '#6c5b7b', '#c08552', '#45818e',
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function categoryColor(id: string): string {
  if (CATEGORY_COLORS[id]) return CATEGORY_COLORS[id];
  return PALETTE[hashString(id) % PALETTE.length];
}

export type Lang = 'ja' | 'en';

export const i18n: Record<Lang, Record<string, string>> = {
  ja: {
    category: 'カテゴリ',
    status: '状態',
    confidence: '信頼度',
    updated: '更新',
    words: '語数',
    sources: 'ソース数',
    articleOf: 'の記事',
    readingTime: '分で読める',
    justNow: 'たった今',
    minutesAgo: '分前',
    hoursAgo: '時間前',
    daysAgo: '日前',
    weeksAgo: '週間前',
    monthsAgo: 'ヶ月前',
    yearsAgo: '年前',
    aboutDescription: 'Brand Wiki は、プロジェクトのコーディング、ドキュメント、会議ログ、コード片を AI がコンパイルして構築した構造化知識ベースです。',
    aboutDetail: '各記事は生ソースから抽出された知識パターンであり、Raw な転写ではありません。ソースは frontmatter に記録され、<strong>ingest → compile → wiki</strong> のパイプラインがプロジェクトの進化に合わせて自動更新されます。',
    mainPage: 'Main Page',
    allArticles: 'All Articles',
    recent: 'Recent',
    random: 'Random',
    navigation: 'Navigation',
    categories: 'Categories',
    searchPlaceholder: 'Search wiki...',
  },
  en: {
    category: 'Category',
    status: 'Status',
    confidence: 'Confidence',
    updated: 'Updated',
    words: 'Words',
    sources: 'Sources',
    articleOf: ' article',
    readingTime: ' min read',
    justNow: 'just now',
    minutesAgo: 'm ago',
    hoursAgo: 'h ago',
    daysAgo: 'd ago',
    weeksAgo: 'w ago',
    monthsAgo: 'mo ago',
    yearsAgo: 'y ago',
    aboutDescription: 'Brand Wiki is a structured knowledge base built by AI from project code, documents, meeting logs, and code snippets.',
    aboutDetail: 'Each article is a knowledge pattern extracted from raw sources, not a raw transcription. Sources are recorded in frontmatter, and the <strong>ingest → compile → wiki</strong> pipeline auto-updates as the project evolves.',
    mainPage: 'Main Page',
    allArticles: 'All Articles',
    recent: 'Recent',
    random: 'Random',
    navigation: 'Navigation',
    categories: 'Categories',
    searchPlaceholder: 'Search wiki...',
  },
};

export function t(lang: Lang, key: string): string {
  return i18n[lang]?.[key] ?? i18n['en'][key] ?? key;
}

export function readingTime(wordCount: number, lang: Lang = 'ja'): string {
  const wpm = lang === 'ja' ? 180 : 250;
  const minutes = Math.max(1, Math.round(wordCount / wpm));
  if (lang === 'ja') return `${minutes}分で読める`;
  return `${minutes} min read`;
}

/** @deprecated Use readingTime instead */
export function readingTimeJa(wordCount: number): string {
  return readingTime(wordCount, 'ja');
}

export function relativeTime(iso: string, lang: Lang = 'ja'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return t(lang, 'justNow');
  if (diffMin < 60) return `${diffMin}${t(lang, 'minutesAgo')}`;
  if (diffHr < 24) return `${diffHr}${t(lang, 'hoursAgo')}`;
  if (diffDay < 7) return `${diffDay}${t(lang, 'daysAgo')}`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}${t(lang, 'weeksAgo')}`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}${t(lang, 'monthsAgo')}`;
  return `${Math.floor(diffDay / 365)}${t(lang, 'yearsAgo')}`;
}

/** @deprecated Use relativeTime instead */
export function relativeTimeJa(iso: string): string {
  return relativeTime(iso, 'ja');
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
