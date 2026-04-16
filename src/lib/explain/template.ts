import { escapeHtml } from '../site-template.js';

export function explainPageHtml(projectName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Explore — ${escapeHtml(projectName)}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
<style>
/* === Reset + Base === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #07080c; color: #e6edf3; font-family: -apple-system, 'Segoe UI', sans-serif; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }

/* === Canvas (star field) === */
#bw-particles { position: fixed; inset: 0; z-index: 0; pointer-events: none; }

/* === SVG (world map) === */
#bw-world-svg { position: fixed; inset: 0; z-index: 1; width: 100%; height: 100%; }

/* === Gate === */
.bw-gate { position: fixed; inset: 0; z-index: 100; perspective: 1200px; perspective-origin: 50% 50%; background: #07080c; overflow: hidden; }
.bw-gate-door { position: absolute; top: 0; width: 50%; height: 100%; transform-style: preserve-3d; transition: transform 1.8s cubic-bezier(0.16, 1, 0.3, 1); }
.bw-gate-left { left: 0; transform-origin: left center; }
.bw-gate-right { right: 0; transform-origin: right center; }
.bw-gate-door-face {
  width: 100%; height: 100%;
  background: linear-gradient(180deg, #0d1117 0%, #161b22 40%, #0d1117 100%);
  display: flex; align-items: center; justify-content: center;
  backface-visibility: hidden;
}
.bw-gate-left .bw-gate-door-face { border-right: 3px solid rgba(51,102,204,0.3); box-shadow: inset -30px 0 80px rgba(51,102,204,0.04); }
.bw-gate-right .bw-gate-door-face { border-left: 3px solid rgba(51,102,204,0.3); box-shadow: inset 30px 0 80px rgba(51,102,204,0.04); }
.bw-gate-ornament { font-family: 'Consolas', 'Courier New', monospace; font-size: 140px; color: rgba(51,102,204,0.06); user-select: none; }
.bw-gate.opening .bw-gate-left { transform: rotateY(-105deg); }
.bw-gate.opening .bw-gate-right { transform: rotateY(105deg); }

.bw-gate-title { position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%); text-align: center; z-index: 2; opacity: 0; transition: opacity 0.8s ease 0.2s; }
.bw-gate.pre-open .bw-gate-title { opacity: 1; }
.bw-gate-project-name { font-family: Georgia, 'Times New Roman', serif; font-size: clamp(32px, 6vw, 72px); color: #e6edf3; letter-spacing: 3px; text-shadow: 0 0 60px rgba(51,102,204,0.25); }
.bw-gate-subtitle { font-family: 'Consolas', monospace; font-size: 11px; letter-spacing: 8px; color: rgba(51,102,204,0.6); margin-top: 14px; text-transform: uppercase; }

.bw-gate-stats { position: absolute; bottom: 14%; left: 50%; transform: translateX(-50%); display: flex; gap: 48px; z-index: 2; }
.bw-gate-stat { text-align: center; opacity: 0; transform: translateY(30px); transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1); }
.bw-gate.pre-open .bw-gate-stat:nth-child(1) { opacity: 1; transform: translateY(0); transition-delay: 0.5s; }
.bw-gate.pre-open .bw-gate-stat:nth-child(2) { opacity: 1; transform: translateY(0); transition-delay: 0.7s; }
.bw-gate.pre-open .bw-gate-stat:nth-child(3) { opacity: 1; transform: translateY(0); transition-delay: 0.9s; }
.bw-gate.pre-open .bw-gate-stat:nth-child(4) { opacity: 1; transform: translateY(0); transition-delay: 1.1s; }
.bw-gate-stat-value { font-family: Georgia, serif; font-size: clamp(24px, 4vw, 42px); color: #e6edf3; }
.bw-gate-stat-label { font-family: 'Consolas', monospace; font-size: 10px; letter-spacing: 3px; color: rgba(139,148,158,0.7); margin-top: 6px; text-transform: uppercase; }
.bw-gate.opened { pointer-events: none; opacity: 0; transition: opacity 0.8s ease 0.2s; }

/* === Breadcrumb === */
.bw-explain-breadcrumb {
  position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
  z-index: 30; display: none; align-items: center; gap: 8px;
  background: rgba(13,17,23,0.85); backdrop-filter: blur(8px);
  padding: 8px 18px; border-radius: 8px; border: 1px solid rgba(48,54,61,0.5);
  font-family: 'Consolas', monospace; font-size: 13px;
}
.bw-explain-breadcrumb.visible { display: flex; }
.bw-explain-crumb { color: rgba(139,148,158,0.8); cursor: pointer; transition: color 0.15s; }
.bw-explain-crumb:hover { color: #e6edf3; }
.bw-explain-crumb.active { color: #58a6ff; cursor: default; }
.bw-explain-crumb-sep { color: rgba(139,148,158,0.4); }

/* === Zone tooltip === */
.bw-zone-tooltip {
  position: fixed; pointer-events: none; z-index: 40;
  background: rgba(13,17,23,0.92); backdrop-filter: blur(8px);
  border: 1px solid rgba(48,54,61,0.6); border-radius: 8px;
  padding: 12px 16px; max-width: 280px;
  opacity: 0; transition: opacity 0.15s ease; font-size: 13px;
}
.bw-zone-tooltip.visible { opacity: 1; }
.bw-zone-tooltip-name { font-weight: 600; font-size: 15px; margin-bottom: 6px; }
.bw-zone-tooltip-meta { color: rgba(139,148,158,0.8); line-height: 1.6; }
.bw-zone-tooltip-health { margin-top: 6px; font-weight: 500; }
.bw-zone-tooltip-health.green { color: #3fb950; }
.bw-zone-tooltip-health.orange { color: #d29922; }
.bw-zone-tooltip-health.red { color: #f85149; }

/* === File detail panel === */
.bw-file-panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: 420px; z-index: 50;
  background: rgba(13,17,23,0.95); backdrop-filter: blur(12px);
  border-left: 1px solid rgba(48,54,61,0.5);
  transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
  display: flex; flex-direction: column; overflow: hidden;
}
.bw-file-panel.open { transform: translateX(0); }
.bw-file-panel-header {
  padding: 18px 20px; border-bottom: 1px solid rgba(48,54,61,0.4);
  display: flex; justify-content: space-between; align-items: flex-start; flex-shrink: 0;
}
.bw-file-panel-title { font-weight: 600; font-size: 15px; word-break: break-all; }
.bw-file-panel-path { font-family: 'Consolas', monospace; font-size: 11px; color: rgba(139,148,158,0.7); margin-top: 4px; }
.bw-file-panel-close {
  background: none; border: 1px solid rgba(48,54,61,0.5); border-radius: 4px;
  width: 28px; height: 28px; cursor: pointer; color: rgba(139,148,158,0.8);
  display: flex; align-items: center; justify-content: center; font-size: 16px;
  flex-shrink: 0; transition: background 0.15s;
}
.bw-file-panel-close:hover { background: rgba(48,54,61,0.5); }
.bw-file-panel-body { flex: 1; overflow-y: auto; padding: 20px; font-size: 13px; line-height: 1.7; }

.bw-file-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.bw-file-stat-box { background: rgba(22,27,34,0.8); border-radius: 6px; padding: 12px; }
.bw-file-stat-val { font-size: 20px; font-weight: 600; }
.bw-file-stat-lbl { font-size: 10px; letter-spacing: 2px; color: rgba(139,148,158,0.6); text-transform: uppercase; margin-top: 2px; }
.bw-churn-bar { height: 4px; border-radius: 2px; background: rgba(48,54,61,0.5); margin-top: 6px; overflow: hidden; }
.bw-churn-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s ease; }

.bw-file-section { margin-bottom: 20px; }
.bw-file-section-title { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(139,148,158,0.6); margin-bottom: 8px; font-weight: 600; }
.bw-file-error-item { padding: 6px 0; border-bottom: 1px solid rgba(48,54,61,0.3); font-family: 'Consolas', monospace; font-size: 12px; }
.bw-file-error-item .err { color: #f85149; }
.bw-file-error-item .warn { color: #d29922; }
.bw-file-dep-item { padding: 4px 0; font-family: 'Consolas', monospace; font-size: 12px; color: #58a6ff; cursor: pointer; }
.bw-file-dep-item:hover { text-decoration: underline; }

.bw-analyze-btn {
  width: 100%; padding: 10px; border: 1px solid rgba(51,102,204,0.4); border-radius: 6px;
  background: rgba(51,102,204,0.1); color: #58a6ff; cursor: pointer;
  font-size: 13px; font-weight: 500; transition: background 0.15s;
}
.bw-analyze-btn:hover { background: rgba(51,102,204,0.2); }
.bw-analyze-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.bw-analyze-result { margin-top: 16px; line-height: 1.8; }
.bw-analyze-result h1, .bw-analyze-result h2, .bw-analyze-result h3 { margin: 14px 0 6px; }
.bw-analyze-result h1 { font-size: 16px; } .bw-analyze-result h2 { font-size: 14px; } .bw-analyze-result h3 { font-size: 13px; }
.bw-analyze-result code { background: rgba(48,54,61,0.5); padding: 1px 5px; border-radius: 3px; font-size: 12px; }
.bw-analyze-result strong { color: #e6edf3; }
.bw-analyze-result ul, .bw-analyze-result ol { padding-left: 18px; }

.bw-analyze-loading { display: flex; align-items: center; gap: 8px; color: rgba(139,148,158,0.7); margin-top: 12px; }
.bw-analyze-dots span { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: rgba(139,148,158,0.5); animation: bw-adot 1.2s ease-in-out infinite; }
.bw-analyze-dots span:nth-child(2) { animation-delay: 0.2s; }
.bw-analyze-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bw-adot { 0%,80%,100%{opacity:.3;transform:scale(.8)} 40%{opacity:1;transform:scale(1.2)} }

.bw-analyze-cursor::after { content:''; display:inline-block; width:2px; height:1em; background:#58a6ff; margin-left:1px; vertical-align:text-bottom; animation:bw-acblink .8s step-end infinite; }
@keyframes bw-acblink { 0%,100%{opacity:1} 50%{opacity:0} }

/* === Zone patterns (SVG defs) === */
.zone-rect { cursor: pointer; transition: filter 0.3s ease, opacity 0.3s ease; }
.zone-rect:hover { filter: brightness(1.2); }
.zone-label { font-family: 'Consolas', monospace; fill: rgba(230,237,243,0.9); pointer-events: none; text-anchor: middle; dominant-baseline: central; }
.zone-count { font-family: 'Consolas', monospace; fill: rgba(139,148,158,0.6); pointer-events: none; text-anchor: middle; dominant-baseline: central; font-size: 11px; }
.zone-group { cursor: pointer; }
.zone-group.dimmed { opacity: 0.08; pointer-events: none; transition: opacity 0.4s ease; }
.zone-aura { pointer-events: none; }

/* dep lines */
.dep-line { fill: none; stroke-width: 1.5; opacity: 0.25; stroke-dasharray: 6 4; animation: bw-depflow 2s linear infinite; }
@keyframes bw-depflow { to { stroke-dashoffset: -10; } }

/* file rects inside zone */
.file-rect { cursor: pointer; transition: filter 0.2s ease; rx: 3; ry: 3; }
.file-rect:hover { filter: brightness(1.3); }
.file-label { font-family: 'Consolas', monospace; fill: rgba(230,237,243,0.85); pointer-events: none; text-anchor: middle; dominant-baseline: central; }
.file-rect.has-errors { stroke: #f85149; stroke-width: 2; stroke-dasharray: 4 3; animation: bw-errpulse 1.5s ease-in-out infinite; }
@keyframes bw-errpulse { 0%,100%{stroke-opacity:1} 50%{stroke-opacity:0.4} }

/* breathing */
@keyframes bw-breathe { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }

/* Back to wiki link */
.bw-back-link {
  position: fixed; bottom: 16px; left: 16px; z-index: 30;
  font-family: 'Consolas', monospace; font-size: 12px;
  color: rgba(139,148,158,0.5); text-decoration: none;
  transition: color 0.15s;
}
.bw-back-link:hover { color: #58a6ff; }
</style>
</head>
<body>

<canvas id="bw-particles"></canvas>
<svg id="bw-world-svg"></svg>

<div class="bw-gate" id="bw-gate">
  <div class="bw-gate-door bw-gate-left"><div class="bw-gate-door-face"><div class="bw-gate-ornament">{</div></div></div>
  <div class="bw-gate-door bw-gate-right"><div class="bw-gate-door-face"><div class="bw-gate-ornament">}</div></div></div>
  <div class="bw-gate-title">
    <div class="bw-gate-project-name">${escapeHtml(projectName)}</div>
    <div class="bw-gate-subtitle">codebase explorer</div>
  </div>
  <div class="bw-gate-stats" id="bw-gate-stats"></div>
</div>

<div class="bw-explain-breadcrumb" id="bw-breadcrumb">
  <span class="bw-explain-crumb" id="bw-crumb-world">World Map</span>
  <span class="bw-explain-crumb-sep">&gt;</span>
  <span class="bw-explain-crumb active" id="bw-crumb-zone"></span>
</div>

<div class="bw-zone-tooltip" id="bw-zone-tooltip"></div>

<div class="bw-file-panel" id="bw-file-panel">
  <div class="bw-file-panel-header">
    <div><div class="bw-file-panel-title" id="bw-fp-title"></div><div class="bw-file-panel-path" id="bw-fp-path"></div></div>
    <button class="bw-file-panel-close" id="bw-fp-close">&times;</button>
  </div>
  <div class="bw-file-panel-body" id="bw-fp-body"></div>
</div>

<a class="bw-back-link" href="/">&larr; Back to Wiki</a>

<script>
(function(){
  // === Theme colors per zone type ===
  var ZONE_THEMES = {
    source:  { bg: '#0d2240', border: '#1a6bcc', glow: 'rgba(26,107,204,0.12)', text: '#58a6ff' },
    test:    { bg: '#0d2818', border: '#22863a', glow: 'rgba(34,134,58,0.12)', text: '#3fb950' },
    config:  { bg: '#2a1f00', border: '#b08800', glow: 'rgba(176,136,0,0.12)', text: '#d29922' },
    static:  { bg: '#2a1200', border: '#c94922', glow: 'rgba(201,73,34,0.12)', text: '#f0883e' },
    docs:    { bg: '#1c1708', border: '#6f5e36', glow: 'rgba(111,94,54,0.12)', text: '#c9a655' },
    generic: { bg: '#1a1030', border: '#6f42c1', glow: 'rgba(111,66,193,0.12)', text: '#a371f7' }
  };
  var GENERIC_COLORS = ['#6f42c1','#d73a49','#005cc5','#e36209','#5a32a3','#0366d6','#22863a'];
  var genericIdx = 0;

  function themeFor(z) {
    var t = ZONE_THEMES[z.zoneType] || ZONE_THEMES.generic;
    if (z.zoneType === 'generic') {
      var c = GENERIC_COLORS[genericIdx++ % GENERIC_COLORS.length];
      return { bg: t.bg, border: c, glow: c.replace(')', ',0.12)').replace('rgb','rgba'), text: c };
    }
    return t;
  }

  // === State ===
  var state = { phase: 'gate', data: null, currentZone: null, zoneThemes: {} };

  // === Star field ===
  var canvas = document.getElementById('bw-particles');
  var ctx = canvas.getContext('2d');
  var stars = [];
  function initStars() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = [];
    for (var i = 0; i < 200; i++) {
      stars.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, r: 0.5+Math.random()*1.5, a: 0.15+Math.random()*0.6, dy: 0.08+Math.random()*0.2 });
    }
  }
  function drawStars() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for (var i=0;i<stars.length;i++) {
      var s=stars[i];
      ctx.beginPath();
      ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle='rgba(180,200,255,'+s.a+')';
      ctx.fill();
      s.y-=s.dy;
      if(s.y<-2){s.y=canvas.height+2;s.x=Math.random()*canvas.width;}
    }
    requestAnimationFrame(drawStars);
  }
  initStars();
  drawStars();
  window.addEventListener('resize',function(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;});

  // === Format helpers ===
  function fmtBytes(b){if(b<1024)return b+'B';if(b<1048576)return(b/1024).toFixed(1)+'KB';return(b/1048576).toFixed(1)+'MB';}
  function fmtNum(n){return n.toLocaleString();}
  function escH(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

  // === Fetch project data + gate sequence ===
  var gate = document.getElementById('bw-gate');
  var gateStats = document.getElementById('bw-gate-stats');

  setTimeout(function(){ gate.classList.add('pre-open'); }, 300);

  fetch('/api/explain/project').then(function(r){return r.json();}).then(function(data){
    state.data = data;

    // Populate gate stats
    gateStats.innerHTML =
      '<div class="bw-gate-stat"><div class="bw-gate-stat-value">'+fmtNum(data.stats.totalFiles)+'</div><div class="bw-gate-stat-label">Files</div></div>'+
      '<div class="bw-gate-stat"><div class="bw-gate-stat-value">'+fmtNum(data.stats.totalDirs)+'</div><div class="bw-gate-stat-label">Directories</div></div>'+
      '<div class="bw-gate-stat"><div class="bw-gate-stat-value">'+fmtBytes(data.stats.totalSizeBytes)+'</div><div class="bw-gate-stat-label">Total Size</div></div>'+
      '<div class="bw-gate-stat"><div class="bw-gate-stat-value">'+data.stats.healthScore+'%</div><div class="bw-gate-stat-label">Health</div></div>';

    // Wait for stats to appear, then open
    setTimeout(function(){
      gate.classList.add('opening');
      setTimeout(function(){
        gate.classList.add('opened');
        setTimeout(function(){
          gate.remove();
          state.phase = 'world';
          renderWorldMap(data);
        }, 800);
      }, 1800);
    }, 1200);
  }).catch(function(err){
    gateStats.innerHTML = '<div class="bw-gate-stat"><div class="bw-gate-stat-value" style="color:#f85149">Error</div><div class="bw-gate-stat-label">'+escH(err.message)+'</div></div>';
  });

  // === World Map ===
  var svg = d3.select('#bw-world-svg');
  var tooltip = document.getElementById('bw-zone-tooltip');
  var breadcrumb = document.getElementById('bw-breadcrumb');
  var crumbZone = document.getElementById('bw-crumb-zone');
  var crumbWorld = document.getElementById('bw-crumb-world');

  function renderWorldMap(data) {
    var w = window.innerWidth, h = window.innerHeight;
    svg.attr('viewBox', '0 0 '+w+' '+h);
    svg.selectAll('*').remove();

    var defs = svg.append('defs');
    // Glow filter
    var filter = defs.append('filter').attr('id','glow');
    filter.append('feGaussianBlur').attr('stdDeviation','12').attr('result','blur');
    var merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in','blur');
    merge.append('feMergeNode').attr('in','SourceGraphic');

    // Build hierarchy for d3.pack
    var root = d3.hierarchy({children: data.zones.map(function(z){return {data:z, value:Math.max(z.totalSizeBytes,1000)};})}).sum(function(d){return d.value||0;});
    var pack = d3.pack().size([w*0.85, h*0.85]).padding(w*0.04);
    pack(root);

    // Center offset
    var ox = w*0.075, oy = h*0.075;

    // Assign themes
    genericIdx = 0;
    data.zones.forEach(function(z){ state.zoneThemes[z.name] = themeFor(z); });

    // Draw dependency lines first
    var depGroup = svg.append('g').attr('class','dep-lines');
    var zonePositions = {};
    root.children.forEach(function(c){
      zonePositions[c.data.data.name] = {x:c.x+ox, y:c.y+oy};
    });
    data.zoneDependencies.forEach(function(dep){
      var s=zonePositions[dep.source], t=zonePositions[dep.target];
      if(!s||!t)return;
      var mx=(s.x+t.x)/2, my=(s.y+t.y)/2-30;
      var theme=state.zoneThemes[dep.source]||ZONE_THEMES.generic;
      depGroup.append('path')
        .attr('class','dep-line')
        .attr('d','M'+s.x+','+s.y+' Q'+mx+','+my+' '+t.x+','+t.y)
        .attr('stroke',theme.border)
        .style('stroke-width', Math.min(3, 0.5+dep.weight*0.3));
    });

    // Draw zones
    var zoneGroup = svg.append('g').attr('class','zones');
    root.children.forEach(function(c, i){
      var z = c.data.data;
      var theme = state.zoneThemes[z.name];
      var cx=c.x+ox, cy=c.y+oy, r=c.r;
      var rw=r*1.6, rh=r*1.4;

      var g = zoneGroup.append('g').attr('class','zone-group').attr('data-zone',z.name)
        .style('animation','bw-breathe '+(3.5+i*0.3)+'s ease-in-out infinite')
        .style('animation-delay',(-i*0.7)+'s');

      // Health aura
      var auraColor = z.errorCount===0 ? 'rgba(63,185,80,0.08)' : z.errorCount<5 ? 'rgba(210,153,34,0.1)' : 'rgba(248,81,73,0.12)';
      g.append('ellipse').attr('class','zone-aura').attr('cx',cx).attr('cy',cy).attr('rx',rw*0.7).attr('ry',rh*0.7).attr('fill',auraColor).attr('filter','url(#glow)');

      // Main rect
      g.append('rect').attr('class','zone-rect').attr('x',cx-rw/2).attr('y',cy-rh/2).attr('width',rw).attr('height',rh)
        .attr('rx',12).attr('ry',12)
        .attr('fill',theme.bg).attr('stroke',theme.border).attr('stroke-width',1.5);

      // Label
      var fontSize = Math.max(11, Math.min(18, r*0.3));
      g.append('text').attr('class','zone-label').attr('x',cx).attr('y',cy-8).attr('font-size',fontSize+'px').text(z.name);
      g.append('text').attr('class','zone-count').attr('x',cx).attr('y',cy+fontSize*0.8)
        .text(z.fileCount+' files · '+fmtBytes(z.totalSizeBytes));

      // Error badge
      if (z.errorCount > 0) {
        g.append('circle').attr('cx',cx+rw/2-12).attr('cy',cy-rh/2+12).attr('r',10).attr('fill','#f85149');
        g.append('text').attr('x',cx+rw/2-12).attr('y',cy-rh/2+12).attr('text-anchor','middle').attr('dominant-baseline','central')
          .attr('font-size','10px').attr('fill','#fff').attr('font-weight','700').text(z.errorCount);
      }

      // Tooltip
      g.on('mouseenter', function(event){
        var healthClass = z.errorCount===0?'green':z.errorCount<5?'orange':'red';
        var healthText = z.errorCount===0?'Clean':''+z.errorCount+' error'+(z.errorCount>1?'s':'');
        tooltip.innerHTML =
          '<div class="bw-zone-tooltip-name" style="color:'+theme.text+'">'+escH(z.name)+'</div>'+
          '<div class="bw-zone-tooltip-meta">'+z.fileCount+' files &middot; '+fmtBytes(z.totalSizeBytes)+'</div>'+
          '<div class="bw-zone-tooltip-health '+healthClass+'">'+healthText+'</div>';
        tooltip.classList.add('visible');
      });
      g.on('mousemove', function(event){
        var x=event.clientX+14, y=event.clientY+14;
        if(x+280>window.innerWidth) x=event.clientX-290;
        if(y+100>window.innerHeight) y=event.clientY-110;
        tooltip.style.left=x+'px'; tooltip.style.top=y+'px';
      });
      g.on('mouseleave', function(){ tooltip.classList.remove('visible'); });

      // Click -> drill into zone
      g.on('click', function(){ drillIntoZone(z, {cx:cx,cy:cy,rw:rw,rh:rh}); });
    });
  }

  // === Drill into zone ===
  function drillIntoZone(zone, pos) {
    state.phase = 'zone';
    state.currentZone = zone;
    tooltip.classList.remove('visible');

    // Show breadcrumb
    crumbZone.textContent = zone.name + '/';
    breadcrumb.classList.add('visible');

    // Dim other zones
    svg.selectAll('.zone-group').classed('dimmed', function(){
      return this.getAttribute('data-zone') !== zone.name;
    });
    svg.selectAll('.dep-line').style('opacity','0');

    // Zoom SVG viewBox to this zone
    var w=window.innerWidth, h=window.innerHeight;
    var pad=60;
    var targetVB = (pos.cx-pos.rw/2-pad)+' '+(pos.cy-pos.rh/2-pad)+' '+(pos.rw+pad*2)+' '+(pos.rh+pad*2);
    svg.transition().duration(800).ease(d3.easeCubicInOut).attr('viewBox', targetVB);

    // After zoom, render files inside
    setTimeout(function(){ renderZoneFiles(zone, pos); }, 850);
  }

  function renderZoneFiles(zone, pos) {
    var theme = state.zoneThemes[zone.name] || ZONE_THEMES.generic;
    var data = state.data;
    var churnMap = {};
    data.churn.forEach(function(c){ churnMap[c.path]=c.commitCount; });
    var maxChurn = zone.maxChurn || 1;
    var errorPaths = new Set(data.errors.map(function(e){return e.path;}));

    // Build treemap inside the zone rect
    var x0=pos.cx-pos.rw/2+8, y0=pos.cy-pos.rh/2+8;
    var tw=pos.rw-16, th=pos.rh-16;

    var root = d3.hierarchy({children: zone.files.map(function(f){return {data:f, value:Math.max(f.sizeBytes,100)};})}).sum(function(d){return d.value||0;});
    d3.treemap().size([tw,th]).padding(3).round(true)(root);

    var fileGroup = svg.append('g').attr('class','file-nodes');

    root.children.forEach(function(c){
      var f = c.data.data;
      var churn = churnMap[f.path]||0;
      var churnPct = churn/maxChurn;
      var hasErr = errorPaths.has(f.path);

      // Blend zone color with orange based on churn
      var r=parseInt(theme.border.slice(1,3),16), gr=parseInt(theme.border.slice(3,5),16), b=parseInt(theme.border.slice(5,7),16);
      var fr=Math.round(r+(240-r)*churnPct*0.5), fg2=Math.round(gr+(160-gr)*churnPct*0.3), fb=Math.round(b*(1-churnPct*0.5));
      var fillColor = 'rgb('+fr+','+fg2+','+fb+')';

      var rx=x0+c.x0, ry=y0+c.y0, rw2=c.x1-c.x0, rh2=c.y1-c.y0;

      var g = fileGroup.append('g');
      g.append('rect').attr('class','file-rect'+(hasErr?' has-errors':'')).attr('x',rx).attr('y',ry).attr('width',rw2).attr('height',rh2)
        .attr('fill',fillColor).attr('opacity',0.3+churnPct*0.5);

      // Label (only if big enough)
      if(rw2>40 && rh2>18){
        var label = f.name.length>12 ? f.name.slice(0,11)+'...' : f.name;
        var fs = Math.max(8, Math.min(12, rw2/8));
        g.append('text').attr('class','file-label').attr('x',rx+rw2/2).attr('y',ry+rh2/2).attr('font-size',fs+'px').text(label);
      }

      // Click -> show file detail
      g.style('cursor','pointer').on('click', function(event){
        event.stopPropagation();
        showFileDetail(f.path);
      });

      // Tooltip
      g.on('mouseenter', function(event){
        tooltip.innerHTML =
          '<div class="bw-zone-tooltip-name">'+escH(f.name)+'</div>'+
          '<div class="bw-zone-tooltip-meta">'+fmtBytes(f.sizeBytes)+(churn?' &middot; '+churn+' commits':'')+'</div>'+
          (hasErr?'<div class="bw-zone-tooltip-health red">Has errors</div>':'');
        tooltip.classList.add('visible');
      });
      g.on('mousemove', function(event){
        var x=event.clientX+14,y=event.clientY+14;
        if(x+280>window.innerWidth)x=event.clientX-290;
        if(y+100>window.innerHeight)y=event.clientY-110;
        tooltip.style.left=x+'px';tooltip.style.top=y+'px';
      });
      g.on('mouseleave', function(){ tooltip.classList.remove('visible'); });
    });
  }

  // === Back to world ===
  crumbWorld.addEventListener('click', function(){
    if(state.phase!=='zone') return;
    state.phase='world';
    state.currentZone=null;
    breadcrumb.classList.remove('visible');
    closeFilePanel();
    tooltip.classList.remove('visible');

    // Remove file nodes
    svg.selectAll('.file-nodes').remove();

    // Undim zones
    svg.selectAll('.zone-group').classed('dimmed',false);
    svg.selectAll('.dep-line').style('opacity',null);

    // Zoom back out
    var w=window.innerWidth, h=window.innerHeight;
    svg.transition().duration(600).ease(d3.easeCubicInOut).attr('viewBox','0 0 '+w+' '+h);
  });

  // === File detail panel ===
  var panel = document.getElementById('bw-file-panel');
  var fpTitle = document.getElementById('bw-fp-title');
  var fpPath = document.getElementById('bw-fp-path');
  var fpBody = document.getElementById('bw-fp-body');
  var fpClose = document.getElementById('bw-fp-close');

  fpClose.addEventListener('click', closeFilePanel);
  function closeFilePanel(){ panel.classList.remove('open'); }

  function showFileDetail(filePath) {
    var parts = filePath.split('/');
    fpTitle.textContent = parts[parts.length-1];
    fpPath.textContent = filePath;
    fpBody.innerHTML = '<div class="bw-analyze-loading"><span>Loading</span><span class="bw-analyze-dots"><span></span><span></span><span></span></span></div>';
    panel.classList.add('open');

    fetch('/api/explain/file?path='+encodeURIComponent(filePath)).then(function(r){return r.json();}).then(function(detail){
      var maxChurn = state.data.churn.length>0 ? state.data.churn[0].commitCount : 1;
      var churnPct = Math.min(100, Math.round((detail.churnScore/maxChurn)*100));
      var churnColor = churnPct<30?'#3fb950':churnPct<70?'#d29922':'#f85149';

      var html = '<div class="bw-file-stat-grid">'+
        '<div class="bw-file-stat-box"><div class="bw-file-stat-val">'+fmtBytes(detail.sizeBytes)+'</div><div class="bw-file-stat-lbl">Size</div></div>'+
        '<div class="bw-file-stat-box"><div class="bw-file-stat-val">'+fmtNum(detail.lineCount)+'</div><div class="bw-file-stat-lbl">Lines</div></div>'+
        '<div class="bw-file-stat-box"><div class="bw-file-stat-val">'+detail.churnScore+'</div><div class="bw-file-stat-lbl">Git Churn</div>'+
          '<div class="bw-churn-bar"><div class="bw-churn-bar-fill" style="width:'+churnPct+'%;background:'+churnColor+'"></div></div></div>'+
        '<div class="bw-file-stat-box"><div class="bw-file-stat-val">'+detail.extension+'</div><div class="bw-file-stat-lbl">Type</div></div>'+
      '</div>';

      // Errors
      if(detail.errors.length>0){
        html+='<div class="bw-file-section"><div class="bw-file-section-title">Errors & Warnings</div>';
        detail.errors.forEach(function(e){
          var cls=e.severity==='error'?'err':'warn';
          html+='<div class="bw-file-error-item"><span class="'+cls+'">'+escH(e.severity)+'</span> L'+e.line+': '+escH(e.message)+' <span style="opacity:0.5">('+e.code+')</span></div>';
        });
        html+='</div>';
      }

      // Imports
      if(detail.imports.length>0){
        html+='<div class="bw-file-section"><div class="bw-file-section-title">Imports ('+detail.imports.length+')</div>';
        detail.imports.forEach(function(p){html+='<div class="bw-file-dep-item">'+escH(p)+'</div>';});
        html+='</div>';
      }
      if(detail.importedBy.length>0){
        html+='<div class="bw-file-section"><div class="bw-file-section-title">Imported By ('+detail.importedBy.length+')</div>';
        detail.importedBy.forEach(function(p){html+='<div class="bw-file-dep-item">'+escH(p)+'</div>';});
        html+='</div>';
      }

      // AI Analyze button
      html+='<div class="bw-file-section"><button class="bw-analyze-btn" id="bw-analyze-trigger">Analyze with AI</button><div class="bw-analyze-result" id="bw-analyze-result"></div></div>';

      fpBody.innerHTML = html;

      // Wire up analyze button
      var btn = document.getElementById('bw-analyze-trigger');
      var result = document.getElementById('bw-analyze-result');
      btn.addEventListener('click', function(){
        btn.disabled = true;
        btn.textContent = 'Analyzing...';
        result.innerHTML = '<div class="bw-analyze-loading"><span>Thinking</span><span class="bw-analyze-dots"><span></span><span></span><span></span></span></div>';

        fetch('/api/explain/analyze', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({path:filePath})
        }).then(function(response){
          var reader=response.body.getReader();
          var decoder=new TextDecoder();
          var fullText='';
          result.innerHTML='<div class="bw-analyze-cursor" id="bw-analyze-content"></div>';
          var contentEl=document.getElementById('bw-analyze-content');

          function read(){
            reader.read().then(function(r2){
              if(r2.done){contentEl.classList.remove('bw-analyze-cursor');btn.textContent='Re-analyze';btn.disabled=false;return;}
              var chunk=decoder.decode(r2.value,{stream:true});
              var lines=chunk.split('\\n');
              for(var i=0;i<lines.length;i++){
                var line=lines[i].trim();
                if(line.startsWith('event: done')){contentEl.classList.remove('bw-analyze-cursor');btn.textContent='Re-analyze';btn.disabled=false;return;}
                if(line.startsWith('data: ')){
                  try{var d=JSON.parse(line.slice(6));if(d.text){fullText+=d.text;contentEl.innerHTML=simpleMarkdown(fullText);fpBody.scrollTop=fpBody.scrollHeight;}}catch(e){}
                }
              }
              read();
            });
          }
          read();
        });
      });
    });
  }

  function simpleMarkdown(text){
    return text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/^### (.+)$/gm,'<h3>$1</h3>')
      .replace(/^## (.+)$/gm,'<h2>$1</h2>')
      .replace(/^# (.+)$/gm,'<h1>$1</h1>')
      .replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>')
      .replace(/\\*(.+?)\\*/g,'<em>$1</em>')
      .replace(/\`([^\`]+)\`/g,'<code>$1</code>')
      .replace(/^- (.+)$/gm,'<li>$1</li>')
      .replace(/\\n\\n/g,'</p><p>')
      .replace(/\\n/g,'<br>');
  }

  // === Keyboard ===
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape'){
      if(panel.classList.contains('open')){closeFilePanel();return;}
      if(state.phase==='zone'){crumbWorld.click();return;}
    }
  });

  // === Resize ===
  window.addEventListener('resize', function(){
    if(state.phase==='world' && state.data){
      svg.selectAll('*').remove();
      renderWorldMap(state.data);
    }
  });
})();
</script>
</body>
</html>`;
}
