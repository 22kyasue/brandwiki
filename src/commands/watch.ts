import { join } from 'node:path';
import pc from 'picocolors';
import chokidar from 'chokidar';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { ingestCommand } from './ingest.js';
import { compileCommand } from './compile.js';
import { startServer, broadcastReload } from './serve.js';

interface WatchOptions {
  port?: string;
  autoCompile?: boolean;
  debounce?: string;
  noServe?: boolean;
}

export async function watchCommand(options: WatchOptions): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);
  const port = parseInt(options.port ?? '8787', 10);
  const debounceMs = parseInt(options.debounce ?? String(config.watch?.debounceMs ?? 20000), 10);
  const autoCompile = options.autoCompile ?? config.watch?.autoCompile ?? false;

  console.log(pc.cyan(`Starting watch mode`));
  console.log(pc.dim(`  project: ${root}`));
  console.log(pc.dim(`  debounce: ${debounceMs}ms`));
  console.log(pc.dim(`  auto-compile: ${autoCompile ? pc.green('ON') : pc.yellow('OFF (run `brandwiki compile` manually)')}`));

  if (!options.noServe) {
    await startServer({ port: String(port) });
    console.log(pc.green(`  → http://localhost:${port}`));
  }

  await ingestCommand({ verbose: false });
  broadcastReload();

  const watchPatterns = (config.ingestPaths ?? []).map((r) => r.from);
  const rawDir = join(bwDir, 'raw');
  const wikiDir = join(bwDir, 'wiki');

  if (watchPatterns.length === 0) {
    console.log(pc.yellow('\nNo ingestPaths to watch. Watch mode will only react to wiki/ changes.'));
  }

  const watcher = chokidar.watch(watchPatterns, {
    cwd: root,
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      `.brandwiki/**`,
    ],
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
  });

  const wikiWatcher = chokidar.watch(wikiDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });
  wikiWatcher.on('change', () => broadcastReload());
  wikiWatcher.on('add', () => broadcastReload());

  let pending = false;
  let debounceTimer: NodeJS.Timeout | null = null;
  let isCompiling = false;

  function scheduleUpdate(eventPath: string) {
    pending = true;
    console.log(pc.dim(`  changed: ${eventPath}`));
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runUpdate, debounceMs);
  }

  async function runUpdate() {
    if (!pending || isCompiling) return;
    pending = false;
    isCompiling = true;
    console.log(pc.cyan(`\n[${new Date().toISOString().slice(11, 19)}] Running ingest...`));
    try {
      await ingestCommand({ verbose: false });
      broadcastReload();

      if (autoCompile) {
        console.log(pc.cyan(`[${new Date().toISOString().slice(11, 19)}] Running compile...`));
        await compileCommand({});
        broadcastReload();
      } else {
        console.log(pc.dim('  (auto-compile disabled — run `brandwiki compile` to update articles)'));
      }
    } catch (err: any) {
      console.log(pc.red(`  update failed: ${err.message}`));
    } finally {
      isCompiling = false;
    }
  }

  watcher.on('add', (p) => scheduleUpdate(p));
  watcher.on('change', (p) => scheduleUpdate(p));
  watcher.on('unlink', (p) => scheduleUpdate(p));

  console.log(pc.green(`\n✓ Watching ${watchPatterns.length} patterns. Press Ctrl+C to stop.\n`));

  process.on('SIGINT', () => {
    console.log(pc.yellow('\nStopping watch...'));
    watcher.close();
    wikiWatcher.close();
    process.exit(0);
  });
}
