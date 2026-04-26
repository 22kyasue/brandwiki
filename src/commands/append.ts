import { mkdirSync, existsSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { findProjectRoot, brandwikiDir } from '../lib/config.js';

interface AppendOptions {
  from?: string;
  type?: string;
  category?: string;
  stdin?: boolean;
}

/**
 * Write-only inbox.
 *
 * Designed so an external agent (e.g. a Claude Code session ending,
 * a shell hook, an iOS Shortcut, the Hadi private wrapper) can append
 * notes into the wiki's raw/ tree WITHOUT being granted read access to
 * the existing content. The downstream `compile` step folds these into
 * the structured wiki on the next run.
 *
 * The file path is deterministic by date + source so multiple appends
 * on the same day from the same source aggregate into a single file.
 *
 *   raw/inbox/<YYYY-MM-DD>-<from>.md
 *
 * If --category is supplied, the entry is prefixed with a hint comment
 * the LLM compiler honors when deciding placement.
 */
export async function appendCommand(text: string | undefined, options: AppendOptions): Promise<void> {
  let body = text ?? '';

  if (options.stdin || !body) {
    body = await readStdin();
  }

  body = body.trim();
  if (!body) {
    console.error(pc.red('No text to append. Pass as argument, via --stdin, or pipe.'));
    process.exit(1);
  }

  const root = findProjectRoot();
  const bwDir = brandwikiDir(root);
  const inboxDir = join(bwDir, 'raw', 'inbox');
  mkdirSync(inboxDir, { recursive: true });

  const from = (options.from ?? 'manual').replace(/[^a-z0-9-_]/gi, '-').slice(0, 40) || 'manual';
  const date = new Date().toISOString().slice(0, 10);
  const file = join(inboxDir, `${date}-${from}.md`);
  const isNew = !existsSync(file);

  const ts = new Date().toISOString();
  const typeTag = options.type ? ` type:${options.type}` : '';
  const catHint = options.category ? ` category:${options.category}` : '';
  const header = isNew
    ? `# Inbox · ${date} · from:${from}\n\n<!-- Auto-collected entries. Each block is one append. -->\n`
    : '';
  const block = `\n---\n\n<!-- ${ts}${typeTag}${catHint} -->\n${body}\n`;

  if (isNew) {
    writeFileSync(file, header + block, 'utf-8');
  } else {
    appendFileSync(file, block, 'utf-8');
  }

  console.log(pc.green('✓ appended') + pc.dim(` → ${date}-${from}.md (${body.length} chars)`));
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks: Buffer[] = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}
