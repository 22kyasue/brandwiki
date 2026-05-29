import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import fg from 'fast-glob';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { findProjectRoot, loadConfig, brandwikiDir, type BrandwikiConfig } from '../lib/config.js';
import { openLedger, openReviewQueue, projectKey } from '../lib/stores.js';
import { resolve } from '../core/resolver.js';
import { buildDigest } from '../core/digest.js';
import { renderCommand } from './render.js';
import type { Fact, FactKind } from '../core/fact.js';
import { todayISO } from '../core/date.js';

interface McpOptions {
  root?: string;
}

/**
 * brandwiki as an MCP server over stdio. Re-pointed at the Fact Ledger: agents
 * read the resolved Digest/facts and the Renders, and can *propose* facts — but
 * proposals land in the Review Queue, never the Trusted Store, so an agent can
 * never silently write a fact a human hasn't accepted.
 */
export async function mcpCommand(options: McpOptions): Promise<void> {
  if (options.root) process.env.BRANDWIKI_ROOT = options.root;

  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);
  const wikiDir = join(bwDir, 'wiki');

  const server = new Server({ name: 'brandwiki', version: '0.2.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'get_digest',
        description: `Get the compact per-session Digest for "${config.projectName}": resolved durable decisions, pointer facts (where live truth lives), inline freshness dates, and unresolved conflicts. Start here — it is the honest, dated brief for this project.`,
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'query_facts',
        description: 'List the current resolved Facts from the ledger (latest-by-date; superseded facts excluded). Optionally filter by subject. Deterministic, no LLM.',
        inputSchema: {
          type: 'object',
          properties: { subject: { type: 'string', description: 'Filter to this subject/topic key' } },
        },
      },
      {
        name: 'propose_fact',
        description: 'Propose a Fact for this project. It goes to the Review Queue (quarantined) and is NOT trusted until a human accepts it with `brandwiki review`. Use for durable facts/decisions worth persisting. Set kind="pointer" for volatile values (price/port/config) and put the live source location in body instead of the value.',
        inputSchema: {
          type: 'object',
          properties: {
            subject: { type: 'string', description: 'Short stable topic key (kebab-case)' },
            body: { type: 'string', description: 'The claim, or for a pointer fact the location where live truth lives' },
            kind: { type: 'string', enum: ['copied', 'pointer'], description: 'copied = durable value; pointer = location of a volatile value' },
          },
          required: ['subject', 'body'],
        },
      },
      {
        name: 'list_proposals',
        description: 'List facts currently waiting in the Review Queue (proposed, not yet accepted into the Trusted Store).',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'search',
        description: 'Fast literal substring search across the rendered wiki articles. Returns matching lines with paths.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Substring to search for (case-insensitive)' },
            limit: { type: 'number', description: 'Max results (default 50)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_article',
        description: 'Read the full markdown of a rendered wiki article by its path relative to wiki/ (e.g. "01-overview/intro.md").',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Path relative to wiki/' } },
          required: ['path'],
        },
      },
      {
        name: 'list_articles',
        description: 'List rendered wiki articles grouped by category (paths only).',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'render',
        description: 'Re-render the wiki pages from the Fact Ledger (LLM-backed, slow). Reads facts and writes Renders; never modifies the ledger.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'status',
        description: 'Project health: fact count, current vs unresolved conflicts, pending proposals, rendered article count.',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      switch (name) {
        case 'get_digest':
          return textResult(toolDigest(config, bwDir));
        case 'query_facts':
          return textResult(toolQueryFacts(config, bwDir, args.subject ? String(args.subject) : undefined));
        case 'propose_fact':
          return textResult(toolProposeFact(config, bwDir, args));
        case 'list_proposals':
          return textResult(toolListProposals(bwDir));
        case 'search':
          return textResult(await toolSearch(String(args.query ?? ''), Number(args.limit ?? 50), wikiDir));
        case 'get_article':
          return textResult(toolGetArticle(String(args.path ?? ''), wikiDir));
        case 'list_articles':
          return textResult(await toolListArticles(wikiDir, config));
        case 'render':
          await renderCommand({});
          return textResult('Render complete.');
        case 'status':
          return textResult(toolStatus(config, bwDir, wikiDir));
        default:
          return errorResult(`Unknown tool: ${name}`);
      }
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`brandwiki mcp ready (root=${root})\n`);
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}
function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

function loadFacts(config: BrandwikiConfig, bwDir: string): Fact[] {
  return openLedger(bwDir).all(projectKey(config));
}

function toolDigest(config: BrandwikiConfig, bwDir: string): string {
  return buildDigest(config.projectName, {
    facts: loadFacts(config, bwDir),
    memoryRules: [],
    windowDays: config.conflictWindowDays,
  });
}

