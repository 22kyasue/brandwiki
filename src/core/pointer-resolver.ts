import { readFileSync, existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { Fact } from './fact.js';

/** Reads a pointer target and returns its live content, or null if it's gone. */
export type SourceReader = (target: string) => string | null;

export interface ResolvedPointer {
  /** The location the Pointer Fact points at (its `body`). */
  target: string;
  found: boolean;
  /** The live content at the target right now, or null if missing. */
  value: string | null;
}

/**
 * Resolve a Pointer Fact to its live value on demand (PRD edge module).
 *
 * A Pointer Fact deliberately stores *where* volatile truth lives, never a
 * copy — so the current value is fetched from the live source at pull time,
 * not baked into the Digest. The reader is injected so this stays testable
 * without a real filesystem. Throws on a non-pointer fact: copied facts carry
 * their own value and have nothing to point at.
 */
export function resolvePointer(fact: Fact, read: SourceReader): ResolvedPointer {
  if (fact.kind !== 'pointer') {
    throw new Error(`resolvePointer requires a pointer fact; got kind="${fact.kind}" (${fact.id})`);
  }
  const value = read(fact.body);
  return { target: fact.body, found: value !== null, value };
}

/** Default reader: read a file relative to `projectRoot` (or an absolute path). */
export function fileSourceReader(projectRoot: string): SourceReader {
  return (target: string): string | null => {
    const full = isAbsolute(target) ? target : join(projectRoot, target);
    return existsSync(full) ? readFileSync(full, 'utf-8') : null;
  };
}
