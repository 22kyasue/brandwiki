import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface IngestRule {
  from: string;
  to: string;
  maxSize?: number;
}

export interface ExternalSource {
  type: 'wikipedia' | 'url';
  articles?: string[];
  urls?: string[];
  language?: string;
  category?: string;
  tags?: string[];
}

export interface Competitor {
  name: string;
  description?: string;
  urls?: string[];
  category?: string;
  tags?: string[];
  focus?: string[];
}

export interface ResearchConfig {
  competitors?: Competitor[];
  targetCategory?: string;
  cadenceDays?: number;
  maxBytesPerCompetitor?: number;
  promptOverride?: string;
}

export interface BrandwikiConfig {
  projectName: string;
  language: 'ja' | 'en';
  template: string;
  provider?: 'claude-cli' | 'api';
  categories: Array<{ id: string; title: string; description: string }>;
  model: {
    compile: string;
    lint: string;
    query: string;
    research?: string;
  };
  sources: Array<{ path: string; type: string; glob?: string }>;
  ingestPaths?: IngestRule[];
  externalSources?: ExternalSource[];
  research?: ResearchConfig;
  watch?: {
    debounceMs?: number;
    autoCompile?: boolean;
  };
  notifications?: {
    webhookUrl?: string;
    events?: ('compile' | 'fetch' | 'lint')[];
  };
}

export function findProjectRoot(startDir: string = process.cwd()): string {
  // Explicit override — used by wrappers (e.g. Hadi) that mount the .brandwiki/
  // tree on a tmpfs and need to redirect every command at it without depending
  // on cwd. Accepts either the directory containing .brandwiki/ or the
  // .brandwiki/ directory itself.
  const override = process.env.BRANDWIKI_DIR;
  if (override) {
    const abs = resolve(override);
    if (existsSync(join(abs, '.brandwiki', 'config.json'))) return abs;
    if (existsSync(join(abs, 'config.json'))) return resolve(abs, '..');
    throw new Error(`BRANDWIKI_DIR=${override} does not contain a .brandwiki/config.json`);
  }

  let dir = resolve(startDir);
  while (dir !== resolve(dir, '..')) {
    if (existsSync(join(dir, '.brandwiki', 'config.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('No .brandwiki/config.json found. Run `brandwiki init` first.');
}

export function loadConfig(projectRoot: string): BrandwikiConfig {
  const configPath = join(projectRoot, '.brandwiki', 'config.json');
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as BrandwikiConfig;
}

export function brandwikiDir(projectRoot: string): string {
  return join(projectRoot, '.brandwiki');
}
