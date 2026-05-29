import pc from 'picocolors';
import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { openLedger, openReviewQueue } from '../lib/stores.js';

interface ReviewOptions {
  accept?: string;
  reject?: string;
  acceptAll?: boolean;
}

/**
 * The Review Queue gate (CONTEXT.md): the only path from an agent-proposed fact
 * to the Trusted Store. List pending proposals, or accept/reject by id.
 */
export async function reviewCommand(options: ReviewOptions): Promise<void> {
  const root = findProjectRoot();
  loadConfig(root);
  const bwDir = brandwikiDir(root);
  const ledger = openLedger(bwDir);
  const queue = openReviewQueue(bwDir, ledger);

  if (options.accept) {
    const fact = queue.accept(options.accept);
    console.log(pc.green(`✓ Accepted ${options.accept} → ledger (${fact.id}): [${fact.subject}] ${fact.body}`));
    return;
  }
  if (options.reject) {
    queue.reject(options.reject);
    console.log(pc.yellow(`✗ Rejected ${options.reject} (discarded).`));
    return;
  }
  if (options.acceptAll) {
    const ids = queue.list().map((p) => p.id);
    for (const id of ids) queue.accept(id);
    console.log(pc.green(`✓ Accepted ${ids.length} proposal(s) into the ledger.`));
    return;
  }

  const proposals = queue.list();
  if (proposals.length === 0) {
    console.log(pc.green('Review queue is empty.'));
    return;
  }
  console.log(pc.cyan(`${proposals.length} pending proposal(s):\n`));
  for (const p of proposals) {
    const f = p.fact;
    console.log(`  ${pc.bold(p.id)}  [${f.kind}] ${pc.bold(f.subject)}`);
    console.log(`    ${f.body}`);
    console.log(pc.dim(`    source: ${f.source} · ${f.createdAt}`));
  }
  console.log(pc.dim('\nAccept: brandwiki review --accept <id>   Reject: brandwiki review --reject <id>   All: --accept-all'));
}
