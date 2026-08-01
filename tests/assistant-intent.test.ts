import { describe, expect, it } from 'vitest';

import { isExplicitAssistantMutation } from '@/lib/ai/assistant-intent';

describe('Amina mutation intent', () => {
  it('accepts explicit task and meeting requests in both supported languages', () => {
    expect(isExplicitAssistantMutation('Create a follow-up task for tomorrow', 'task')).toBe(true);
    expect(isExplicitAssistantMutation('Aggiungi un promemoria per domani', 'task')).toBe(true);
    expect(isExplicitAssistantMutation('Schedule a call with Acme next Tuesday', 'meeting')).toBe(true);
    expect(isExplicitAssistantMutation('Fissa una riunione con Matteo alle 15', 'meeting')).toBe(true);
  });

  it('does not treat read-only questions as mutation confirmation', () => {
    expect(isExplicitAssistantMutation('Show me my open tasks', 'task')).toBe(false);
    expect(isExplicitAssistantMutation('What meetings are next?', 'meeting')).toBe(false);
    expect(isExplicitAssistantMutation('Summarize the latest reply', 'draft')).toBe(false);
    expect(isExplicitAssistantMutation('What do I need to do today?', 'daily_tasks')).toBe(false);
  });

  it('requires the action and its object in the same latest user turn', () => {
    expect(isExplicitAssistantMutation('Create it', 'task')).toBe(false);
    expect(isExplicitAssistantMutation('There is a task in that email', 'task')).toBe(false);
    expect(isExplicitAssistantMutation('Prepare a Gmail reply draft', 'draft')).toBe(true);
    expect(isExplicitAssistantMutation("Analyze today's tasks from my inbox", 'daily_tasks')).toBe(true);
  });
});
