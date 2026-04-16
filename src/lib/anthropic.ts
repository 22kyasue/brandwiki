import Anthropic from '@anthropic-ai/sdk';
import { callClaudeCLI } from './claude-cli.js';

let client: Anthropic | null = null;

export type Provider = 'claude-cli' | 'api';

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set (required for provider=api).');
  }
  client = new Anthropic({ apiKey });
  return client;
}

export interface LLMParams {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  provider?: Provider;
}

export async function callLLM(params: LLMParams): Promise<string> {
  const provider: Provider =
    params.provider ?? (process.env.BRANDWIKI_PROVIDER as Provider) ?? 'claude-cli';

  if (provider === 'claude-cli') {
    return callClaudeCLI({
      system: params.system,
      user: params.user,
    });
  }

  const c = getClient();
  const response = await c.messages.create({
    model: params.model,
    max_tokens: params.maxTokens ?? 8192,
    system: params.system,
    messages: [{ role: 'user', content: params.user }],
  });
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

export async function* callLLMStream(params: LLMParams): AsyncGenerator<string> {
  const provider: Provider =
    params.provider ?? (process.env.BRANDWIKI_PROVIDER as Provider) ?? 'claude-cli';

  if (provider === 'claude-cli') {
    const result = await callClaudeCLI({
      system: params.system,
      user: params.user,
    });
    yield result;
    return;
  }

  const c = getClient();
  const stream = c.messages.stream({
    model: params.model,
    max_tokens: params.maxTokens ?? 4096,
    system: params.system,
    messages: [{ role: 'user', content: params.user }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}