function toolQueryFacts(config: BrandwikiConfig, bwDir: string, subject?: string): string {
  const { current, unresolvedConflicts } = resolve(loadFacts(config, bwDir), { windowDays: config.conflictWindowDays });
  const facts = subject ? current.filter((f) => f.subject === subject) : current;
  if (facts.length === 0 && unresolvedConflicts.length === 0) return 'No facts.';
  const lines = facts.map((f) => `- [${f.subject}] ${f.kind === 'pointer' ? `(pointer → ${f.body})` : f.body}  (${f.source} · ${f.createdAt})`);
  if (!subject && unresolvedConflicts.length > 0) {
    lines.push('', 'UNRESOLVED CONFLICTS:');
    for (const c of unresolvedConflicts) {
      lines.push(`- ${c.subject}:`);
      for (const f of c.facts) lines.push(`    - ${f.body} (${f.source} · ${f.createdAt})`);
    }
  }
  return lines.join('\n');
}

function toolProposeFact(config: BrandwikiConfig, bwDir: string, args: Record<string, unknown>): string {
  const subject = String(args.subject ?? '').trim();
  const body = String(args.body ?? '').trim();
  if (!subject || !body) throw new Error('subject and body are required');
  const kind: FactKind = args.kind === 'pointer' ? 'pointer' : 'copied';
  const ledger = openLedger(bwDir);
  const queue = openReviewQueue(bwDir, ledger);
  const id = queue.propose({
    project: projectKey(config),
    subject,
    body,
    kind,
    source: 'agent:mcp',
    sourceHash: '',
    createdAt: todayISO(),
  });
  return `Proposed ${id} → review queue (quarantined). Not trusted until accepted via \`brandwiki review --accept ${id}\`.`;
}

function toolListProposals(bwDir: string): string {
  const ledger = openLedger(bwDir);
  const proposals = openReviewQueue(bwDir, ledger).list();
  if (proposals.length === 0) return 'Review queue is empty.';
  return proposals.map((p) => `${p.id}  [${p.fact.kind}] ${p.fact.subject}: ${p.fact.body}  (${p.fact.source} · ${p.fact.createdAt})`).join('\n');
}

async function toolSearch(query: string, limit: number, wikiDir: string): Promise<string> {
  if (!query) throw new Error('query is required');
  if (!existsSync(wikiDir)) return 'No rendered wiki yet. Run render first.';
  const files = await fg('**/*.md', { cwd: wikiDir, absolute: true });
  const needle = query.toLowerCase();
  const hits: string[] = [];
  for (const file of files) {
    const rel = relative(wikiDir, file).replaceAll('\\', '/');
    readFileSync(file, 'utf-8').split('\n').forEach((line, idx) => {
      if (line.toLowerCase().includes(needle)) hits.push(`${rel}:${idx + 1}: ${line.trim()}`);
    });
  }
  if (hits.length === 0) return `No matches for "${query}"`;
  const tail = hits.length > limit ? `\n... and ${hits.length - limit} more` : '';
  return `${hits.length} matches:\n${hits.slice(0, limit).join('\n')}${tail}`;
}

function toolGetArticle(path: string, wikiDir: string): string {
  if (!path) throw new Error('path is required');
  const safe = path.replaceAll('\\', '/');
  if (safe.includes('..')) throw new Error('path must not contain ".."');
  const full = join(wikiDir, safe);
  if (!existsSync(full)) throw new Error(`Article not found: ${safe}`);
  return readFileSync(full, 'utf-8');
}

async function toolListArticles(wikiDir: string, config: BrandwikiConfig): Promise<string> {
  if (!existsSync(wikiDir)) return 'No rendered wiki yet. Run render first.';
  const files = await fg('**/*.md', { cwd: wikiDir });
  if (files.length === 0) return 'No articles rendered yet.';
  const byCat: Record<string, string[]> = {};
  for (const f of files) {
    const norm = f.replaceAll('\\', '/');
    (byCat[norm.split('/')[0]] ??= []).push(norm);
  }
  const lines: string[] = [];
  for (const cat of Object.keys(byCat).sort()) {
    lines.push(`## ${config.categories.find((c) => c.id === cat)?.title ?? cat}`);
    for (const p of byCat[cat].sort()) lines.push(`- ${p}`);
  }
  return lines.join('\n');
}

function toolStatus(config: BrandwikiConfig, bwDir: string, wikiDir: string): string {
  const facts = loadFacts(config, bwDir);
  const { current, unresolvedConflicts } = resolve(facts, { windowDays: config.conflictWindowDays });
  const ledger = openLedger(bwDir);
  const proposals = openReviewQueue(bwDir, ledger).list();
  const renders = existsSync(wikiDir) ? fg.sync('**/*.md', { cwd: wikiDir }).length : 0;
  return [
    `Project: ${config.projectName}`,
    `Facts (ledger): ${facts.length}`,
    `Current (resolved): ${current.length}`,
    `Unresolved conflicts: ${unresolvedConflicts.length}`,
    `Pending proposals: ${proposals.length}`,
    `Rendered articles: ${renders}`,
  ].join('\n');
}
