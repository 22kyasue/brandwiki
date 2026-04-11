import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fg from 'fast-glob';
import pc from 'picocolors';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { loadManifest } from '../lib/manifest.js';

export async function statusCommand(): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);
  const manifest = loadManifest(bwDir);

  const wikiFiles = await fg('**/*.md', { cwd: join(bwDir, 'wiki'), absolute: true });
  const rawFiles = await fg('**/*', { cwd: join(bwDir, 'raw'), absolute: true, onlyFiles: true });

  let totalWords = 0;
  for (const f of wikiFiles) {
    totalWords += readFileSync(f, 'utf-8').split(/\s+/).length;
  }

  console.log(pc.cyan(`${config.projectName} Brand Wiki`));
  console.log(pc.dim('─'.repeat(40)));
  console.log(`  Template:     ${config.template}`);
  console.log(`  Language:     ${config.language}`);
  console.log(`  Categories:   ${config.categories.length}`);
  console.log(`  Raw files:    ${rawFiles.length}`);
  console.log(`  Articles:     ${wikiFiles.length}`);
  console.log(`  Total words:  ${totalWords.toLocaleString()}`);
  console.log(`  Last compile: ${manifest.lastCompile ?? pc.yellow('never')}`);
}
