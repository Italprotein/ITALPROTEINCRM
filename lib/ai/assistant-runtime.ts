import type { DocumentAccessLevel, Role } from '@/lib/types';
import { getAiProviderClient, isAiProviderConfigured } from './provider';
import {
  assistantPolicies,
  assistantProfile,
  type AssistantAudience,
  type AssistantPolicy,
} from './assistant-profile';

/*
 * Amina runtime — the single seam between the CRM and the model.
 *
 * The API route authenticates the caller, resolves the audience from their role,
 * rate-limits, persists the turn and writes an AuditEvent. This module only builds
 * the permission-aware instructions and calls the configured AI provider.
 *
 * CRM/Drive retrieval remains deliberately separate: until a permission-filtered
 * retrieval layer supplies records, the model is told it has no live data to inspect.
 */

export type AssistantCitationTargetType =
  | 'company'
  | 'contact'
  | 'opportunity'
  | 'sample_request'
  | 'shipment'
  | 'feedback'
  | 'application_project'
  | 'product'
  | 'nda'
  | 'document'
  | 'support_request'
  | 'invoice'
  | 'task'
  | 'meeting'
  | 'google_drive_file';

export interface AssistantCitationDraft {
  targetType: AssistantCitationTargetType;
  targetId?: string;
  label?: string;
  snippet?: string;
  accessLevel?: DocumentAccessLevel;
  sourceUrl?: string;
}

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantRuntimeInput {
  audience: AssistantAudience;
  locale: string;
  history: AssistantTurn[];
  message: string;
  companyId?: string | null;
  companyName?: string | null;
  actorRole?: Role;
}

export interface AssistantReply {
  text: string;
  citations: AssistantCitationDraft[];
  model: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  /** Kept for API compatibility with the existing UI. */
  stubbed: boolean;
}

export function isAssistantConfigured(): boolean {
  return isAiProviderConfigured();
}

export function policyFor(audience: AssistantAudience): AssistantPolicy {
  return assistantPolicies[audience];
}

/**
 * The policy is restated to the model, but prompt text is not the security boundary.
 * The route and future retrieval tools must enforce the same limits server-side.
 */
export function buildSystemPrompt(input: {
  audience: AssistantAudience;
  locale: string;
  companyName?: string | null;
  actorRole?: Role;
}): string {
  const policy = policyFor(input.audience);
  const name = assistantProfile.name;
  const modeName =
    input.audience === 'internal'
      ? assistantProfile.internalModeName
      : input.audience === 'portal'
        ? assistantProfile.portalModeName
        : `${name} Public`;

  const lines = [
    `You are ${name} (${modeName}) — ${assistantProfile.publicTagline}`,
    'You support Italprotein Srl and its Proamina® protein sweetener business.',
    '',
    `Answer in ${input.locale === 'it' ? 'Italian' : 'English'} unless the user writes in the other language.`,
    '',
    'Scope and limits for this conversation:',
    ...policy.notes.map((note) => `- ${note}`),
    `- Document access levels: ${policy.allowedDocumentLevels.join(', ')}.`,
    `- CRM tools are ${policy.canUseCrmTools ? 'permitted by policy when connected' : 'not permitted'}.`,
    `- Google Drive tools are ${policy.canUseGoogleDriveTools ? 'permitted by policy when connected' : 'not permitted'}.`,
    `- Internal commercial data ${
      policy.canRevealInternalCommercialData ? 'may be discussed when supplied by an authorized tool' : 'must never be revealed'
    }.`,
  ];

  if (input.companyName) {
    lines.push(
      '',
      `The signed-in user belongs to ${input.companyName}. Never reveal another company's records.`,
    );
  }
  if (input.actorRole) {
    lines.push(`Their role is "${input.actorRole}" — respect the role permission matrix.`);
  }

  lines.push(
    '',
    'This chat request does not currently include live CRM, Gmail, Google Drive, shipment or NDA records. Never imply that you inspected them.',
    'When asked for current company data, explain that live retrieval is not connected in chat yet and direct the user to the relevant CRM section.',
    "The separate Generate today's tasks action can analyze the signed-in member's assigned Gmail messages after an explicit click.",
    'Use concise plain text. Avoid Markdown headings, tables and code fences.',
    'If a question falls outside these limits, say so plainly instead of guessing.',
    'Never invent a shipment status, document, price, commitment or NDA state.',
  );

  return lines.join('\n');
}

export async function generateAssistantReply(
  input: AssistantRuntimeInput,
): Promise<AssistantReply> {
  const configured = getAiProviderClient();
  if (!configured) throw new Error('AI_PROVIDER_NOT_CONFIGURED');

  if (configured.provider === 'groq') {
    const response = await configured.client.chat.completions.create({
      model: configured.model,
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: buildSystemPrompt(input) },
        ...input.history.map((turn) => ({ role: turn.role, content: turn.content })),
        { role: 'user', content: input.message },
      ],
      max_completion_tokens: 900,
    });
    const text = response.choices[0]?.message.content?.trim();
    if (!text) throw new Error('EMPTY_ASSISTANT_REPLY');

    return {
      text,
      citations: [],
      model: configured.model,
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
          }
        : null,
      stubbed: false,
    };
  }

  const response = await configured.client.responses.create({
    model: configured.model,
    store: false,
    reasoning: { effort: 'low' },
    instructions: buildSystemPrompt(input),
    input: [
      ...input.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user' as const, content: input.message },
    ],
    max_output_tokens: 900,
    text: { verbosity: 'low' },
  });

  const text = response.output_text.trim();
  if (!text) throw new Error('EMPTY_ASSISTANT_REPLY');

  return {
    text,
    citations: [],
    model: configured.model,
    usage: response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        }
      : null,
    stubbed: false,
  };
}
