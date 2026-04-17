#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { initCommand } from './commands/init.js';
import { compileCommand } from './commands/compile.js';
import { lintCommand } from './commands/lint.js';
import { searchCommand } from './commands/search.js';
import { queryCommand } from './commands/query.js';
import { statusCommand } from './commands/status.js';
import { serveCommand } from './commands/serve.js';
import { ingestCommand } from './commands/ingest.js';
import { watchCommand } from './commands/watch.js';
import { exportContextCommand } from './commands/export-context.js';

const program = new Command();

program
  .name('brandwiki')
  .description('LLM-powered brand wiki compiler')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize .brandwiki/ in the current directory')
  .option('-t, --template <name>', 'Template to use (generic, medical-app)', 'generic')
  .option('-l, --language <lang>', 'Wiki language (ja, en)', 'ja')
  .option('-n, --name <name>', 'Project name')
  .action(initCommand);

program
  .command('compile')
  .description('Compile raw/ into wiki/ using LLM')
  .option('-f, --force', 'Recompile all articles, ignoring manifest')
  .option('--dry-run', 'Show what would be compiled without calling LLM')
  .action(compileCommand);

program
  .command('lint')
  .description('Detect contradictions and quality issues in wiki/')
  .action(lintCommand);

program
  .command('search <query>')
  .description('Full-text search over wiki/')
  .action(searchCommand);

program
  .command('query <question>')
  .description('Ask a question against the wiki')
  .action(queryCommand);

program
  .command('status')
  .description('Show wiki health: article count, word count, manifest state')
  .action(statusCommand);

program
  .command('serve')
  .description('Serve the wiki as a Wikipedia-style web UI')
  .option('-p, --port <port>', 'Port to listen on', '8787')
  .option('--no-live-reload', 'Disable SSE live reload (faster, fewer connections)')
  .action(serveCommand);

program
  .command('ingest')
  .description('Auto-copy project files into raw/ based on ingestPaths config')
  .option('-v, --verbose', 'Show each file copied')
  .action(async (opts) => { await ingestCommand(opts); });

program
  .command('watch')
  .description('Watch project files, auto-ingest, and serve with live reload')
  .option('-p, --port <port>', 'Port to listen on', '8787')
  .option('--auto-compile', 'Automatically run compile after changes (costs LLM calls)')
  .option('-d, --debounce <ms>', 'Debounce window in milliseconds', '20000')
  .option('--no-serve', 'Only watch, do not start HTTP server')
  .action(watchCommand);

program
  .command('export-context')
  .description('Export the compiled wiki as a single context bundle for external agents (e.g. octogent tentacles)')
  .option('-o, --out <path>', 'Output file (plain) or tentacle directory (octogent). Defaults to .brandwiki/outputs/context-bundle.md for plain.')
  .option('-c, --categories <ids>', 'Comma-separated category ids to include (e.g. 01-brand,03-architecture)')
  .option('-f, --format <fmt>', 'Output format: plain | octogent', 'plain')
  .option('--max-chars <n>', 'Maximum total characters to emit (articles over budget are listed as truncated)')
  .action(exportContextCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error(pc.red('Error:'), err.message);
  process.exit(1);
});
