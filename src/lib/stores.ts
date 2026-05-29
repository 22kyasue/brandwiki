import { join } from 'node:path';
import { FactLedger, JsonlLedgerStore } from '../core/ledger.js';
import { ReviewQueue, JsonQueueStore } from '../core/review-queue.js';
import { callLLM } from './anthropic.js';
import type { LLMFn } from '../core/llm.js';
import type { BrandwikiConfig } from './config.js';

/** Where the append-only ledger and the review queue live inside `.brandwiki/`. */
export function ledgerPath(bwDir: string): string {
  return join(bwDir, 'ledger.jsonl');
}
export function queuePath(bwDir: string): string {
  return join(bwDir, 'review-queue.json');
}

export function openLedger(bwDir: string): FactLedger {
  return new FactLedger(new JsonlLedgerStore(ledgerPath(bwDir)));
}

export function openReviewQueue(bwDir: string, ledger: FactLedger): ReviewQueue {
  return new ReviewQueue(new JsonQueueStore(queuePath(bwDir)), ledger);
}

/** The project key under which a repo's facts are stored. One key per repo. */
export function projectKey(config: BrandwikiConfig): string {
  return config.projectName;
}

/** Bind the shared `callLLM` helper to a concrete model/provider as an LLMFn. */
export function makeLLM(config: BrandwikiConfig, model: string, maxTokens = 16000): LLMFn {
  const provider = config.provider ?? 'claude-cli';
  return ({ system, user }) => callLLM({ model, system, user, maxTokens, provider });
}
