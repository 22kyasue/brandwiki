import type { NewFact, FactKind } from './fact.js';
import type { LLMFn } from './llm.js';

/** A shipped artifact to mine for facts: a commit, an ADR, a decision doc. */
export interface Artifact {
  /** Stable reference used as the fact's `source` (e.g. `commit:abc`, `adr:0003`). */
  ref: string;
  content: string;
  /** Content hash of the artifact — becomes the fact's `sourceHash`. */
  sourceHash: string;
}

export interface CaptureContext {
  project: string;
  /** Date stamped on proposed facts (typically the commit date). */
  createdAt: string;
}

/** A fact proposed by the LLM, before attribution. */
interface ProposedFact {
  subject: string;
  body: string;
  kind: FactKind;
}

/**
 * ArtifactCapture (PRD edge module): on commit, read changed/added artifacts
 * and propose Facts via the LLM. Output is always *proposed* — the caller
 * routes it to the Review Queue, never straight to the ledger, so a misheard
 * fact can never silently enter the Trusted Store. One LLM call per artifact so
 * each fact's source and hash are unambiguous.
 */
export async function captureFacts(artifacts: Artifact[], ctx: CaptureContext, llm: LLMFn): Promise<NewFact[]> {
  const facts: NewFact[] = [];
  for (const artifact of artifacts) {
    const { system, user } = buildCapturePrompt(artifact, ctx);
    const response = await llm({ system, user });
    for (const proposed of parseProposedFacts(response)) {
      facts.push({
        project: ctx.project,
        subject: proposed.subject,
        body: proposed.body,
        kind: proposed.kind,
        source: artifact.ref,
        sourceHash: artifact.sourceHash,
        createdAt: ctx.createdAt,
      });
    }
  }
  return facts;
}

export function buildCapturePrompt(artifact: Artifact, ctx: CaptureContext): { system: string; user: string } {
  const system = `You extract durable facts about the project "${ctx.project}" from a shipped artifact.

Return ONLY a JSON array of facts. Each fact is an object:
  { "subject": "<short stable topic key, kebab-case>", "body": "<the claim>", "kind": "copied" | "pointer" }

Rules:
- Each fact must be ATOMIC — a single claim. Split compound statements.
- "copied" = a durable value/decision/reasoning safe to store verbatim (the "why").
- "pointer" = a VOLATILE value (price, port, config, API shape). Do NOT copy the
  value; set body to WHERE the live truth lives (e.g. "config/pricing.ts").
- Only extract claims the artifact actually supports. Do not infer or invent.
- If the artifact contains no durable facts, return [].
- Output nothing but the JSON array.`;

  const user = `ARTIFACT (${artifact.ref}):\n\n${artifact.content}`;
  return { system, user };
}

/** Extract the JSON array of proposed facts from an LLM response. Tolerant of
 *  surrounding prose; drops entries lacking a subject or body. */
export function parseProposedFacts(response: string): ProposedFact[] {
  const start = response.indexOf('[');
  const end = response.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const facts: ProposedFact[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const { subject, body, kind } = item as Record<string, unknown>;
    if (typeof subject !== 'string' || !subject || typeof body !== 'string' || !body) continue;
    facts.push({
      subject,
      body,
      kind: kind === 'pointer' ? 'pointer' : 'copied',
    });
  }
  return facts;
}
