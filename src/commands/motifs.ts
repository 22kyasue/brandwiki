import pc from 'picocolors';
import { join } from 'node:path';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { scanSourceFiles } from '../lib/file-scanner.js';
import { generateMotif, classifyRoleForMotif } from '../lib/motif-generator.js';

interface MotifsOptions {
  limit?: string;
  concurrency?: string;
  force?: boolean;
}

export async function motifsCommand(options: MotifsOptions): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const theme = config.graph3d || {};
  const bwDir = brandwikiDir(root);

  console.log(pc.cyan('Scanning source files...'));
  const graph = await scanSourceFiles(root, bwDir, theme);
  console.log(pc.green('\u2713'), graph.nodes.length, 'files discovered');

  const limit = options.limit ? parseInt(options.limit, 10) : Infinity;
  const CONCURRENCY = options.concurrency ? Math.max(1, parseInt(options.concurrency, 10)) : 3;
  const targets = graph.nodes.slice(0, limit);

  console.log(pc.gray('Generating motifs — concurrency=' + CONCURRENCY + ', total=' + targets.length));
  console.log();

  let done = 0;
  let generated = 0;
  let cached = 0;
  let failed = 0;
  const startTime = Date.now();

  function render() {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(
      '\r' + pc.gray('  [' + elapsed + 's]') +
      ' ' + done + '/' + targets.length +
      ' \u00b7 ' + pc.green(generated + ' new') +
      ' \u00b7 ' + pc.cyan(cached + ' cached') +
      (failed ? ' \u00b7 ' + pc.red(failed + ' failed') : '') +
      '          '
    );
  }

  async function processOne(node: typeof targets[0]): Promise<void> {
    const cls = classifyRoleForMotif(node.id);
    try {
      const result = await generateMotif(root, {
        id: node.id,
        role: cls.role,
        roleDesc: cls.desc,
        health: node.health,
        lineCount: node.size,
        fanIn: node.importedBy.length,
        fanOut: node.imports.length,
        absolutePath: join(root, node.id),
      });
      if (result.generated) generated++;
      else cached++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write('\n' + pc.red('  \u2717') + ' ' + node.id + ' - ' + msg + '\n');
    } finally {
      done++;
      render();
    }
  }

  const queue = [...targets];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) return;
        await processOne(next);
      }
    })());
  }
  await Promise.all(workers);

  console.log('\n');
  console.log(pc.green('Done.'),
    generated, 'generated,',
    cached, 'cached,',
    failed, 'failed');
  console.log(pc.gray('Cache: .brandwiki/.motif-cache/'));
}
