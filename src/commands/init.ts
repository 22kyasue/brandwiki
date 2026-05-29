import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';

interface InitOptions {
  template: string;
  language: 'ja' | 'en';
  name?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const bwDir = join(cwd, '.brandwiki');

  if (existsSync(bwDir)) {
    console.log(pc.yellow('.brandwiki/ already exists. Aborting to avoid overwrite.'));
    process.exit(1);
  }

  const projectName = options.name ?? basename(cwd);
  const template = options.template;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const engineRoot = resolve(__dirname, '..', '..');
  const templateDir = join(engineRoot, 'templates', template);

  if (!existsSync(templateDir)) {
    console.log(pc.red(`Template "${template}" not found at ${templateDir}`));
    console.log(pc.dim(`Available templates: ${readdirSync(join(engineRoot, 'templates')).join(', ')}`));
    process.exit(1);
  }

  console.log(pc.cyan(`Initializing brandwiki for "${projectName}" (template: ${template}, lang: ${options.language})`));

  for (const sub of ['raw', 'wiki', 'outputs', '_index']) {
    mkdirSync(join(bwDir, sub), { recursive: true });
  }
  mkdirSync(join(bwDir, 'raw', 'notes'), { recursive: true });
  mkdirSync(join(bwDir, 'raw', 'decisions'), { recursive: true });
  mkdirSync(join(bwDir, 'raw', 'references'), { recursive: true });
  mkdirSync(join(bwDir, 'raw', 'meetings'), { recursive: true });
  mkdirSync(join(bwDir, 'raw', 'code-snapshots'), { recursive: true });

  const templateConfigPath = join(templateDir, 'config.json');
  const templateConfig = existsSync(templateConfigPath)
    ? JSON.parse(readFileSync(templateConfigPath, 'utf-8'))
    : { categories: [] };

  const config = {
    projectName,
    language: options.language,
    template,
    provider: 'claude-cli',
    conflictWindowDays: 14,
    categories: templateConfig.categories ?? [],
    model: {
      compile: 'claude-sonnet-4-6',
      lint: 'claude-haiku-4-5-20251001',
      query: 'claude-sonnet-4-6',
    },
    sources: [
      { path: 'raw/notes', type: 'markdown', glob: '**/*.md' },
      { path: 'raw/decisions', type: 'markdown', glob: '**/*.md' },
      { path: 'raw/references', type: 'markdown', glob: '**/*.md' },
      { path: 'raw/meetings', type: 'markdown', glob: '**/*.md' },
      { path: 'raw/code-snapshots', type: 'text', glob: '**/*' },
    ],
  };

  writeFileSync(join(bwDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');

  for (const cat of config.categories) {
    mkdirSync(join(bwDir, 'wiki', cat.id), { recursive: true });
  }

  const readmeContent = `# ${projectName} Brand Wiki

Context library backed by an **append-only Fact Ledger**. The truth lives in \`ledger.jsonl\`; \`wiki/\` pages are generated **Renders** — **never edit them**, and never treat them as authoritative. To fix a fact, append a corrected one; don't rewrite a page.

## Structure
- \`ledger.jsonl\` — append-only Fact Ledger (the source of truth)
- \`review-queue.json\` — proposed facts awaiting human accept/reject
- \`wiki/\` — generated Markdown Renders (disposable, regenerable)
- \`config.json\` — project config

## Usage
\`\`\`bash
brandwiki capture            # Mine the latest commit + decision docs → review queue
brandwiki review             # Accept/reject proposed facts (the human gate)
brandwiki render             # Generate wiki/ pages from the ledger
brandwiki install-hook       # Auto-capture on every commit
brandwiki status             # Health check
\`\`\`

## Language
All Renders are written in **${options.language === 'ja' ? 'Japanese (日本語)' : 'English'}**.
`;
  writeFileSync(join(bwDir, 'README.md'), readmeContent, 'utf-8');

  const manifestInit = { version: 1, lastCompile: null, rawFiles: {}, articles: {} };
  writeFileSync(join(bwDir, 'manifest.json'), JSON.stringify(manifestInit, null, 2), 'utf-8');

  console.log(pc.green('✓ Created .brandwiki/'));
  console.log(pc.dim(`  ${config.categories.length} categories initialized`));
  console.log();
  console.log('Next steps:');
  console.log('  1. Run `brandwiki capture` to mine the latest commit + docs into proposed facts');
  console.log('  2. Run `brandwiki review` to accept them into the ledger');
  console.log('  3. Run `brandwiki render` to generate wiki/ pages');
}
