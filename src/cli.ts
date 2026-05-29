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
import { researchCommand } from './commands/research.js';
import { mcpCommand } from './commands/mcp.js';
import { renderCommand } from './commands/render.js';
import { captureCommand } from './commands/capture.js';
import { reviewCommand } from './commands/review.js';
import { installHookCommand } from './commands/install-hook.js';

const program = new Command();

program
  .name('brandwiki')
  .description('LLM-powered brand wiki compiler')
  .version('0.2.0');

program
  .command('init')
  .description('Initialize .brandwiki/ in the current directory')
  .option('-t, --template <name>', 'Template to use (generic, medical-app)', 'generic')
  .option('-l, --language <lang>', 'Wiki language (ja, en)', 'ja')
  .option('-n, --name <name>', 'Project name')
  .action(initCommand);

program
  .command('compile')
  .description('[DEPRECATED] Replaced by capture → review → render (Fact Ledger pipeline)')
  .option('-f, --force', '(no-op)')
  .option('--dry-run', '(no-op)')
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
  .command('research')
  .description('Autonomous competitor research: writes dated briefs to raw/competitors/')
  .option('-c, --competitor <name>', 'Research only this competitor (by name)')
  .option('-s, --since <date>', 'Prioritize news since this date (YYYY-MM-DD)')
  .option('--compile', 'Run `brandwiki compile` automatically after research')
  .option('--dry-run', 'List competitors that would be researched, no LLM calls')
  .option('-f, --force', 'Overwrite today\'s report if it already exists')
  .option('-v, --verbose', 'Show skipped items')
  .action(researchCommand);

program
  .command('render')
  .description('Render the Fact Ledger into wiki/ pages (replaces the destructive compile)')
  .option('--dry-run', 'Show what would be rendered without calling the LLM')
  .action(async (opts) => { await renderCommand(opts); });

program
  .command('capture')
  .description('Mine a commit (message + changed decision docs) for facts → review queue')
  .option('-c, --commit <ref>', 'Commit to capture from (default HEAD)')
  .option('--dry-run', 'List artifacts that would be mined; no LLM call')
  .action(async (opts) => { await captureCommand(opts); });

program
  .command('review')
  .description('List, accept, or reject agent-proposed facts in the review queue')
  .option('-a, --accept <id>', 'Accept a proposal into the ledger')
  .option('-r, --reject <id>', 'Reject (discard) a proposal')
  .option('--accept-all', 'Accept every pending proposal')
  .action(async (opts) => { await reviewCommand(opts); });

program
  .command('install-hook')
  .description('Install a git post-commit hook that runs capture on every commit')
  .option('--render', 'Also re-render the wiki after capture')
  .action(async (opts) => { await installHookCommand(opts); });

program
  .command('mcp')
  .description('Run as an MCP server over stdio (for Claude Code / OpenClaw integration)')
  .option('-r, --root <path>', 'Project root (directory containing .brandwiki/). Defaults to BRANDWIKI_ROOT env or cwd walk.')
  .action(async (opts) => { await mcpCommand(opts); });

program.parseAsync(process.argv).catch((err) => {
  console.error(pc.red('Error:'), err.message);
  process.exit(1);
});
