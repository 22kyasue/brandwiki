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
    explain?: string;
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
