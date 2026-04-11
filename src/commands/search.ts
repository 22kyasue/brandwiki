import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import fg from 'fast-glob';
import pc from 'picocolors';
import { findProjectRoot, brandwikiDir } from '../lib/config.js';

export async function searchCommand(query: string): Promise<void> {
  const root = findProjectRoot();
  const bwDir = brandwikiDir(root);
  const wikiDir = join(bwDir, 'wiki');
  const files = await fg('**/*.md', { cwd: wikiDir, absolute: true });

  const needle = query.toLowerCase();
  const hits: Array<{ file: string; line: number; text: string }> = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(needle)) {
        hits.push({ file: relative(wikiDir, file), line: idx + 1, text: line.trim() });
      }
    });
  }

  if (hits.length === 0) {
    console.log(pc.yellow(`No matches for "${query}"`));
    return;
  }

  console.log(pc.cyan(`${hits.length} matches:`));
  for (const hit of hits.slice(0, 50)) {
    console.log(`  ${pc.dim(`${hit.file}:${hit.line}`)} ${hit.text}`);
  }
  if (hits.length > 50) console.log(pc.dim(`  ... and ${hits.length - 50} more`));
}
