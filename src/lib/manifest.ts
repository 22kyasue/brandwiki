import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export interface ManifestEntry {
  path: string;
  hash: string;
  mtime: number;
  processedAt: string;
}

export interface Manifest {
  version: number;
  lastCompile: string | null;
  rawFiles: Record<string, ManifestEntry>;
  articles: Record<string, { sourceHashes: string[]; updatedAt: string; words: number }>;
}

export function loadManifest(brandwikiDir: string): Manifest {
  const path = join(brandwikiDir, 'manifest.json');
  if (!existsSync(path)) {
    return { version: 1, lastCompile: null, rawFiles: {}, articles: {} };
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function saveManifest(brandwikiDir: string, manifest: Manifest): void {
  const path = join(brandwikiDir, 'manifest.json');
  writeFileSync(path, JSON.stringify(manifest, null, 2), 'utf-8');
}

export function hashFile(path: string): string {
  const content = readFileSync(path);
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export function fileChanged(manifest: Manifest, absolutePath: string, relativeKey: string): boolean {
  const entry = manifest.rawFiles[relativeKey];
  if (!entry) return true;
  const stat = statSync(absolutePath);
  if (stat.mtimeMs !== entry.mtime) {
    const hash = hashFile(absolutePath);
    return hash !== entry.hash;
  }
  return false;
}
