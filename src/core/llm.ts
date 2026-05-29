/**
 * The single LLM seam for the edge modules (Renderer, ArtifactCapture).
 *
 * Edge modules depend on this narrow function type, never on the concrete
 * provider, so their deterministic logic (prompt assembly, response parsing)
 * is unit-testable with a stub and the non-deterministic call is isolated.
 */
export type LLMFn = (params: { system: string; user: string }) => Promise<string>;
