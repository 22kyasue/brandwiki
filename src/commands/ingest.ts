import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import fg from 'fast-glob';
import pc from 'picocolors';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';

interface IngestOptions {
  verbose?: boolean;
}

const DEFAULT_MAX_SIZE = 200_000;
const DEFAULT_MAX_CONTENT = 40_000;

export async function ingestCommand(options: IngestOptions): Promise<{ copied: number; skipped: number }> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);
  const rules = config.ingestPaths ?? [];

  if (rules.length === 0) {
    console.log(pc.yellow('No ingestPaths defined in config.json. Nothing to ingest.'));
    console.log(pc.dim('Add an "ingestPaths" array to .brandwiki/config.json to enable auto-ingest.'));
    return { copied: 0, skipped: 0 };
  }

  console.log(pc.cyan(`Ingesting from ${rules.length} rules...`));

  let copied = 0;
  let skipped = 0;

  for (const rule of rules) {
    const pattern = rule.from;
    const destDir = join(bwDir, rule.to);
    const maxSize = rule.maxSize ?? DEFAULT_MAX_SIZE;

    const files = await fg(pattern, { cwd: root, absolute: true, dot: false });

    for (const src of files) {
      try {
        const stat = statSync(src);
        if (!stat.isFile()) continue;
        if (stat.size > maxSize) {
          skipped++;
          if (options.verbose) console.log(pc.dim(`  skip (large): ${relative(root, src)}`));
          continue;
        }

        const relFromRoot = relative(root, src).replaceAll('\\', '/');
        const flatName = relFromRoot.replace(/[\/\\]/g, '__');
        const destPath = join(destDir, flatName);

        mkdirSync(dirname(destPath), { recursive: true });

        let content = readFileSync(src, 'utf-8');
        if (content.length > DEFAULT_MAX_CONTENT) {
          content = content.slice(0, DEFAULT_MAX_CONTENT) + '\n\n[... truncated ...]';
        }

        const header = `<!-- Ingested from: ${relFromRoot} -->\n<!-- Mtime: ${new Date(stat.mtimeMs).toISOString()} -->\n\n`;
        writeFileSync(destPath, header + content, 'utf-8');
        copied++;

        if (options.verbose) {
          console.log(pc.dim(`  ${relFromRoot} → ${rule.to}${flatName}`));
        }
      } catch (err: any) {
        skipped++;
        if (options.verbose) console.log(pc.red(`  error: ${src}: ${err.message}`));
      }
    }
  }

  console.log(pc.green(`✓ Ingested ${copied} files`) + pc.dim(` (${skipped} skipped)`));
  return { copied, skipped };
}
