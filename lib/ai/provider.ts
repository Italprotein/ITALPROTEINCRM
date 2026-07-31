import OpenAI from 'openai';

import { getBackendEnv } from '@/lib/backend/env';

export type AiProviderName = 'groq' | 'openai';

export interface AiProviderClient {
  provider: AiProviderName;
  model: string;
  client: OpenAI;
}

export function getAiProviderName(): AiProviderName {
  return getBackendEnv().ai.provider.toLowerCase() === 'groq' ? 'groq' : 'openai';
}

export function getAiProviderClient(): AiProviderClient | null {
  const env = getBackendEnv();
  const provider = getAiProviderName();

  if (provider === 'groq') {
    if (!env.groq.apiKey) return null;
    return {
      provider,
      model: env.groq.model,
      client: new OpenAI({
        apiKey: env.groq.apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      }),
    };
  }

  if (!env.openai.apiKey) return null;
  return {
    provider,
    model: env.openai.model,
    client: new OpenAI({ apiKey: env.openai.apiKey }),
  };
}

export function isAiProviderConfigured(): boolean {
  return Boolean(getAiProviderClient());
}
