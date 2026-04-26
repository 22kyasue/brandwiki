/**
 * Local LLM provider via Ollama (https://ollama.com).
 *
 * Lets the wiki run end-to-end without sending any content to a hosted API.
 * Required for the "strict" privacy mode used by the Hadi private wrapper.
 *
 * Defaults to http://127.0.0.1:11434 — the standard local Ollama daemon.
 * Override with OLLAMA_HOST env var.
 *
 * Pull a model first:  `ollama pull llama3.1:8b`  (or qwen2.5:14b, etc.)
 */
export async function callOllama(params: {
  system: string;
  user: string;
  model?: string;
  host?: string;
  timeoutMs?: number;
}): Promise<string> {
  const host = params.host ?? process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
  const model = params.model ?? process.env.OLLAMA_MODEL ?? 'llama3.1:8b';
  const timeoutMs = params.timeoutMs ?? 10 * 60 * 1000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const json = (await res.json()) as { message?: { content?: string } };
    const content = json.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Ollama returned no message content');
    }
    return content;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Ollama timed out after ${timeoutMs}ms`);
    }
    throw new Error(`Ollama call failed: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}
