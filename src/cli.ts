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
  .command('mcp')
  .description('Run as an MCP server over stdio (for Claude Code / OpenClaw integration)')
  .option('-r, --root <path>', 'Project root (directory containing .brandwiki/). Defaults to BRANDWIKI_ROOT env or cwd walk.')
  .action(async (opts) => { await mcpCommand(opts); });

program.parseAsync(process.argv).catch((err) => {
  console.error(pc.red('Error:'), err.message);
  process.exit(1);
});
