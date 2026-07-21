import type { DocumentAccessLevel, Role } from '@/lib/types';
import { getBackendEnv } from '@/lib/backend/env';
import {
  assistantPolicies,
  assistantProfile,
  type AssistantAudience,
  type AssistantPolicy,
} from './assistant-profile';

/*
 * Amina runtime — the single seam between the CRM and the model.
 *
 * Everything around this file is real: `/api/assistant` authenticates the caller,
 * resolves the audience from their role, rate-limits, persists the turn to
 * AssistantThread/AssistantMessage and writes an AuditEvent. Only
 * `generateAssistantReply` is stubbed — see the TODO below for what to fill in.
 */

/** Mirrors the AssistantCitationTargetType enum in prisma/schema.prisma. */
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

/** A source the assistant wants to attach to an answer. Persisted as AssistantCitation. */
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
  /** UI locale — Amina answers in the language the user is reading. */
  locale: string;
  /** Prior turns of this thread, oldest first. Excludes the incoming message. */
  history: AssistantTurn[];
  /** The message being answered. */
  message: string;
  /** Set for portal/internal audiences; scopes every answer to this company. */
  companyId?: string | null;
  companyName?: string | null;
  actorRole?: Role;
}

export interface AssistantReply {
  text: string;
  citations: AssistantCitationDraft[];
  model: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  /** True while the model call is not wired up — the UI labels these replies. */
  stubbed: boolean;
}

/** Whether a real model call is possible: provider configured and key present. */
export function isAssistantConfigured(): boolean {
  return Boolean(getBackendEnv().ai.apiKey);
}

export function policyFor(audience: AssistantAudience): AssistantPolicy {
  return assistantPolicies[audience];
}

/**
 * Builds the system prompt from the audience policy. The policy — not the prompt —
 * is the security boundary: the route filters what data reaches this function, and
 * the prompt only restates those limits for the model.
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
    `You support Italprotein Srl and its Proamina® protein sweetener business.`,
    '',
    `Answer in ${input.locale === 'it' ? 'Italian' : 'English'} unless the user writes in the other language.`,
    '',
    'Scope and limits for this conversation:',
    ...policy.notes.map((note) => `- ${note}`),
    `- Document access levels you may draw on: ${policy.allowedDocumentLevels.join(', ')}.`,
    `- CRM record lookups: ${policy.canUseCrmTools ? 'permitted' : 'not permitted'}.`,
    `- Google Drive lookups: ${policy.canUseGoogleDriveTools ? 'permitted' : 'not permitted'}.`,
    `- Internal commercial data (pricing strategy, margins, investor material): ${
      policy.canRevealInternalCommercialData ? 'may be discussed' : 'must never be revealed'
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
    'Cite the record or document behind any factual claim about CRM data.',
    'If a question falls outside the limits above, say so plainly and route the user to the right team instead of guessing.',
    'Never invent a shipment status, a document, a price or an NDA state. If you do not know, say you do not know.',
  );

  return lines.join('\n');
}

/**
 * TODO(amina): replace the stub below with a real Claude call. This is the only
 * place that needs to change — the route, persistence, auditing and UI are done.
 *
 * The env layer already resolves everything needed (see lib/backend/env.ts):
 *   const { apiKey, model } = getBackendEnv().ai;   // model defaults to claude-opus-4-8
 *
 *   import Anthropic from '@anthropic-ai/sdk';      // already a dependency
 *   const client = new Anthropic({ apiKey });
 *   const stream = client.messages.stream({
 *     model,
 *     max_tokens: 4096,
 *     system: buildSystemPrompt(input),
 *     thinking: { type: 'adaptive' },               // must be set explicitly on Opus 4.8
 *     output_config: { effort: 'medium' },
 *     messages: [...input.history, { role: 'user', content: input.message }],
 *   });
 *   const message = await stream.finalMessage();
 *
 * Before turning it on, two things still need designing:
 *   1. Retrieval — feed the model only records the audience policy allows. The route
 *      already resolves the policy; the CRM lookup layer is what's missing.
 *   2. Tools — AssistantMessage.toolCallStatus models a confirm-before-mutate flow
 *      ('proposed' -> 'awaiting_confirmation' -> 'confirmed' -> 'executed'). Mutating
 *      tools must stay behind that gate and write an AuditEvent.
 */
export async function generateAssistantReply(
  input: AssistantRuntimeInput,
): Promise<AssistantReply> {
  const { model } = getBackendEnv().ai;
  const policy = policyFor(input.audience);

  // Keeps the signature honest as an async boundary and keeps callers await-correct.
  await Promise.resolve();

  const configured = isAssistantConfigured();
  const text = configured
    ? stubReply(input, policy, model)
    : stubReply(input, policy, null);

  return {
    text,
    citations: [],
    model: null,
    usage: null,
    stubbed: true,
  };
}

function stubReply(
  input: AssistantRuntimeInput,
  policy: AssistantPolicy,
  model: string | null,
): string {
  const it = input.locale === 'it';
  const name = assistantProfile.name;

  const head = it
    ? `Sono ${name}, ma non sono ancora collegata al modello.`
    : `I'm ${name}, but I'm not connected to the model yet.`;

  const body = it
    ? `L'interfaccia, i permessi e la cronologia funzionano: questa conversazione è stata salvata e verificata per il tuo profilo di accesso "${input.audience}". Manca solo la chiamata al modello.`
    : `The interface, permissions and history all work: this conversation was saved and checked against your "${input.audience}" access profile. Only the model call is missing.`;

  const config = model
    ? it
      ? `Il modello configurato è ${model}.`
      : `The configured model is ${model}.`
    : it
      ? 'Nessuna ANTHROPIC_API_KEY configurata.'
      : 'No ANTHROPIC_API_KEY is configured.';

  const scope = it
    ? `In questa modalità potrò consultare: ${policy.allowedDocumentLevels.join(', ')}.`
    : `In this mode I will be able to draw on: ${policy.allowedDocumentLevels.join(', ')}.`;

  return [head, body, config, scope].join('\n\n');
}
