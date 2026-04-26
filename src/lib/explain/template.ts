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
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; color: #e6edf3; font-family: 'Segoe UI', -apple-system, sans-serif; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }

#bw-space { position: fixed; inset: 0; z-index: 0; }
#bw-fx { position: fixed; inset: 0; z-index: 1; pointer-events: none; }
#bw-world-svg { position: fixed; inset: 0; z-index: 2; width: 100%; height: 100%; }

/* Gate */
.bw-gate {
  position: fixed; inset: 0; z-index: 100;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  overflow: hidden; transition: opacity 1.2s ease 0.3s;
}
.bw-gate-rays {
  position: absolute; top: 50%; left: 50%; width: 300vmax; height: 300vmax;
  transform: translate(-50%, -50%);
  background: conic-gradient(from 0deg, transparent, rgba(88,166,255,0.03) 10%, transparent 20%, rgba(163,113,247,0.02) 30%, transparent 40%);
  animation: bw-spin 60s linear infinite; opacity: 0; transition: opacity 2s ease;
}
.bw-gate.pre-open .bw-gate-rays { opacity: 1; }
@keyframes bw-spin { to { transform: translate(-50%,-50%) rotate(360deg); } }
.bw-gate-content { position: relative; z-index: 2; text-align: center; }
.bw-gate-project-name {
  font-family: Georgia, 'Times New Roman', serif; font-size: clamp(36px, 7vw, 80px);
  color: #e6edf3; letter-spacing: 6px;
  text-shadow: 0 0 80px rgba(88,166,255,0.3), 0 0 160px rgba(88,166,255,0.1);
  opacity: 0; transform: scale(0.9);
  transition: opacity 1s ease 0.3s, transform 1s cubic-bezier(0.16,1,0.3,1) 0.3s;
}
.bw-gate.pre-open .bw-gate-project-name { opacity: 1; transform: scale(1); }
.bw-gate-subtitle {
  font-family: 'Consolas', monospace; font-size: 11px; letter-spacing: 10px;
  color: rgba(163,113,247,0.6); margin-top: 16px; text-transform: uppercase;
  opacity: 0; transition: opacity 0.8s ease 0.8s;
}
.bw-gate.pre-open .bw-gate-subtitle { opacity: 1; }
.bw-gate-divider {
  width: 120px; height: 1px; margin: 28px auto;
  background: linear-gradient(90deg, transparent, rgba(88,166,255,0.4), transparent);
  opacity: 0; transition: opacity 0.6s ease 1s;
}
.bw-gate.pre-open .bw-gate-divider { opacity: 1; }
.bw-gate-stats { display: flex; gap: 48px; margin-top: 8px; }
.bw-gate-stat { text-align: center; opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1); }
.bw-gate.pre-open .bw-gate-stat:nth-child(1) { opacity: 1; transform: translateY(0); transition-delay: 1.2s; }
.bw-gate.pre-open .bw-gate-stat:nth-child(2) { opacity: 1; transform: translateY(0); transition-delay: 1.4s; }
.bw-gate.pre-open .bw-gate-stat:nth-child(3) { opacity: 1; transform: translateY(0); transition-delay: 1.6s; }
.bw-gate.pre-open .bw-gate-stat:nth-child(4) { opacity: 1; transform: translateY(0); transition-delay: 1.8s; }
.bw-gate-stat-value { font-family: Georgia, serif; font-size: clamp(28px, 4vw, 48px); color: #e6edf3; }
.bw-gate-stat-label { font-family: 'Consolas', monospace; font-size: 9px; letter-spacing: 4px; color: rgba(139,148,158,0.5); margin-top: 4px; text-transform: uppercase; }
.bw-gate-enter {
  margin-top: 40px; padding: 12px 36px; background: transparent;
  border: 1px solid rgba(88,166,255,0.3); border-radius: 24px; color: rgba(88,166,255,0.8);
  font-family: 'Consolas', monospace; font-size: 12px; letter-spacing: 4px;
  text-transform: uppercase; cursor: pointer;
  opacity: 0; transform: translateY(20px);
  transition: opacity 0.6s ease 2.2s, transform 0.6s ease 2.2s, border-color 0.3s, color 0.3s, box-shadow 0.3s;
}
.bw-gate.pre-open .bw-gate-enter { opacity: 1; transform: translateY(0); }
.bw-gate-enter:hover { border-color: rgba(88,166,255,0.7); color: #58a6ff; box-shadow: 0 0 30px rgba(88,166,255,0.15); }
.bw-gate.opening { opacity: 0; pointer-events: none; }

/* Breadcrumb */
.bw-breadcrumb {
  position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
  z-index: 30; display: none; align-items: center; gap: 10px;
  background: rgba(8,12,24,0.85); backdrop-filter: blur(12px);
  padding: 10px 20px; border-radius: 20px; border: 1px solid rgba(88,166,255,0.15);
  font-family: 'Consolas', monospace; font-size: 13px;
}
.bw-breadcrumb.visible { display: flex; }
.bw-crumb { color: rgba(139,148,158,0.7); cursor: pointer; transition: color 0.2s; }
.bw-crumb:hover { color: #e6edf3; }
.bw-crumb.active { color: #58a6ff; cursor: default; }
.bw-crumb-sep { color: rgba(88,166,255,0.3); font-size: 10px; }

/* Tooltip */
.bw-tooltip {
  position: fixed; pointer-events: none; z-index: 40;
  background: rgba(8,12,24,0.94); backdrop-filter: blur(12px);
  border: 1px solid rgba(88,166,255,0.2); border-radius: 12px;
  padding: 14px 18px; max-width: 320px;
  opacity: 0; transition: opacity 0.15s; font-size: 13px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.bw-tooltip.visible { opacity: 1; }
.bw-tooltip-name { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
.bw-tooltip-type { font-family: 'Consolas', monospace; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
.bw-tooltip-meta { color: rgba(139,148,158,0.7); line-height: 1.6; }
.bw-tooltip-narrative { margin-top: 8px; color: rgba(200,210,220,0.8); line-height: 1.5; font-style: italic; font-size: 12px; }
.bw-tooltip-health { margin-top: 6px; font-weight: 500; }
.bw-tooltip-health.green { color: #3fb950; }
.bw-tooltip-health.orange { color: #d29922; }
.bw-tooltip-health.red { color: #f85149; }

/* File panel */
.bw-file-panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: 460px; z-index: 50;
  background: rgba(8,12,24,0.95); backdrop-filter: blur(16px);
  border-left: 1px solid rgba(88,166,255,0.12);
  transform: translateX(100%); transition: transform 0.35s cubic-bezier(0.16,1,0.3,1);
  display: flex; flex-direction: column; overflow: hidden;
}
.bw-file-panel.open { transform: translateX(0); }
.bw-file-panel-header {
  padding: 20px 24px; border-bottom: 1px solid rgba(88,166,255,0.08);
  display: flex; justify-content: space-between; align-items: flex-start; flex-shrink: 0;
}
.bw-file-panel-title { font-weight: 600; font-size: 16px; word-break: break-all; }
.bw-file-panel-path { font-family: 'Consolas', monospace; font-size: 11px; color: rgba(139,148,158,0.5); margin-top: 4px; }
.bw-file-panel-close {
  background: none; border: 1px solid rgba(88,166,255,0.15); border-radius: 6px;
  width: 30px; height: 30px; cursor: pointer; color: rgba(139,148,158,0.6);
  display: flex; align-items: center; justify-content: center; font-size: 18px;
  flex-shrink: 0; transition: background 0.2s;
}
.bw-file-panel-close:hover { background: rgba(88,166,255,0.08); }
.bw-file-panel-body { flex: 1; overflow-y: auto; padding: 24px; font-size: 13px; line-height: 1.7; }
.bw-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
.bw-stat-box { background: rgba(16,20,32,0.8); border: 1px solid rgba(88,166,255,0.06); border-radius: 10px; padding: 14px; }
.bw-stat-val { font-size: 22px; font-weight: 600; }
.bw-stat-lbl { font-size: 9px; letter-spacing: 3px; color: rgba(139,148,158,0.5); text-transform: uppercase; margin-top: 2px; }
.bw-churn-bar { height: 4px; border-radius: 2px; background: rgba(48,54,61,0.4); margin-top: 8px; overflow: hidden; }
.bw-churn-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
.bw-section { margin-bottom: 24px; }
.bw-section-title { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: rgba(139,148,158,0.5); margin-bottom: 10px; font-weight: 600; }
.bw-error-item { padding: 6px 0; border-bottom: 1px solid rgba(48,54,61,0.2); font-family: 'Consolas', monospace; font-size: 12px; }
.bw-error-item .err { color: #f85149; } .bw-error-item .warn { color: #d29922; }
.bw-dep-item { padding: 4px 0; font-family: 'Consolas', monospace; font-size: 12px; color: #58a6ff; cursor: pointer; }
.bw-dep-item:hover { text-decoration: underline; }
.bw-analyze-btn {
  width: 100%; padding: 12px; border: 1px solid rgba(88,166,255,0.25); border-radius: 10px;
  background: rgba(88,166,255,0.06); color: #58a6ff; cursor: pointer;
  font-size: 13px; font-weight: 500; transition: background 0.2s;
}
.bw-analyze-btn:hover { background: rgba(88,166,255,0.12); }
.bw-analyze-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.bw-analyze-result { margin-top: 16px; line-height: 1.8; }
.bw-analyze-result h1,.bw-analyze-result h2,.bw-analyze-result h3 { margin: 14px 0 6px; }
.bw-analyze-result h1 { font-size: 16px; } .bw-analyze-result h2 { font-size: 14px; } .bw-analyze-result h3 { font-size: 13px; }
.bw-analyze-result code { background: rgba(48,54,61,0.5); padding: 1px 5px; border-radius: 3px; font-size: 12px; }
.bw-analyze-result strong { color: #e6edf3; }
.bw-analyze-result ul,.bw-analyze-result ol { padding-left: 18px; }
.bw-analyze-loading { display: flex; align-items: center; gap: 8px; color: rgba(139,148,158,0.5); margin-top: 12px; }
.bw-dots span { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: rgba(139,148,158,0.4); animation: bw-dot 1.2s ease-in-out infinite; }
.bw-dots span:nth-child(2) { animation-delay: 0.2s; } .bw-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bw-dot { 0%,80%,100%{opacity:.3;transform:scale(.8)} 40%{opacity:1;transform:scale(1.2)} }
.bw-cursor::after { content:''; display:inline-block; width:2px; height:1em; background:#58a6ff; margin-left:1px; vertical-align:text-bottom; animation:bw-blink .8s step-end infinite; }
@keyframes bw-blink { 0%,100%{opacity:1} 50%{opacity:0} }

/* SVG elements */
.planet-group { cursor: pointer; }
.planet-group.dimmed { opacity: 0.04; pointer-events: none; transition: opacity 0.6s ease; }
.file-rect { cursor: pointer; transition: filter 0.2s, opacity 0.2s; rx: 4; ry: 4; }
.file-rect:hover { filter: brightness(1.4); }
.file-label { font-family: 'Consolas', monospace; fill: rgba(230,237,243,0.9); pointer-events: none; text-anchor: middle; dominant-baseline: central; }
.file-rect.has-errors { stroke: #f85149; stroke-width: 2; animation: bw-errpulse 2s ease-in-out infinite; }
@keyframes bw-errpulse { 0%,100%{stroke-opacity:1} 50%{stroke-opacity:0.3} }

.bw-back-link {
  position: fixed; bottom: 20px; left: 20px; z-index: 30;
  font-family: 'Consolas', monospace; font-size: 12px;
  color: rgba(139,148,158,0.35); text-decoration: none; transition: color 0.2s;
}
.bw-back-link:hover { color: #58a6ff; }

/* Legend */
.bw-legend {
  position: fixed; bottom: 20px; right: 20px; z-index: 30;
  font-family: 'Consolas', monospace; font-size: 10px;
  color: rgba(139,148,158,0.4); text-align: right; line-height: 1.8;
}
.bw-legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
</style>
</head>
<body>

<canvas id="bw-space"></canvas>
<canvas id="bw-fx"></canvas>
<svg id="bw-world-svg"></svg>

<div class="bw-gate" id="bw-gate">
  <div class="bw-gate-rays"></div>
  <div class="bw-gate-content">
    <div class="bw-gate-project-name">${escapeHtml(projectName)}</div>
    <div class="bw-gate-subtitle">codebase explorer</div>
    <div class="bw-gate-divider"></div>
    <div class="bw-gate-stats" id="bw-gate-stats"></div>
    <button class="bw-gate-enter" id="bw-gate-enter">Enter the World</button>
  </div>
</div>

<div class="bw-breadcrumb" id="bw-breadcrumb">
  <span class="bw-crumb" id="bw-crumb-world">World</span>
  <span class="bw-crumb-sep">&rsaquo;</span>
  <span class="bw-crumb active" id="bw-crumb-zone"></span>
</div>

<div class="bw-tooltip" id="bw-tooltip"></div>

<div class="bw-file-panel" id="bw-file-panel">
  <div class="bw-file-panel-header">
    <div><div class="bw-file-panel-title" id="bw-fp-title"></div><div class="bw-file-panel-path" id="bw-fp-path"></div></div>
    <button class="bw-file-panel-close" id="bw-fp-close">&times;</button>
  </div>
  <div class="bw-file-panel-body" id="bw-fp-body"></div>
</div>

<a class="bw-back-link" href="/">&larr; wiki</a>
<div class="bw-legend" id="bw-legend"></div>

<script>
(function(){

  /* ===============================================
     ZONE THEMES
     =============================================== */
  var THEMES = {
    source:  { core: '#0d2240', mid: '#1a3a6b', outer: '#06101f', glow: '#3b82f6', accent: '#60a5fa', surface: '#2563eb' },
    test:    { core: '#0d2818', mid: '#1a4a2e', outer: '#061408', glow: '#22c55e', accent: '#4ade80', surface: '#16a34a' },
    config:  { core: '#2a1f00', mid: '#4a3a0a', outer: '#151000', glow: '#eab308', accent: '#fbbf24', surface: '#ca8a04' },
    static:  { core: '#2a1200', mid: '#4a1a0a', outer: '#150900', glow: '#f97316', accent: '#fb923c', surface: '#ea580c' },
    docs:    { core: '#1c1708', mid: '#3a2a10', outer: '#0e0b04', glow: '#d97706', accent: '#fbbf24', surface: '#b45309' },
    generic: { core: '#1a1030', mid: '#2d1a4a', outer: '#0d0818', glow: '#a855f7', accent: '#c084fc', surface: '#9333ea' }
  };
  var GEN_HUES = [270, 340, 200, 30, 160, 310, 50];
  var gIdx = 0;

  function themeFor(z) {
    var base = THEMES[z.zoneType] || THEMES.generic;
    if (z.zoneType === 'generic') {
      var h = GEN_HUES[gIdx++ % GEN_HUES.length];
      return {
        core: 'hsl('+h+',45%,15%)', mid: 'hsl('+h+',45%,22%)', outer: 'hsl('+h+',35%,8%)',
        glow: 'hsl('+h+',70%,60%)', accent: 'hsl('+h+',75%,70%)', surface: 'hsl('+h+',65%,50%)'
      };
    }
    return Object.assign({}, base);
  }

  /* Zone health classification */
  function zoneHealth(z) {
    if (z.errorCount > 10) return 'crisis';
    if (z.errorCount > 0) return 'troubled';
    if (z.avgChurn > 5) return 'active';
    return 'serene';
  }

  function healthNarrative(z) {
    var h = zoneHealth(z);
    if (h === 'crisis') return z.errorCount + ' errors burning. This zone needs rescue.';
    if (h === 'troubled') return z.errorCount + ' error' + (z.errorCount > 1 ? 's' : '') + ' smoldering. Handle with care.';
    if (h === 'active') return 'High activity (' + z.avgChurn.toFixed(1) + ' avg churn). Under active development.';
    return 'Stable and healthy. Peaceful waters.';
  }

  /* ===============================================
     STATE
     =============================================== */
  var S = {
    phase: 'gate', data: null, zone: null, themes: {},
    maturity: 0, // 0=brand new, 1=mature
    totalErrors: 0,
    animId: null, fxId: null,
    planetPositions: [], // for FX canvas
    embers: [] // fire particles for troubled zones
  };

  /* ===============================================
     MATURITY — drives the entire visual atmosphere
     =============================================== */
  function calcMaturity(data) {
    // Scale based on files: 0 files=0, ~1000 files=1.0
    var fileMat = Math.min(1, data.stats.totalFiles / 1000);
    // Also factor in total size: 0=nothing, 50MB+=1.0
    var sizeMat = Math.min(1, data.stats.totalSizeBytes / (50 * 1024 * 1024));
    // Blend
    return Math.min(1, fileMat * 0.6 + sizeMat * 0.4);
  }

  /* ===============================================
     DEEP SPACE BACKGROUND (canvas #bw-space)
     Maturity drives: bg color, star count, nebula intensity
     =============================================== */
  var spaceCanvas = document.getElementById('bw-space');
  var sCtx = spaceCanvas.getContext('2d');
  var stars = [], nebulae = [], shootingStars = [];

  // Background color interpolation: dawn → twilight → deep space
  function bgColor(mat) {
    // mat 0.0: #e8e0f0 (pale lavender dawn)
    // mat 0.3: #1a1530 (twilight)
    // mat 1.0: #04060e (deep space)
    if (mat < 0.3) {
      var t = mat / 0.3;
      return lerpColor([232,224,240], [26,21,48], t);
    }
    var t2 = (mat - 0.3) / 0.7;
    return lerpColor([26,21,48], [4,6,14], t2);
  }

  function lerpColor(a, b, t) {
    return 'rgb(' + Math.round(a[0]+(b[0]-a[0])*t) + ',' + Math.round(a[1]+(b[1]-a[1])*t) + ',' + Math.round(a[2]+(b[2]-a[2])*t) + ')';
  }

  function initSpace() {
    var w = spaceCanvas.width = window.innerWidth;
    var h = spaceCanvas.height = window.innerHeight;
    var mat = S.maturity;

    // Star count scales with maturity: 20 → 400
    var starCount = Math.round(20 + 380 * mat);
    stars = [];
    for (var i = 0; i < starCount; i++) {
      var depth = Math.random();
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        r: 0.3 + depth * 1.8,
        baseAlpha: (0.1 + depth * 0.7) * Math.max(0.15, mat),
        twinkleSpeed: 0.001 + Math.random() * 0.01,
        twinklePhase: Math.random() * Math.PI * 2,
        hue: Math.random() > 0.9 ? (Math.random() > 0.5 ? 220 : 30) : 240 // mostly blue-white, some gold
      });
    }

    // Nebula count/intensity scales with maturity: 0 → 6
    var nebCount = Math.round(mat * 6);
    var nebulaHues = [
      { r: 59, g: 130, b: 246 },
      { r: 168, g: 85, b: 247 },
      { r: 236, g: 72, b: 153 },
      { r: 34, g: 197, b: 94 },
      { r: 99, g: 102, b: 241 },
      { r: 244, g: 114, b: 182 }
    ];
    nebulae = [];
    for (var i = 0; i < nebCount; i++) {
      var c = nebulaHues[i % nebulaHues.length];
      nebulae.push({
        x: w * (0.1 + Math.random() * 0.8),
        y: h * (0.1 + Math.random() * 0.8),
        radius: 120 + Math.random() * 350,
        color: c,
        alpha: (0.01 + Math.random() * 0.025) * mat,
        driftX: (Math.random() - 0.5) * 0.06,
        driftY: (Math.random() - 0.5) * 0.04
      });
    }
  }

  var frameCount = 0;
  function drawSpace() {
    var w = spaceCanvas.width, h = spaceCanvas.height;
    frameCount++;

    sCtx.fillStyle = bgColor(S.maturity);
    sCtx.fillRect(0, 0, w, h);

    // Nebulae
    for (var i = 0; i < nebulae.length; i++) {
      var n = nebulae[i];
      n.x += n.driftX; n.y += n.driftY;
      if (n.x < -n.radius) n.x = w + n.radius;
      if (n.x > w + n.radius) n.x = -n.radius;
      if (n.y < -n.radius) n.y = h + n.radius;
      if (n.y > h + n.radius) n.y = -n.radius;
      var grad = sCtx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
      grad.addColorStop(0, 'rgba('+n.color.r+','+n.color.g+','+n.color.b+','+n.alpha+')');
      grad.addColorStop(0.4, 'rgba('+n.color.r+','+n.color.g+','+n.color.b+','+(n.alpha*0.4)+')');
      grad.addColorStop(1, 'rgba('+n.color.r+','+n.color.g+','+n.color.b+',0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(n.x - n.radius, n.y - n.radius, n.radius * 2, n.radius * 2);
    }

    // Stars
    var t = frameCount * 0.016;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed * 60 + s.twinklePhase);
      var a = s.baseAlpha * tw;
      sCtx.beginPath();
      sCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      var lum = s.hue === 240 ? '220,240,255' : (s.hue === 220 ? '180,200,255' : '255,230,180');
      sCtx.fillStyle = 'rgba(' + lum + ',' + a + ')';
      sCtx.fill();
      // Glint on bright stars
      if (s.r > 1.5 && tw > 0.85) {
        sCtx.strokeStyle = 'rgba(' + lum + ',' + (a * 0.25) + ')';
        sCtx.lineWidth = 0.5;
        var gl = s.r * 4;
        sCtx.beginPath(); sCtx.moveTo(s.x - gl, s.y); sCtx.lineTo(s.x + gl, s.y); sCtx.stroke();
        sCtx.beginPath(); sCtx.moveTo(s.x, s.y - gl); sCtx.lineTo(s.x, s.y + gl); sCtx.stroke();
      }
    }

    // Shooting stars (only in mature projects)
    if (S.maturity > 0.3 && Math.random() < 0.004 * S.maturity) {
      shootingStars.push({
        x: Math.random() * w, y: Math.random() * h * 0.4,
        vx: 3 + Math.random() * 5, vy: 1 + Math.random() * 2,
        life: 1, decay: 0.012 + Math.random() * 0.01
      });
    }
    for (var i = shootingStars.length - 1; i >= 0; i--) {
      var ss = shootingStars[i];
      var tailLen = 50 + (1 - ss.life) * 30;
      var grad = sCtx.createLinearGradient(ss.x, ss.y, ss.x - ss.vx * tailLen * 0.1, ss.y - ss.vy * tailLen * 0.1);
      grad.addColorStop(0, 'rgba(255,255,255,' + (ss.life * 0.9) + ')');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      sCtx.beginPath();
      sCtx.moveTo(ss.x, ss.y);
      sCtx.lineTo(ss.x - ss.vx * tailLen * 0.1, ss.y - ss.vy * tailLen * 0.1);
      sCtx.strokeStyle = grad; sCtx.lineWidth = 1.5; sCtx.stroke();
      ss.x += ss.vx; ss.y += ss.vy; ss.life -= ss.decay;
      if (ss.life <= 0 || ss.x > w + 50 || ss.y > h + 50) shootingStars.splice(i, 1);
    }

    S.animId = requestAnimationFrame(drawSpace);
  }

  /* ===============================================
     FX CANVAS — ember/fire particles for troubled zones
     =============================================== */
  var fxCanvas = document.getElementById('bw-fx');
  var fxCtx = fxCanvas.getContext('2d');

  function initFx() {
    fxCanvas.width = window.innerWidth;
    fxCanvas.height = window.innerHeight;
  }

  function drawFx() {
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

    // Spawn new embers from troubled planet positions
    for (var i = 0; i < S.planetPositions.length; i++) {
      var pp = S.planetPositions[i];
      if (pp.health === 'crisis') {
        // Lots of embers
        if (Math.random() < 0.3) spawnEmber(pp, 'crisis');
      } else if (pp.health === 'troubled') {
        if (Math.random() < 0.08) spawnEmber(pp, 'troubled');
      }
    }

    // Draw embers
    for (var i = S.embers.length - 1; i >= 0; i--) {
      var e = S.embers[i];
      e.x += e.vx + Math.sin(frameCount * 0.02 + e.phase) * 0.3;
      e.y += e.vy;
      e.vy -= 0.02; // float upward
      e.life -= e.decay;

      if (e.life <= 0) { S.embers.splice(i, 1); continue; }

      var a = e.life;
      fxCtx.beginPath();
      fxCtx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      if (e.type === 'crisis') {
        // Red-orange embers
        var cr = 255, cg = Math.round(80 + 100 * e.life), cb = Math.round(30 * e.life);
        fxCtx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (a * 0.8) + ')';
        // Glow
        fxCtx.shadowColor = 'rgba(255,100,30,' + (a * 0.5) + ')';
        fxCtx.shadowBlur = 8;
      } else {
        // Yellow-orange sparks
        fxCtx.fillStyle = 'rgba(255,200,50,' + (a * 0.6) + ')';
        fxCtx.shadowColor = 'rgba(255,180,30,' + (a * 0.3) + ')';
        fxCtx.shadowBlur = 4;
      }
      fxCtx.fill();
      fxCtx.shadowBlur = 0;
    }

    S.fxId = requestAnimationFrame(drawFx);
  }

  function spawnEmber(pp, type) {
    var angle = Math.random() * Math.PI * 2;
    var dist = pp.r * (0.4 + Math.random() * 0.6);
    S.embers.push({
      x: pp.x + Math.cos(angle) * dist,
      y: pp.y + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -(0.5 + Math.random() * 2),
      r: type === 'crisis' ? 1 + Math.random() * 2.5 : 0.5 + Math.random() * 1.5,
      life: 1, decay: 0.008 + Math.random() * 0.015,
      phase: Math.random() * Math.PI * 2,
      type: type
    });
  }

  /* Visibility pause */
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      if (S.animId) { cancelAnimationFrame(S.animId); S.animId = null; }
      if (S.fxId) { cancelAnimationFrame(S.fxId); S.fxId = null; }
    } else {
      if (!S.animId) S.animId = requestAnimationFrame(drawSpace);
      if (!S.fxId && S.phase === 'world') S.fxId = requestAnimationFrame(drawFx);
    }
  });

  initSpace(); initFx();
  drawSpace();
  window.addEventListener('resize', function() {
    spaceCanvas.width = window.innerWidth; spaceCanvas.height = window.innerHeight;
    fxCanvas.width = window.innerWidth; fxCanvas.height = window.innerHeight;
  });

  /* ===============================================
     HELPERS
     =============================================== */
  function fmtBytes(b) { if (b < 1024) return b + 'B'; if (b < 1048576) return (b / 1024).toFixed(1) + 'KB'; return (b / 1048576).toFixed(1) + 'MB'; }
  function fmtNum(n) { return n.toLocaleString(); }
  function escH(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /* ===============================================
     GATE
     =============================================== */
  var gate = document.getElementById('bw-gate');
  var gateStats = document.getElementById('bw-gate-stats');
  var enterBtn = document.getElementById('bw-gate-enter');

  setTimeout(function() { gate.classList.add('pre-open'); }, 200);

  fetch('/api/explain/project').then(function(r) { return r.json(); }).then(function(data) {
    S.data = data;
    S.maturity = calcMaturity(data);
    S.totalErrors = data.errors ? data.errors.length : 0;

    // Re-init background with maturity
    initSpace();

    gateStats.innerHTML =
      '<div class="bw-gate-stat"><div class="bw-gate-stat-value">' + fmtNum(data.stats.totalFiles) + '</div><div class="bw-gate-stat-label">Files</div></div>' +
      '<div class="bw-gate-stat"><div class="bw-gate-stat-value">' + fmtNum(data.stats.totalDirs) + '</div><div class="bw-gate-stat-label">Directories</div></div>' +
      '<div class="bw-gate-stat"><div class="bw-gate-stat-value">' + fmtBytes(data.stats.totalSizeBytes) + '</div><div class="bw-gate-stat-label">Size</div></div>' +
      '<div class="bw-gate-stat"><div class="bw-gate-stat-value">' + data.stats.healthScore + '%</div><div class="bw-gate-stat-label">Health</div></div>';

    enterBtn.addEventListener('click', function() {
      gate.classList.add('opening');
      setTimeout(function() {
        gate.remove();
        S.phase = 'world';
        renderWorld(data);
        S.fxId = requestAnimationFrame(drawFx);
        renderLegend(data);
      }, 1300);
    });
  }).catch(function(err) {
    gateStats.innerHTML = '<div class="bw-gate-stat"><div class="bw-gate-stat-value" style="color:#f85149">Error</div><div class="bw-gate-stat-label">' + escH(err.message) + '</div></div>';
  });

  /* ===============================================
     LEGEND
     =============================================== */
  function renderLegend(data) {
    var hasErr = data.errors && data.errors.length > 0;
    var html = '';
    if (hasErr) html += '<div><span class="bw-legend-dot" style="background:#f85149;box-shadow:0 0 6px #f85149"></span>errors</div>';
    html += '<div><span class="bw-legend-dot" style="background:#3fb950;box-shadow:0 0 6px #3fb950"></span>healthy</div>';
    html += '<div><span class="bw-legend-dot" style="background:#fbbf24;box-shadow:0 0 6px #fbbf24"></span>high churn</div>';
    html += '<div style="margin-top:4px;opacity:0.5">size = code volume</div>';
    document.getElementById('bw-legend').innerHTML = html;
  }

  /* ===============================================
     WORLD MAP
     =============================================== */
  var svg = d3.select('#bw-world-svg');
  var tooltip = document.getElementById('bw-tooltip');
  var breadcrumb = document.getElementById('bw-breadcrumb');
  var crumbZone = document.getElementById('bw-crumb-zone');
  var crumbWorld = document.getElementById('bw-crumb-world');

  function renderWorld(data) {
    var w = window.innerWidth, h = window.innerHeight;
    svg.attr('viewBox', '0 0 ' + w + ' ' + h);
    svg.selectAll('*').remove();
    S.planetPositions = [];

    var defs = svg.append('defs');

    // Glow filters
    ['soft','med','strong','fire'].forEach(function(name, i) {
      var dev = [6, 14, 28, 10][i];
      var f = defs.append('filter').attr('id', 'glow-' + name)
        .attr('x', '-80%').attr('y', '-80%').attr('width', '260%').attr('height', '260%');
      f.append('feGaussianBlur').attr('stdDeviation', dev).attr('result', 'b');
      var m = f.append('feMerge');
      m.append('feMergeNode').attr('in', 'b');
      m.append('feMergeNode').attr('in', 'SourceGraphic');
    });

    // Layout
    var root = d3.hierarchy({ children: data.zones.map(function(z) { return { data: z, value: Math.max(z.totalSizeBytes, 5000) }; }) })
      .sum(function(d) { return d.value || 0; });
    d3.pack().size([w * 0.80, h * 0.80]).padding(w * 0.05)(root);
    var ox = w * 0.10, oy = h * 0.10;

    gIdx = 0;
    data.zones.forEach(function(z) { S.themes[z.name] = themeFor(z); });

    // Positions map for arcs
    var positions = {};
    root.children.forEach(function(c) {
      positions[c.data.data.name] = { x: c.x + ox, y: c.y + oy, r: c.r };
    });

    // === DEPENDENCY BRIDGES ===
    var bridgeGroup = svg.append('g').attr('class', 'bridges');
    if (data.zoneDependencies) {
      data.zoneDependencies.forEach(function(dep, di) {
        var s = positions[dep.source], t = positions[dep.target];
        if (!s || !t) return;
        var theme = S.themes[dep.source] || THEMES.generic;
        var dx = t.x - s.x, dy = t.y - s.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var strength = Math.min(1, dep.weight / 10);
        var mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2 - dist * 0.15;
        var pathD = 'M' + s.x + ',' + s.y + ' Q' + mx + ',' + my + ' ' + t.x + ',' + t.y;

        // Wide dim glow underneath
        bridgeGroup.append('path')
          .attr('d', pathD).attr('fill', 'none')
          .attr('stroke', theme.glow).attr('stroke-width', 4 + strength * 4)
          .attr('opacity', 0.06).attr('filter', 'url(#glow-soft)');

        // Main arc
        bridgeGroup.append('path')
          .attr('d', pathD).attr('fill', 'none')
          .attr('stroke', theme.glow)
          .attr('stroke-width', 1 + strength * 2)
          .attr('opacity', 0.2 + strength * 0.2)
          .attr('stroke-dasharray', '6 4');

        // Animated particles along the bridge
        var numParticles = Math.max(1, Math.round(strength * 3));
        for (var p = 0; p < numParticles; p++) {
          var particle = bridgeGroup.append('circle')
            .attr('r', 1.5 + strength)
            .attr('fill', theme.accent)
            .attr('opacity', 0.5 + strength * 0.3)
            .attr('filter', 'url(#glow-soft)');

          (function(el, path, offset) {
            var pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('d', path);
            var totalLen = pathEl.getTotalLength();
            var speed = 0.0005 + Math.random() * 0.0003;
            var pos = offset;

            function animate() {
              if (S.phase !== 'world') return;
              pos = (pos + speed) % 1;
              var pt = pathEl.getPointAtLength(pos * totalLen);
              el.attr('cx', pt.x).attr('cy', pt.y);
              requestAnimationFrame(animate);
            }
            requestAnimationFrame(animate);
          })(particle, pathD, p / numParticles);
        }
      });
    }

    // === PLANETS ===
    var planetGroup = svg.append('g').attr('class', 'planets');
    root.children.forEach(function(c, i) {
      var z = c.data.data;
      var theme = S.themes[z.name];
      var health = zoneHealth(z);
      var cx = c.x + ox, cy = c.y + oy, r = c.r;
      var pR = r * 0.72;

      // Track for FX canvas
      S.planetPositions.push({ x: cx, y: cy, r: pR, health: health, zone: z.name });

      var g = planetGroup.append('g')
        .attr('class', 'planet-group')
        .attr('data-zone', z.name)
        .attr('transform', 'translate(' + cx + ',' + cy + ')');

      // Per-planet gradient
      var gId = 'pg' + i;
      var gr = defs.append('radialGradient').attr('id', gId)
        .attr('cx', '35%').attr('cy', '30%').attr('r', '70%');

      if (health === 'crisis') {
        // Molten core gradient
        gr.append('stop').attr('offset', '0%').attr('stop-color', '#ff6b35').attr('stop-opacity', 0.9);
        gr.append('stop').attr('offset', '30%').attr('stop-color', '#8b1a1a');
        gr.append('stop').attr('offset', '70%').attr('stop-color', theme.core);
        gr.append('stop').attr('offset', '100%').attr('stop-color', '#1a0505');
      } else if (health === 'troubled') {
        gr.append('stop').attr('offset', '0%').attr('stop-color', '#fbbf24').attr('stop-opacity', 0.7);
        gr.append('stop').attr('offset', '35%').attr('stop-color', theme.mid);
        gr.append('stop').attr('offset', '100%').attr('stop-color', theme.outer);
      } else {
        gr.append('stop').attr('offset', '0%').attr('stop-color', theme.accent).attr('stop-opacity', 0.8);
        gr.append('stop').attr('offset', '40%').attr('stop-color', theme.core);
        gr.append('stop').attr('offset', '100%').attr('stop-color', theme.outer);
      }

      // === Atmosphere layers ===
      // Outer halo
      var haloColor = health === 'crisis' ? 'rgba(248,81,73,0.08)' :
                      health === 'troubled' ? 'rgba(234,179,8,0.06)' :
                      health === 'active' ? theme.glow.replace(')', ',0.08)').replace('hsl','hsla').replace('rgb','rgba') :
                      theme.glow.replace(')', ',0.05)').replace('hsl','hsla').replace('rgb','rgba');
      g.append('circle').attr('r', pR * 2).attr('fill', haloColor).attr('filter', 'url(#glow-strong)');

      // Inner atmosphere
      g.append('circle').attr('r', pR * 1.2)
        .attr('fill', 'none').attr('stroke', health === 'crisis' ? '#f85149' : theme.glow)
        .attr('stroke-width', 1.5).attr('opacity', 0.08).attr('filter', 'url(#glow-med)');

      // Drop shadow
      g.append('ellipse').attr('cx', 3).attr('cy', pR * 0.85)
        .attr('rx', pR * 0.6).attr('ry', pR * 0.12)
        .attr('fill', 'rgba(0,0,0,0.25)').attr('filter', 'url(#glow-soft)');

      // === Main planet body ===
      g.append('circle').attr('class', 'planet-body').attr('r', pR)
        .attr('fill', 'url(#' + gId + ')')
        .attr('stroke', health === 'crisis' ? '#f85149' : health === 'troubled' ? '#d29922' : theme.glow)
        .attr('stroke-width', health === 'crisis' ? 2 : 1.5)
        .attr('stroke-opacity', health === 'crisis' ? 0.5 : 0.3);

      // === Surface detail by health ===
      if (health === 'crisis' || health === 'troubled') {
        // Cracks on the surface
        var numCracks = health === 'crisis' ? 6 : 3;
        for (var cr = 0; cr < numCracks; cr++) {
          var a1 = (cr / numCracks) * Math.PI * 2 + Math.random() * 0.5;
          var startR = pR * 0.1;
          var endR = pR * (0.4 + Math.random() * 0.4);
          var midA = a1 + (Math.random() - 0.5) * 0.4;
          var crackPath = 'M' + (Math.cos(a1)*startR) + ',' + (Math.sin(a1)*startR) +
            ' Q' + (Math.cos(midA)*endR*0.6) + ',' + (Math.sin(midA)*endR*0.6) +
            ' ' + (Math.cos(a1+0.2)*endR) + ',' + (Math.sin(a1+0.2)*endR);
          g.append('path').attr('d', crackPath)
            .attr('fill', 'none')
            .attr('stroke', health === 'crisis' ? '#ff6b35' : '#d29922')
            .attr('stroke-width', health === 'crisis' ? 1.5 : 0.8)
            .attr('opacity', health === 'crisis' ? 0.6 : 0.3)
            .attr('filter', 'url(#glow-fire)');
        }
      } else {
        // Healthy: latitude bands (serene surface texture)
        for (var b = 0; b < 4; b++) {
          var bandY = -pR * 0.5 + b * (pR * 0.35);
          var bandW = Math.sqrt(Math.max(0, pR * pR - bandY * bandY)) * 2;
          if (bandW > 10) {
            g.append('ellipse').attr('cx', 0).attr('cy', bandY)
              .attr('rx', bandW * 0.46).attr('ry', pR * 0.03)
              .attr('fill', 'none').attr('stroke', theme.accent)
              .attr('stroke-width', 0.5).attr('opacity', 0.1 + b * 0.02);
          }
        }
      }

      // === File dots on surface ===
      var fileDots = Math.min(z.fileCount, 60); // cap for performance
      var errPaths = {};
      if (data.errors) data.errors.forEach(function(e) { errPaths[e.path] = true; });
      var churnMap = {};
      if (data.churn) data.churn.forEach(function(ch) { churnMap[ch.path] = ch.commitCount; });
      var maxChurn = z.maxChurn || 1;

      for (var fi = 0; fi < fileDots; fi++) {
        var file = z.files[fi];
        if (!file) break;
        // Place in a spiral pattern on the planet face
        var goldenAngle = 2.39996;
        var fAngle = fi * goldenAngle;
        var fDist = pR * 0.15 + (fi / fileDots) * pR * 0.55;
        var fx = Math.cos(fAngle) * fDist;
        var fy = Math.sin(fAngle) * fDist;
        // Check if inside circle
        if (fx * fx + fy * fy > pR * pR * 0.8) continue;

        var hasErr = !!errPaths[file.path];
        var churn = churnMap[file.path] || 0;
        var churnPct = churn / maxChurn;
        var dotR = 1 + Math.min(2, (file.sizeBytes / (z.totalSizeBytes / z.fileCount)) * 1.2);

        var dotColor = hasErr ? '#f85149' : (churnPct > 0.5 ? '#fbbf24' : theme.accent);
        var dotAlpha = hasErr ? 0.8 : (0.2 + churnPct * 0.5);

        g.append('circle').attr('cx', fx).attr('cy', fy).attr('r', dotR)
          .attr('fill', dotColor).attr('opacity', dotAlpha);

        // Error dots get a glow
        if (hasErr) {
          g.append('circle').attr('cx', fx).attr('cy', fy).attr('r', dotR * 2)
            .attr('fill', 'rgba(248,81,73,0.3)').attr('filter', 'url(#glow-fire)');
        }
      }

      // === Specular highlight ===
      var hlId = 'hl' + i;
      var hlG = defs.append('radialGradient').attr('id', hlId)
        .attr('cx', '28%').attr('cy', '22%').attr('r', '45%');
      hlG.append('stop').attr('offset', '0%').attr('stop-color', '#fff').attr('stop-opacity', health === 'crisis' ? 0.05 : 0.12);
      hlG.append('stop').attr('offset', '100%').attr('stop-color', '#fff').attr('stop-opacity', 0);
      g.append('circle').attr('r', pR).attr('fill', 'url(#' + hlId + ')');

      // === Orbital ring (some zone types) ===
      if (z.zoneType === 'config' || z.zoneType === 'source' || (z.zoneType === 'generic' && i % 3 === 0)) {
        var ringG = g.append('g').attr('transform', 'rotate(-18)');
        ringG.append('ellipse').attr('rx', pR * 1.45).attr('ry', pR * 0.22)
          .attr('fill', 'none').attr('stroke', theme.accent)
          .attr('stroke-width', pR * 0.04).attr('opacity', 0.12);
        ringG.append('ellipse').attr('rx', pR * 1.45).attr('ry', pR * 0.22)
          .attr('fill', 'none').attr('stroke', theme.accent)
          .attr('stroke-width', 0.5).attr('opacity', 0.2);
      }

      // === Error badge ===
      if (z.errorCount > 0) {
        var bx = pR * 0.6, by = -pR * 0.6;
        g.append('circle').attr('cx', bx).attr('cy', by).attr('r', 12)
          .attr('fill', '#dc2626').attr('filter', 'url(#glow-fire)');
        g.append('text').attr('x', bx).attr('y', by)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
          .attr('fill', '#fff').attr('font-size', '10px').attr('font-weight', '700')
          .text(z.errorCount);
      }

      // === Labels ===
      var fs = Math.max(11, Math.min(20, pR * 0.3));
      g.append('text').attr('text-anchor', 'middle').attr('y', -fs * 0.4)
        .attr('fill', health === 'crisis' ? '#f85149' : theme.accent)
        .attr('font-size', fs + 'px').attr('font-weight', '600')
        .attr('font-family', "'Segoe UI', sans-serif")
        .text(z.name);
      g.append('text').attr('text-anchor', 'middle').attr('y', fs * 0.6)
        .attr('fill', 'rgba(180,190,200,0.45)').attr('font-size', '10px')
        .attr('font-family', "'Consolas', monospace")
        .text(z.fileCount + ' files \u00b7 ' + fmtBytes(z.totalSizeBytes));

      // === Floating animation ===
      var dur = 4 + Math.random() * 3;
      var amp = health === 'crisis' ? 1 + Math.random() * 1.5 : 3 + Math.random() * 4; // crisis = jittery
      var phase = Math.random() * Math.PI * 2;
      (function(group, cx2, cy2, duration, amplitude, ph, hlth, ppIdx) {
        var start = performance.now();
        function float() {
          if (S.phase !== 'world') return;
          var el = (performance.now() - start) / 1000;
          var dy, dx2;
          if (hlth === 'crisis') {
            // Shaking + slow float
            dy = Math.sin(el * 1.5 + ph) * amplitude + Math.sin(el * 12) * 1.2;
            dx2 = Math.cos(el * 2 + ph) * amplitude * 0.4 + Math.cos(el * 15) * 0.8;
          } else {
            dy = Math.sin(el * (Math.PI * 2 / duration) + ph) * amplitude;
            dx2 = Math.cos(el * (Math.PI * 2 / (duration * 1.4)) + ph) * (amplitude * 0.3);
          }
          var nx = cx2 + dx2, ny = cy2 + dy;
          group.attr('transform', 'translate(' + nx + ',' + ny + ')');
          // Update FX canvas position
          if (S.planetPositions[ppIdx]) { S.planetPositions[ppIdx].x = nx; S.planetPositions[ppIdx].y = ny; }
          requestAnimationFrame(float);
        }
        requestAnimationFrame(float);
      })(g, cx, cy, dur, amp, phase, health, S.planetPositions.length - 1);

      // === Hover ===
      g.on('mouseenter', function() {
        d3.select(this).select('.planet-body')
          .transition().duration(200)
          .attr('stroke-opacity', 0.7).attr('stroke-width', 2.5);

        var hc = z.errorCount === 0 ? 'green' : z.errorCount < 5 ? 'orange' : 'red';
        var ht = z.errorCount === 0 ? 'Healthy' : z.errorCount + ' error' + (z.errorCount > 1 ? 's' : '');
        tooltip.innerHTML =
          '<div class="bw-tooltip-name" style="color:' + (health === 'crisis' ? '#f85149' : theme.accent) + '">' + escH(z.name) + '/</div>' +
          '<div class="bw-tooltip-type" style="color:' + theme.accent + '">' + escH(z.zoneType) + '</div>' +
          '<div class="bw-tooltip-meta">' + z.fileCount + ' files &middot; ' + fmtBytes(z.totalSizeBytes) + ' &middot; churn ' + z.avgChurn.toFixed(1) + '</div>' +
          '<div class="bw-tooltip-health ' + hc + '">' + ht + '</div>' +
          '<div class="bw-tooltip-narrative">' + escH(healthNarrative(z)) + '</div>';
        tooltip.classList.add('visible');
      });
      g.on('mousemove', function(event) {
        var x = event.clientX + 16, y = event.clientY + 16;
        if (x + 320 > window.innerWidth) x = event.clientX - 336;
        if (y + 140 > window.innerHeight) y = event.clientY - 156;
        tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
      });
      g.on('mouseleave', function() {
        d3.select(this).select('.planet-body')
          .transition().duration(300).attr('stroke-opacity', 0.3).attr('stroke-width', 1.5);
        tooltip.classList.remove('visible');
      });

      g.on('click', function() { drillInto(z, { cx: cx, cy: cy, r: pR }); });
    });
  }

  /* ===============================================
     DRILL INTO ZONE
     =============================================== */
  function drillInto(zone, pos) {
    S.phase = 'zone';
    S.zone = zone;
    tooltip.classList.remove('visible');
    crumbZone.textContent = zone.name + '/';
    breadcrumb.classList.add('visible');

    svg.selectAll('.planet-group').classed('dimmed', function() {
      return this.getAttribute('data-zone') !== zone.name;
    });
    svg.selectAll('.bridges').style('opacity', '0').style('transition', 'opacity 0.5s');

    var viewR = pos.r * 3.5;
    var vb = (pos.cx - viewR) + ' ' + (pos.cy - viewR) + ' ' + (viewR * 2) + ' ' + (viewR * 2);
    svg.transition().duration(900).ease(d3.easeCubicInOut).attr('viewBox', vb);
    setTimeout(function() { renderZoneFiles(zone, pos); }, 950);
  }

  function renderZoneFiles(zone, pos) {
    var theme = S.themes[zone.name] || THEMES.generic;
    var data = S.data;
    var churnMap = {};
    if (data.churn) data.churn.forEach(function(c) { churnMap[c.path] = c.commitCount; });
    var maxChurn = zone.maxChurn || 1;
    var errorPaths = {};
    if (data.errors) data.errors.forEach(function(e) { errorPaths[e.path] = true; });

    var side = pos.r * 2 * 0.85;
    var x0 = pos.cx - side / 2, y0 = pos.cy - side / 2;

    var root = d3.hierarchy({ children: zone.files.map(function(f) { return { data: f, value: Math.max(f.sizeBytes, 100) }; }) })
      .sum(function(d) { return d.value || 0; });
    d3.treemap().size([side, side]).padding(3).round(true)(root);

    var fileGroup = svg.append('g').attr('class', 'file-nodes');
    if (!root.children) return;

    root.children.forEach(function(c) {
      var f = c.data.data;
      var churn = churnMap[f.path] || 0;
      var churnPct = churn / maxChurn;
      var hasErr = !!errorPaths[f.path];
      var fillColor = hasErr ? '#3d1212' : (churnPct > 0.5 ? theme.surface : theme.core);
      var rx = x0 + c.x0, ry = y0 + c.y0, rw = c.x1 - c.x0, rh = c.y1 - c.y0;

      var fg = fileGroup.append('g');
      fg.append('rect')
        .attr('class', 'file-rect' + (hasErr ? ' has-errors' : ''))
        .attr('x', rx).attr('y', ry).attr('width', rw).attr('height', rh)
        .attr('fill', fillColor)
        .attr('stroke', hasErr ? '#f85149' : theme.glow)
        .attr('stroke-width', hasErr ? 1.5 : 0.5)
        .attr('stroke-opacity', hasErr ? 0.5 : 0.2)
        .attr('opacity', 0.3 + churnPct * 0.5);

      if (rw > 40 && rh > 18) {
        var label = f.name.length > 14 ? f.name.slice(0, 13) + '\u2026' : f.name;
        var lfs = Math.max(8, Math.min(12, rw / 8));
        fg.append('text').attr('class', 'file-label').attr('x', rx + rw / 2).attr('y', ry + rh / 2)
          .attr('font-size', lfs + 'px').text(label);
      }

      fg.style('cursor', 'pointer').on('click', function(event) {
        event.stopPropagation();
        showFileDetail(f.path);
      });

      fg.on('mouseenter', function() {
        tooltip.innerHTML =
          '<div class="bw-tooltip-name">' + escH(f.name) + '</div>' +
          '<div class="bw-tooltip-meta">' + fmtBytes(f.sizeBytes) + (churn ? ' &middot; ' + churn + ' commits' : '') + '</div>' +
          (hasErr ? '<div class="bw-tooltip-health red">Has errors</div>' : '');
        tooltip.classList.add('visible');
      });
      fg.on('mousemove', function(event) {
        var x = event.clientX + 14, y = event.clientY + 14;
        if (x + 280 > window.innerWidth) x = event.clientX - 290;
        tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
      });
      fg.on('mouseleave', function() { tooltip.classList.remove('visible'); });
    });
  }

  /* ===============================================
     BACK TO WORLD
     =============================================== */
  crumbWorld.addEventListener('click', function() {
    if (S.phase !== 'zone') return;
    S.phase = 'world'; S.zone = null;
    breadcrumb.classList.remove('visible');
    closeFilePanel(); tooltip.classList.remove('visible');
    svg.selectAll('.file-nodes').remove();
    svg.selectAll('.planet-group').classed('dimmed', false);
    svg.selectAll('.bridges').style('opacity', null).style('transition', 'opacity 0.5s');
    var w = window.innerWidth, h = window.innerHeight;
    svg.transition().duration(700).ease(d3.easeCubicInOut).attr('viewBox', '0 0 ' + w + ' ' + h);
  });

  /* ===============================================
     FILE DETAIL PANEL
     =============================================== */
  var panel = document.getElementById('bw-file-panel');
  var fpTitle = document.getElementById('bw-fp-title');
  var fpPath = document.getElementById('bw-fp-path');
  var fpBody = document.getElementById('bw-fp-body');
  document.getElementById('bw-fp-close').addEventListener('click', closeFilePanel);
  function closeFilePanel() { panel.classList.remove('open'); }

  function showFileDetail(filePath) {
    var parts = filePath.split('/');
    fpTitle.textContent = parts[parts.length - 1];
    fpPath.textContent = filePath;
    fpBody.innerHTML = '<div class="bw-analyze-loading"><span>Loading</span><span class="bw-dots"><span></span><span></span><span></span></span></div>';
    panel.classList.add('open');

    fetch('/api/explain/file?path=' + encodeURIComponent(filePath)).then(function(r) { return r.json(); }).then(function(detail) {
      var maxChurn = S.data.churn && S.data.churn.length > 0 ? S.data.churn[0].commitCount : 1;
      var churnPct = Math.min(100, Math.round((detail.churnScore / maxChurn) * 100));
      var churnColor = churnPct < 30 ? '#3fb950' : churnPct < 70 ? '#d29922' : '#f85149';

      var html = '<div class="bw-stat-grid">' +
        '<div class="bw-stat-box"><div class="bw-stat-val">' + fmtBytes(detail.sizeBytes) + '</div><div class="bw-stat-lbl">Size</div></div>' +
        '<div class="bw-stat-box"><div class="bw-stat-val">' + fmtNum(detail.lineCount) + '</div><div class="bw-stat-lbl">Lines</div></div>' +
        '<div class="bw-stat-box"><div class="bw-stat-val">' + detail.churnScore + '</div><div class="bw-stat-lbl">Git Churn</div>' +
          '<div class="bw-churn-bar"><div class="bw-churn-fill" style="width:' + churnPct + '%;background:' + churnColor + '"></div></div></div>' +
        '<div class="bw-stat-box"><div class="bw-stat-val">' + escH(detail.extension) + '</div><div class="bw-stat-lbl">Type</div></div>' +
      '</div>';

      if (detail.errors && detail.errors.length > 0) {
        html += '<div class="bw-section"><div class="bw-section-title">Errors & Warnings</div>';
        detail.errors.forEach(function(e) {
          html += '<div class="bw-error-item"><span class="' + (e.severity === 'error' ? 'err' : 'warn') + '">' + escH(e.severity) + '</span> L' + e.line + ': ' + escH(e.message) + '</div>';
        });
        html += '</div>';
      }
      if (detail.imports && detail.imports.length > 0) {
        html += '<div class="bw-section"><div class="bw-section-title">Imports (' + detail.imports.length + ')</div>';
        detail.imports.forEach(function(p) { html += '<div class="bw-dep-item">' + escH(p) + '</div>'; });
        html += '</div>';
      }
      if (detail.importedBy && detail.importedBy.length > 0) {
        html += '<div class="bw-section"><div class="bw-section-title">Imported By (' + detail.importedBy.length + ')</div>';
        detail.importedBy.forEach(function(p) { html += '<div class="bw-dep-item">' + escH(p) + '</div>'; });
        html += '</div>';
      }

      html += '<div class="bw-section"><button class="bw-analyze-btn" id="bw-analyze-trigger">Explain this file</button><div class="bw-analyze-result" id="bw-analyze-result"></div></div>';
      fpBody.innerHTML = html;

      document.getElementById('bw-analyze-trigger').addEventListener('click', function() {
        var btn = this;
        var result = document.getElementById('bw-analyze-result');
        btn.disabled = true; btn.textContent = 'Analyzing\u2026';
        result.innerHTML = '<div class="bw-analyze-loading"><span>Thinking</span><span class="bw-dots"><span></span><span></span><span></span></span></div>';

        fetch('/api/explain/analyze', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath })
        }).then(function(response) {
          var reader = response.body.getReader();
          var decoder = new TextDecoder();
          var fullText = '';
          result.innerHTML = '<div class="bw-cursor" id="bw-ac"></div>';
          var el = document.getElementById('bw-ac');
          function read() {
            reader.read().then(function(r2) {
              if (r2.done) { el.classList.remove('bw-cursor'); btn.textContent = 'Re-analyze'; btn.disabled = false; return; }
              var chunk = decoder.decode(r2.value, { stream: true });
              var lines = chunk.split('\\n');
              for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line.startsWith('event: done')) { el.classList.remove('bw-cursor'); btn.textContent = 'Re-analyze'; btn.disabled = false; return; }
                if (line.startsWith('data: ')) {
                  try { var d = JSON.parse(line.slice(6)); if (d.text) { fullText += d.text; el.innerHTML = simpleMarkdown(fullText); fpBody.scrollTop = fpBody.scrollHeight; } } catch(e) {}
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

  function simpleMarkdown(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
      .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
      .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\\n\\n/g, '</p><p>')
      .replace(/\\n/g, '<br>');
  }

  /* ===============================================
     KEYBOARD
     =============================================== */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (panel.classList.contains('open')) { closeFilePanel(); return; }
      if (S.phase === 'zone') { crumbWorld.click(); return; }
    }
  });

  /* ===============================================
     RESIZE
     =============================================== */
  window.addEventListener('resize', function() {
    if (S.phase === 'world' && S.data) {
      svg.selectAll('*').remove();
      renderWorld(S.data);
    }
  });

})();
</script>
</body>
</html>`;
}
