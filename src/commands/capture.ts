import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fg from 'fast-glob';
import pc from 'picocolors';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { openLedger, openReviewQueue, projectKey, makeLLM } from '../lib/stores.js';
import { captureFacts, type Artifact } from '../core/capture.js';
import { todayISO } from '../core/date.js';

interface CaptureOptions {
  /** Capture from this commit (default HEAD). */
  commit?: string;
  /** Seed mode: mine the repo's existing artifacts (README, CLAUDE.md, docs)
   *  instead of a single commit — used for first build-out / migration. */
  seed?: boolean;
  dryRun?: boolean;
}

const MAX_ARTIFACT_CHARS = 16000;

/**
 * ArtifactCapture wiring (PRD): on commit, mine the commit message and any
 * changed decision docs (docs/**.md, ADRs) for facts via the LLM and route them
 * to the Review Queue — never straight to the ledger. A human accepts them
 * with `brandwiki review`.
 */
export async function captureCommand(options: CaptureOptions): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);
  const commit = options.commit ?? 'HEAD';

  const artifacts = options.seed ? gatherSeedArtifacts(root) : gatherArtifacts(root, commit);
  if (artifacts.length === 0) {
    console.log(pc.yellow(options.seed ? 'No seed artifacts found (README/CLAUDE.md/docs).' : 'No artifacts to capture from this commit.'));
    return;
  }
  const createdAt = options.seed ? todayISO() : (git(root, ['show', '-s', '--format=%cs', commit]).trim() || todayISO());
  console.log(pc.cyan(options.seed
    ? `Seeding from ${artifacts.length} existing artifact(s)`
    : `Capturing from ${artifacts.length} artifact(s) at ${commit} (${createdAt})`));

  if (options.dryRun) {
    for (const a of artifacts) console.log(pc.dim(`  ${a.ref} (${a.content.length} chars)`));
    console.log(pc.dim('  --dry-run: no LLM call, nothing proposed.'));
    return;
  }

  const proposed = await captureFacts(artifacts, { project: projectKey(config), createdAt }, makeLLM(config, config.model.query ?? config.model.compile, 4096));
  if (proposed.length === 0) {
    console.log(pc.green('✓ No durable facts proposed.'));
    return;
  }

  const ledger = openLedger(bwDir);
  const queue = openReviewQueue(bwDir, ledger);
  for (const fact of proposed) queue.propose(fact);

  console.log(pc.green(`✓ Proposed ${proposed.length} fact(s) to the review queue.`));
  console.log(pc.dim('  Run `brandwiki review` to accept or reject.'));
}

/** Commit message + changed Markdown decision docs for a commit. */
function gatherArtifacts(root: string, commit: string): Artifact[] {
  const artifacts: Artifact[] = [];

  const sha = git(root, ['rev-parse', '--short', commit]).trim();
  const message = git(root, ['show', '-s', '--format=%B', commit]).trim();
  if (sha && message) {
    artifacts.push({ ref: `commit:${sha}`, content: message, sourceHash: hash(message) });
  }

  const changed = git(root, ['show', '--name-only', '--format=', commit])
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && /\.md$/i.test(l) && (l.startsWith('docs/') || /(^|\/)decisions?\//i.test(l)));

  for (const rel of changed) {
    const full = join(root, rel);
    if (!existsSync(full)) continue; // deleted in this commit
    const content = readFileSync(full, 'utf-8');
    artifacts.push({ ref: `file:${rel}`, content, sourceHash: hash(content) });
  }
  return artifacts;
}

/** Seed mode: high-signal *durable* artifacts — root README/CLAUDE.md/CONTEXT.md,
 *  ADRs, and top-level decision docs. Deliberately EXCLUDES plans/specs trees
 *  (e.g. docs/superpowers/**): those are speculative process scaffolding, the
 *  stale-prone docs brandwiki must not treat as facts. Each dated by its
 *  last-commit date. */
function gatherSeedArtifacts(root: string): Artifact[] {
  const rels = new Set<string>();
  for (const name of ['README.md', 'CLAUDE.md', 'CONTEXT.md', 'AGENTS.md']) {
    if (existsSync(join(root, name))) rels.add(name);
  }
  const patterns = ['docs/*.md', 'docs/adr/**/*.md', 'docs/adrs/**/*.md', 'docs/decisions/**/*.md'];
  for (const f of fg.sync(patterns, { cwd: root, dot: false })) {
    rels.add(f.replaceAll('\\', '/'));
  }

  const artifacts: Artifact[] = [];
  for (const rel of rels) {
    const full = join(root, rel);
    let content = readFileSync(full, 'utf-8');
    if (!content.trim()) continue;
    if (content.length > MAX_ARTIFACT_CHARS) content = content.slice(0, MAX_ARTIFACT_CHARS) + '\n\n[... truncated ...]';
    const createdAt = git(root, ['log', '-1', '--format=%cs', '--', rel]).trim() || todayISO();
    artifacts.push({ ref: `file:${rel}`, content, sourceHash: hash(content), createdAt });
  }
  return artifacts;
}

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf-8' });
  if (result.status !== 0) return '';
  return result.stdout ?? '';
}

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
