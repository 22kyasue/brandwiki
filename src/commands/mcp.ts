import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import fg from 'fast-glob';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { loadManifest } from '../lib/manifest.js';
import { callLLM } from '../lib/anthropic.js';

interface McpOptions {
  root?: string;
}

export async function mcpCommand(options: McpOptions): Promise<void> {
  if (options.root) {
    process.env.BRANDWIKI_ROOT = options.root;
  }

  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);
  const wikiDir = join(bwDir, 'wiki');
  const rawDir = join(bwDir, 'raw');

  const server = new Server(
    { name: 'brandwiki', version: '0.2.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'query',
        description: `Ask a natural-language question against the "${config.projectName}" wiki. Uses LLM to synthesize an answer from wiki articles. Best for "what do we know about X?" or "how does Y work?" questions.`,
        inputSchema: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'The question to ask' },
          },
          required: ['question'],
        },
      },
      {
        name: 'search',
        description: 'Fast literal substring search across all wiki articles. Returns matching lines with file paths. Use for keyword lookups when you do not need synthesis.',
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
        description: 'Read the full markdown content of a wiki article by its relative path (e.g. "01-overview/intro.md").',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Article path relative to wiki/ (e.g. "01-overview/intro.md")' },
          },
          required: ['path'],
        },
      },
      {
        name: 'list_articles',
        description: 'List all wiki articles grouped by category. Returns paths and titles, no body content.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'add_raw',
        description: 'Drop a new raw note into raw/notes/ (or specified subdir). Will be picked up on the next compile. Use to capture facts/decisions/context worth persisting across sessions.',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Filename (e.g. "2026-05-11-openclaw-integration.md"). .md will be added if missing.' },
            content: { type: 'string', description: 'Markdown content of the note' },
            subdir: { type: 'string', description: 'Subdir under raw/ (default "notes"). Options: notes, decisions, references, meetings, code-snapshots' },
          },
          required: ['filename', 'content'],
        },
      },
      {
        name: 'compile',
        description: 'Re-compile raw/ into wiki/ articles using the LLM. Slow (calls Claude). Run after adding raw material to update the wiki.',
        inputSchema: {
          type: 'object',
          properties: {
            force: { type: 'boolean', description: 'Recompile even unchanged sources' },
          },
        },
      },
      {
        name: 'status',
        description: 'Show wiki health stats: project name, article count, raw file count, total words, last compile timestamp.',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case 'query':
          return textResult(await toolQuery(String(args.question ?? ''), config, wikiDir));
        case 'search':
          return textResult(await toolSearch(String(args.query ?? ''), Number(args.limit ?? 50), wikiDir));
        case 'get_article':
          return textResult(toolGetArticle(String(args.path ?? ''), wikiDir));
        case 'list_articles':
          return textResult(await toolListArticles(wikiDir, config));
        case 'add_raw':
          return textResult(toolAddRaw(String(args.filename ?? ''), String(args.content ?? ''), String(args.subdir ?? 'notes'), rawDir));
        case 'compile':
          return textResult(toolCompile(Boolean(args.force), root));
        case 'status':
          return textResult(toolStatus(root, config, bwDir));
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

async function toolQuery(question: string, config: ReturnType<typeof loadConfig>, wikiDir: string): Promise<string> {
  if (!question) throw new Error('question is required');
  const files = await fg('**/*.md', { cwd: wikiDir, absolute: true });
  let context = '';
  for (const file of files) {
    const rel = relative(wikiDir, file);
    const content = readFileSync(file, 'utf-8');
    context += `\n\n### ${rel}\n\n${content}`;
    if (context.length > 180000) break;
  }
  const langLabel = config.language === 'ja' ? '日本語' : 'English';
  const system = `You are an expert on the "${config.projectName}" knowledge base. Answer questions using ONLY the wiki articles provided as context. If the wiki doesn't contain the answer, say so clearly.\n\nAnswer in ${langLabel}. Cite article paths when referencing facts. Be concise and structured.`;
  const user = `WIKI CONTEXT:\n${context}\n\n---\n\nQUESTION: ${question}`;
  return await callLLM({
    model: config.model.query,
    system,
    user,
    maxTokens: 4096,
    provider: config.provider ?? 'claude-cli',
  });
}

async function toolSearch(query: string, limit: number, wikiDir: string): Promise<string> {
  if (!query) throw new Error('query is required');
  const files = await fg('**/*.md', { cwd: wikiDir, absolute: true });
  const needle = query.toLowerCase();
  const hits: string[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf-8').split('\n');
    const rel = relative(wikiDir, file).replaceAll('\\', '/');
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(needle)) {
        hits.push(`${rel}:${idx + 1}: ${line.trim()}`);
      }
    });
  }
  if (hits.length === 0) return `No matches for "${query}"`;
  const shown = hits.slice(0, limit);
  const tail = hits.length > limit ? `\n... and ${hits.length - limit} more` : '';
  return `${hits.length} matches:\n${shown.join('\n')}${tail}`;
}

