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

Auto-generated living knowledge base. **Do not edit \`wiki/\` manually** — it is compiled from \`raw/\` by the \`brandwiki\` CLI.

## Structure
- \`raw/\` — raw source material (notes, meetings, decisions, references)
- \`wiki/\` — compiled Markdown articles (LLM-maintained)
- \`outputs/\` — query results, slides, reports
- \`_index/\` — auto-generated indexes and backlinks
- \`config.json\` — project config
- \`manifest.json\` — incremental compile tracking

## Usage
\`\`\`bash
brandwiki compile         # Update wiki/ from raw/
brandwiki lint            # Detect contradictions
brandwiki query "..."     # Ask the wiki
brandwiki status          # Health check
\`\`\`

## Language
All articles are written in **${options.language === 'ja' ? 'Japanese (日本語)' : 'English'}**.
`;
  writeFileSync(join(bwDir, 'README.md'), readmeContent, 'utf-8');

  const manifestInit = { version: 1, lastCompile: null, rawFiles: {}, articles: {} };
  writeFileSync(join(bwDir, 'manifest.json'), JSON.stringify(manifestInit, null, 2), 'utf-8');

  console.log(pc.green('✓ Created .brandwiki/'));
  console.log(pc.dim(`  ${config.categories.length} categories initialized`));
  console.log();
  console.log('Next steps:');
  console.log('  1. Drop raw material into .brandwiki/raw/');
  console.log('  2. Run `brandwiki compile` to generate wiki articles');
}
