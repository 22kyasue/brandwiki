import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fg from 'fast-glob';
import pc from 'picocolors';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { openLedger, openReviewQueue, projectKey } from '../lib/stores.js';
import { resolve } from '../core/resolver.js';

export async function statusCommand(): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);

  const ledger = openLedger(bwDir);
  const facts = ledger.all(projectKey(config));
  const { current, unresolvedConflicts } = resolve(facts, { windowDays: config.conflictWindowDays });
  const proposals = openReviewQueue(bwDir, ledger).list();
  const wikiDir = join(bwDir, 'wiki');
  const renders = existsSync(wikiDir) ? (await fg('**/*.md', { cwd: wikiDir })).length : 0;

  console.log(pc.cyan(`${config.projectName} — brandwiki`));
  console.log(pc.dim('─'.repeat(40)));
  console.log(`  Language:             ${config.language}`);
  console.log(`  Categories:           ${config.categories.length}`);
  console.log(`  Facts (ledger):       ${facts.length}`);
  console.log(`  Current (resolved):   ${current.length}`);
  console.log(`  Unresolved conflicts: ${unresolvedConflicts.length > 0 ? pc.yellow(String(unresolvedConflicts.length)) : '0'}`);
  console.log(`  Pending proposals:    ${proposals.length > 0 ? pc.yellow(String(proposals.length)) : '0'}`);
  console.log(`  Rendered articles:    ${renders}`);
}
