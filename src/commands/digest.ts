import { findProjectRoot, loadConfig, brandwikiDir } from '../lib/config.js';
import { openLedger, projectKey } from '../lib/stores.js';
import { buildDigest } from '../core/digest.js';

/**
 * Print the per-session Digest (ADR 0002) to stdout: the compact, dated,
 * "do not edit" brief composed from the ledger's resolved facts. The same
 * artifact the MCP `get_digest` tool returns — exposed on the CLI so it can be
 * piped into a session brief without an MCP connection.
 */
export async function digestCommand(): Promise<void> {
  const root = findProjectRoot();
  const config = loadConfig(root);
  const bwDir = brandwikiDir(root);
  const facts = openLedger(bwDir).all(projectKey(config));
  process.stdout.write(
    buildDigest(config.projectName, { facts, memoryRules: [], windowDays: config.conflictWindowDays }),
  );
}
