import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { callClaudeCLI } from './claude-cli.js';

export interface MotifInput {
  id: string;
  role: string;
  roleDesc: string;
  health: string;
  lineCount: number;
  fanIn: number;
  fanOut: number;
  absolutePath: string;
}

const SYSTEM_PROMPT = `You are a visual artist generating unique motifs for a living codebase visualization — a 3D park where every source file is a glowing landmark.

Each file gets a 256x256 SVG motif — a stamped sigil that reads as the file's coat of arms.

STRICT OUTPUT RULES:
- Output ONLY a single valid <svg>...</svg> document. No markdown fences, no prose, no explanation.
- Root element attributes: viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"
- Use white (#ffffff) with varying opacity (0.15 to 1.0) for strokes and fills. NO OTHER COLORS — the motif is tinted at runtime by the file's health color.
- 4 to 14 elements total: <circle>, <line>, <path>, <polygon>, <rect>, <ellipse>, <polyline>.
- Thin strokes (stroke-width 0.8 to 3). Use fill-opacity and stroke-opacity for layering.
- Abstract / symbolic — alchemy sigils, constellations, stamped seals, topographic contours, circuit glyphs. NEVER literal (no phones, gears, keyboards, icons).
- Match the file's character to its archetype:
    * orchestrator / root → radiant, spoked, sun-like, crowned
    * test → dotted, woven, constellation-like, stitched
    * type / schema → crystalline, angular, faceted, prismatic
    * voice → rippled, concentric waves, sonar
    * component → tapered, petal-like, bilateral
    * library / util → quiet, minimal, 2-3 elements
    * route / gate / portal → arched, framed, portal-like
    * harvest / scraper → scattered motes, constellation-fragment
    * hook / context → orbiting, satellite, tethered
    * ward / auth → spiked, defensive, shield-like
- Rotational or bilateral symmetry reads best; occasional asymmetry for character.
- Self-contained: no external refs, no <image>, no <script>, no <text>.

Return ONLY the SVG document starting with <svg and ending with </svg>.`;

function readSafely(path: string, maxChars = 2400): string {
  try {
    return readFileSync(path, 'utf-8').slice(0, maxChars);
  } catch {
    return '';
  }
}

function hashKey(filePath: string, content: string): string {
  return createHash('sha256').update(filePath + '\0' + content).digest('hex').slice(0, 24);
}

function cacheDir(root: string): string {
  return join(root, '.brandwiki', '.motif-cache');
}

function cachePath(root: string, key: string): string {
  return join(cacheDir(root), key + '.svg');
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function extractSVG(text: string): string | null {
  const match = text.match(/<svg[\s\S]*?<\/svg>/i);
  return match ? match[0] : null;
}

export function motifKeyFor(root: string, id: string, absolutePath: string): string | null {
  const content = readSafely(absolutePath);
  if (!content) return null;
  const key = hashKey(id, content);
  return existsSync(cachePath(root, key)) ? key : null;
}

export function motifPathFor(root: string, key: string): string {
  return cachePath(root, key);
}

export function motifUrlFor(key: string): string {
  return '/motifs/' + key + '.svg';
}

export async function generateMotif(
  root: string,
  input: MotifInput,
): Promise<{ key: string; generated: boolean }> {
  const content = readSafely(input.absolutePath);
  if (!content) throw new Error('Could not read ' + input.absolutePath);
  const key = hashKey(input.id, content);
  const outPath = cachePath(root, key);
  if (existsSync(outPath)) return { key, generated: false };

  ensureDir(dirname(outPath));

  const userMsg =
    'File: ' + input.id + '\n' +
    'Role: ' + input.role + ' (' + input.roleDesc + ')\n' +
    'Health: ' + input.health + '\n' +
    'Lines: ' + input.lineCount + ' · Imports (fan-out): ' + input.fanOut + ' · Imported-by (fan-in): ' + input.fanIn + '\n\n' +
    'Source excerpt:\n```\n' + content + '\n```\n\n' +
    'Generate this file\u2019s sigil. Output ONLY the SVG document, nothing else.';

  // Route through `claude -p` so this uses the Pro subscription rather than API credits.
  const output = await callClaudeCLI({
    system: SYSTEM_PROMPT,
    user: userMsg,
    timeoutMs: 5 * 60 * 1000,
  });

  const svg = extractSVG(output);
  if (!svg) throw new Error('No SVG in model response for ' + input.id);

  writeFileSync(outPath, svg, 'utf-8');
  return { key, generated: true };
}

export function classifyRoleForMotif(id: string): { role: string; desc: string } {
  const p = id.toLowerCase();
  if (/\.test\.|\.spec\.|__tests__|\.vitest/.test(p)) return { role: 'test', desc: 'Witness' };
  if (/\.d\.ts$|\/types?\//.test(p)) return { role: 'type', desc: 'Crystal' };
  if (/prisma|schema/.test(p)) return { role: 'schema', desc: 'Pillar' };
  if (/\/app\/.*\/page\./.test(p)) return { role: 'page', desc: 'Monument' };
  if (/\/app\/.*\/layout\./.test(p)) return { role: 'portal', desc: 'Portal' };
  if (/\/app\/api\/|\/pages\/api\//.test(p)) return { role: 'api', desc: 'Signal' };
  if (/\/routes?\//.test(p)) return { role: 'route', desc: 'Archway' };
  if (/\/jobs?\//.test(p)) return { role: 'job', desc: 'Orbiter' };
  if (/\/hooks?\//.test(p)) return { role: 'hook', desc: 'Hook' };
  if (/\/contexts?\//.test(p)) return { role: 'context', desc: 'Context' };
  if (/\/components?\//.test(p) && /\.tsx?$/.test(p)) return { role: 'component', desc: 'Petal' };
  if (/server\.(t|j)sx?$|\/cli\.(t|j)sx?$|\/src\/index\./.test(p)) return { role: 'root', desc: 'Gate' };
  if (/twilio|deepgram|cartesia|voice|tts|stt|audio|conversation/.test(p)) return { role: 'voice', desc: 'Resonator' };
  if (/scraper|tabelog|scrape|harvest/.test(p)) return { role: 'harvest', desc: 'Harvester' };
  if (/\bclaude\.(t|j)s|\btool(s|-loop)\.(t|j)s|orchestrat/.test(p)) return { role: 'orchestrator', desc: 'Conductor' };
  if (/\bauth\b|\bjwt\b/.test(p)) return { role: 'ward', desc: 'Ward' };
  if (/\/lib\//.test(p) || /\/utils?\//.test(p) || /\/helpers?\//.test(p)) return { role: 'library', desc: 'Library' };
  if (/\/env\.|\/config\.|\.config\./.test(p)) return { role: 'env', desc: 'Seed' };
  if (/\/middleware\b/.test(p)) return { role: 'gate', desc: 'Gate' };
  return { role: 'commons', desc: 'File' };
}
