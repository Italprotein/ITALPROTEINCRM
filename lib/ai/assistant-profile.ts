import type { DocumentAccessLevel, Role, Workspace } from '@/lib/types';

export const assistantProfile = {
  name: process.env.AI_ASSISTANT_NAME ?? 'Amina',
  italianMeaning: 'A short, warm name derived from Proamina and amino-acid language.',
  publicTagline: 'The Proamina assistant for partners and the Italprotein team.',
  internalModeName: 'Amina Team',
  portalModeName: 'Amina Partner',
} as const;

export type AssistantAudience = 'public' | 'portal' | 'internal';

export interface AssistantPolicy {
  audience: AssistantAudience;
  workspace?: Workspace;
  allowedDocumentLevels: DocumentAccessLevel[];
  canUseCrmTools: boolean;
  canUseGoogleDriveTools: boolean;
  canRevealInternalCommercialData: boolean;
  notes: string[];
}

export const assistantPolicies: Record<AssistantAudience, AssistantPolicy> = {
  public: {
    audience: 'public',
    allowedDocumentLevels: ['public'],
    canUseCrmTools: false,
    canUseGoogleDriveTools: false,
    canRevealInternalCommercialData: false,
    notes: [
      'Answers only from approved public Proamina and Italprotein material.',
      'Routes commercial, regulatory and sample requests to registration or contact forms.',
    ],
  },
  portal: {
    audience: 'portal',
    workspace: 'external',
    allowedDocumentLevels: ['public', 'portal_general', 'pre_nda', 'post_nda', 'company_specific'],
    canUseCrmTools: true,
    canUseGoogleDriveTools: true,
    canRevealInternalCommercialData: false,
    notes: [
      'Answers only within the signed-in company scope.',
      'Post-NDA and company-specific documents require server-side NDA and company checks.',
      'Never exposes internal-only notes, pricing strategy, investor files or another company record.',
    ],
  },
  internal: {
    audience: 'internal',
    workspace: 'internal',
    allowedDocumentLevels: ['public', 'portal_general', 'pre_nda', 'post_nda', 'company_specific', 'internal'],
    canUseCrmTools: true,
    canUseGoogleDriveTools: true,
    canRevealInternalCommercialData: true,
    notes: [
      'Answers across CRM data according to the staff role permission matrix.',
      'Internal-only files remain role-gated; management-readonly can read but not mutate.',
      'Mutating actions require explicit user confirmation and audit logging.',
    ],
  },
};

export function assistantAudienceForRole(role?: Role): AssistantAudience {
  if (!role) return 'public';
  return role.startsWith('company_') ? 'portal' : 'internal';
}
