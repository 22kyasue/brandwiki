import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface IngestRule {
  from: string;
  to: string;
  maxSize?: number;
}

export interface Graph3DTheme {
  preset?: 'tokyo-night' | 'cosmos' | 'forest' | 'ocean' | 'minimal' | 'custom';
  background?: string;
  backgroundGradient?: [string, string];
  worldLabel?: string;        // e.g., "Neighborhoods" for yoyaku, "Modules" for code
  nodeLabel?: string;         // e.g., "Restaurants" for yoyaku, "Files" for code
  ambientColor?: string;
  accentColor?: string;
  particleColor?: string;
  glowIntensity?: number;
  starfield?: boolean;
  fog?: { color: string; near: number; far: number };
  // File graph mode options
  mode?: 'articles' | 'files';  // Toggle between wiki articles vs source files
  sourceRoot?: string;          // Root path for file scanning (e.g., "../")
  include?: string[];           // Glob patterns to include (e.g., ["backend/src/**/*.ts"])
  exclude?: string[];           // Glob patterns to exclude
  healthOverrides?: Record<string, 'green' | 'yellow' | 'gold' | 'red'>; // Manual file health
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
    explain?: string;
  };
  sources: Array<{ path: string; type: string; glob?: string }>;
  ingestPaths?: IngestRule[];
  watch?: {
    debounceMs?: number;
    autoCompile?: boolean;
  };
  graph3d?: Graph3DTheme;
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
