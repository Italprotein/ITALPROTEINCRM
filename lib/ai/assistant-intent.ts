export type AssistantMutationKind = 'task' | 'meeting' | 'draft' | 'daily_tasks';

const MUTATION_PATTERNS: Record<AssistantMutationKind, { verb: RegExp; object: RegExp }> = {
  task: {
    verb: /\b(create|add|make|set up|schedule|crea|aggiungi|imposta|programma)\b/i,
    object: /\b(task|to-do|todo|reminder|attivit[aà]|compito|promemoria)\b/i,
  },
  meeting: {
    verb: /\b(create|book|schedule|organize|set up|crea|prenota|programma|organizza|fissa)\b/i,
    object: /\b(meeting|call|appointment|riunione|chiamata|appuntamento|videochiamata)\b/i,
  },
  draft: {
    verb: /\b(create|write|prepare|draft|generate|crea|scrivi|prepara|genera)\b/i,
    object: /\b(draft|reply|response|email|bozza|risposta|mail)\b/i,
  },
  daily_tasks: {
    verb: /\b(create|generate|analy[sz]e|find|crea|genera|analizza|trova)\b/i,
    object: /\b(today'?s tasks|daily tasks|inbox tasks|tasks? for today|attivit[aà] di oggi|compiti di oggi|task di oggi)\b/i,
  },
};

/** A model-supplied argument is never confirmation; only the latest user turn is. */
export function isExplicitAssistantMutation(message: string, kind: AssistantMutationKind): boolean {
  const pattern = MUTATION_PATTERNS[kind];
  return pattern.verb.test(message) && pattern.object.test(message);
}
