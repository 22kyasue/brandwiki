import Anthropic from '@anthropic-ai/sdk';
import { callClaudeCLI } from './claude-cli.js';
import { callOllama } from './ollama.js';

let client: Anthropic | null = null;

export type Provider = 'claude-cli' | 'api' | 'ollama';

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
  webSearch?: boolean;
  webSearchMaxUses?: number;
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

  if (provider === 'ollama') {
    return callOllama({
      system: params.system,
      user: params.user,
      model: params.model,
    });
  }

  const c = getClient();
  const request: Anthropic.MessageCreateParams = {
    model: params.model,
    max_tokens: params.maxTokens ?? 8192,
    system: params.system,
    messages: [{ role: 'user', content: params.user }],
  };
  if (params.webSearch) {
    request.tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: params.webSearchMaxUses ?? 5,
      } as any,
    ];
  }
  const response = await c.messages.create(request) as Anthropic.Message;
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((b) => b.text)
    .join('\n');
}