function toolGetArticle(path: string, wikiDir: string): string {
  if (!path) throw new Error('path is required');
  const safe = path.replaceAll('\\', '/');
  if (safe.includes('..')) throw new Error('path must not contain ".."');
  const full = join(wikiDir, safe);
  if (!existsSync(full)) throw new Error(`Article not found: ${safe}`);
  return readFileSync(full, 'utf-8');
}

async function toolListArticles(wikiDir: string, config: ReturnType<typeof loadConfig>): Promise<string> {
  const files = await fg('**/*.md', { cwd: wikiDir });
  if (files.length === 0) return 'No articles compiled yet. Drop raw material into raw/ and run compile.';
  const byCat: Record<string, string[]> = {};
  for (const f of files) {
    const norm = f.replaceAll('\\', '/');
    const [cat] = norm.split('/');
    (byCat[cat] ??= []).push(norm);
  }
  const lines: string[] = [];
  for (const cat of Object.keys(byCat).sort()) {
    const meta = config.categories.find((c) => c.id === cat);
    lines.push(`## ${meta?.title ?? cat}`);
    for (const p of byCat[cat].sort()) lines.push(`- ${p}`);
  }
  return lines.join('\n');
}

function toolAddRaw(filename: string, content: string, subdir: string, rawDir: string): string {
  if (!filename) throw new Error('filename is required');
  if (!content) throw new Error('content is required');
  const safeSubdir = subdir.replace(/[^a-z0-9_-]/gi, '');
  if (!safeSubdir) throw new Error('invalid subdir');
  const fname = filename.endsWith('.md') ? filename : `${filename}.md`;
  if (fname.includes('/') || fname.includes('\\') || fname.includes('..')) {
    throw new Error('filename must not contain path separators or ".."');
  }
  const targetDir = join(rawDir, safeSubdir);
  mkdirSync(targetDir, { recursive: true });
  const target = join(targetDir, fname);
  writeFileSync(target, content, 'utf-8');
  return `Wrote ${relative(dirname(rawDir), target).replaceAll('\\', '/')} (${content.length} bytes). Run compile to refresh the wiki.`;
}

function toolCompile(force: boolean, root: string): string {
  const args = ['compile'];
  if (force) args.push('--force');
  const result = spawnSync('brandwiki', args, {
    cwd: root,
    env: { ...process.env, BRANDWIKI_ROOT: root },
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });
  const out = (result.stdout ?? '') + (result.stderr ?? '');
  if (result.status !== 0) throw new Error(`compile failed (exit ${result.status}):\n${out}`);
  return out.trim() || 'compile completed';
}

function toolStatus(root: string, config: ReturnType<typeof loadConfig>, bwDir: string): string {
  const manifest = loadManifest(bwDir);
  const wikiFiles = fg.sync('**/*.md', { cwd: join(bwDir, 'wiki') });
  const rawFiles = fg.sync('**/*', { cwd: join(bwDir, 'raw'), onlyFiles: true });
  let totalWords = 0;
  for (const f of wikiFiles) {
    totalWords += readFileSync(join(bwDir, 'wiki', f), 'utf-8').split(/\s+/).length;
  }
  return [
    `Project: ${config.projectName}`,
    `Root: ${root}`,
    `Template: ${config.template}`,
    `Language: ${config.language}`,
    `Categories: ${config.categories.length}`,
    `Raw files: ${rawFiles.length}`,
    `Articles: ${wikiFiles.length}`,
    `Total words: ${totalWords.toLocaleString()}`,
    `Last compile: ${manifest.lastCompile ?? 'never'}`,
  ].join('\n');
}
