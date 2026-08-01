import OpenAI from 'openai';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

import { getBackendEnv } from '@/lib/backend/env';

export type AiProviderName = 'groq' | 'openai';

export interface AiProviderClient {
  provider: AiProviderName;
  model: string;
  client: OpenAI;
}

export interface AiSdkProviderClient {
  provider: AiProviderName;
  model: string;
  modelClient: LanguageModel;
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

/**
 * AI SDK model used by Amina's tool loop. The legacy OpenAI client above stays
 * in place because the inbox-to-task and Gmail-draft services still use it.
 */
export function getAiSdkProviderClient(): AiSdkProviderClient | null {
  const env = getBackendEnv();
  const provider = getAiProviderName();

  if (provider === 'groq') {
    if (!env.groq.apiKey) return null;
    const groq = createGroq({ apiKey: env.groq.apiKey });
    return {
      provider,
      model: env.groq.model,
      modelClient: groq(env.groq.model),
    };
  }

  if (!env.openai.apiKey) return null;
  const openai = createOpenAI({ apiKey: env.openai.apiKey });
  return {
    provider,
    model: env.openai.model,
    modelClient: openai.responses(env.openai.model),
  };
}

export function isAiProviderConfigured(): boolean {
  return Boolean(getAiProviderClient());
}
