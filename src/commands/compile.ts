import pc from 'picocolors';

interface CompileOptions {
  force?: boolean;
  dryRun?: boolean;
}

/**
 * DEPRECATED & DISABLED. The old `compile` read raw/, asked the LLM to invent
 * 8–15 articles, and OVERWROTE wiki/ every run (plus a speculative brandbook
 * SWOT pass) — the exact fact-losing behavior brandwiki now exists to prevent
 * (ADR 0001). It has been replaced by the append-only Fact Ledger pipeline.
 *
 * This shim does nothing destructive; it only points at the new flow. The
 * signature is kept so existing callers (watch auto-compile, research
 * --compile) degrade to a no-op message instead of breaking.
 */
export async function compileCommand(_options: CompileOptions = {}): Promise<void> {
  console.log(pc.yellow('`brandwiki compile` is deprecated and disabled (it overwrote facts).'));
  console.log(pc.dim('Use the Fact Ledger pipeline instead:'));
  console.log(pc.dim('  brandwiki capture   — mine commits/decision docs into proposed facts'));
  console.log(pc.dim('  brandwiki review    — accept proposed facts into the ledger'));
  console.log(pc.dim('  brandwiki render    — generate wiki/ pages from the ledger'));
}
