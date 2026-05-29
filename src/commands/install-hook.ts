import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import pc from 'picocolors';
import { findProjectRoot } from '../lib/config.js';

interface InstallHookOptions {
  render?: boolean;
}

const MARKER = '# brandwiki post-commit hook';

/**
 * GitTrigger (PRD): install a `post-commit` hook that fires capture on each
 * commit — the meaningful unit of change — rather than on every file save.
 * Capture only proposes to the Review Queue, so the hook is safe to run
 * unattended; rendering stays opt-in (`--render`).
 */
export async function installHookCommand(options: InstallHookOptions): Promise<void> {
  const root = findProjectRoot();
  const gitDir = resolveGitDir(root);
  if (!gitDir) throw new Error('Not a git repository — cannot install a post-commit hook.');

  const hooksDir = join(gitDir, 'hooks');
  mkdirSync(hooksDir, { recursive: true });
  const hookPath = join(hooksDir, 'post-commit');

  if (existsSync(hookPath) && !readContains(hookPath, MARKER)) {
    throw new Error(`A post-commit hook already exists at ${hookPath} and is not managed by brandwiki. Merge manually.`);
  }

  const renderLine = options.render ? 'brandwiki render || true\n' : '';
  const script = `#!/bin/sh
${MARKER}
# Capture facts from this commit into the review queue (safe: proposals only).
brandwiki capture || true
${renderLine}`;

  writeFileSync(hookPath, script, 'utf-8');
  try {
    chmodSync(hookPath, 0o755);
  } catch {
    /* chmod is a no-op / may fail on Windows; git for Windows runs hooks via sh regardless */
  }
  console.log(pc.green(`✓ Installed post-commit hook at ${hookPath}`));
  console.log(pc.dim(`  Fires: brandwiki capture${options.render ? ' + render' : ''} on every commit.`));
}

function resolveGitDir(root: string): string | null {
  const result = spawnSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: root, encoding: 'utf-8' });
  if (result.status !== 0) return null;
  return (result.stdout ?? '').trim() || null;
}

function readContains(path: string, needle: string): boolean {
  try {
    return readFileSync(path, 'utf-8').includes(needle);
  } catch {
    return false;
  }
}
