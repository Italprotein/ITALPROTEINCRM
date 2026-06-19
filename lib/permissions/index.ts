/**
 * ITALPROTEIN CRM — role-based access control (DEMO / CLIENT-SIDE ONLY).
 *
 * One matrix drives BOTH navigation visibility and action availability.
 * Components must call `canView()` / `can()` / `accessLevel()` — never inline
 * role checks. Every rule here MUST be re-enforced server-side by the real
 * backend (see docs/BACKEND_HANDOFF.md).
 */
import type { Role, InternalRole, ExternalRole, Workspace } from '@/lib/types';

/* ── Sections ── */
export type InternalSection =
  | 'overview' | 'companies' | 'agencies' | 'contacts' | 'pipeline' | 'samples' | 'shipments'
  | 'feedback' | 'projects' | 'products' | 'ndas' | 'finance' | 'activities'
  | 'tasks' | 'calendar' | 'communications' | 'analytics' | 'notifications'
  | 'registrations' | 'users' | 'import_export' | 'settings' | 'audit';

export type PortalSection =
  | 'dashboard' | 'profile' | 'samples' | 'feedback' | 'projects'
  | 'documents' | 'requests' | 'notifications';

export type Section = InternalSection | PortalSection;

export type AccessLevel = 'full' | 'edit' | 'view' | 'hidden';

/* ── Actions ── */
export type Action =
  // internal
  | 'company.create' | 'company.edit' | 'contact.edit' | 'pipeline.stage_change'
  | 'sample.approve' | 'sample.status_update' | 'shipment.update'
  | 'feedback.reply' | 'nda.prepare' | 'nda.send' | 'nda.mark_signed'
  | 'finance.edit' | 'registration.approve' | 'user.manage' | 'data.export'
  | 'settings.edit' | 'audit.view'
  // portal
  | 'portal.request_sample' | 'portal.confirm_delivery' | 'portal.submit_feedback'
  | 'portal.upload_results' | 'portal.edit_company' | 'portal.submit_sensitive_edit'
  | 'portal.request_meeting' | 'portal.request_docs';

export const INTERNAL_SECTIONS: InternalSection[] = [
  'overview', 'companies', 'agencies', 'contacts', 'pipeline', 'samples', 'shipments',
  'feedback', 'projects', 'products', 'ndas', 'finance', 'activities',
  'tasks', 'calendar', 'communications', 'analytics', 'notifications',
  'registrations', 'users', 'import_export', 'settings', 'audit',
];

export const PORTAL_SECTIONS: PortalSection[] = [
  'dashboard', 'profile', 'samples', 'feedback', 'projects',
  'documents', 'requests', 'notifications',
];

interface RolePermissions {
  workspace: Workspace;
  sections: Partial<Record<Section, AccessLevel>>;
  actions: Action[];
}

/** Build a section map: every section gets `base`, then apply overrides. */
function sections(
  list: Section[],
  base: AccessLevel,
  overrides: Partial<Record<Section, AccessLevel>> = {},
): Partial<Record<Section, AccessLevel>> {
  const map: Partial<Record<Section, AccessLevel>> = {};
  for (const s of list) map[s] = base;
  return { ...map, ...overrides };
}

const ALL_INTERNAL_ACTIONS: Action[] = [
  'company.create', 'company.edit', 'contact.edit', 'pipeline.stage_change',
  'sample.approve', 'sample.status_update', 'shipment.update', 'feedback.reply',
  'nda.prepare', 'nda.send', 'nda.mark_signed', 'finance.edit',
  'registration.approve', 'user.manage', 'data.export', 'settings.edit', 'audit.view',
];

/* ────────────────────────────── THE MATRIX ────────────────────────────── */

export const PERMISSIONS: Record<Role, RolePermissions> = {
  /* ── Internal ── */
  super_admin: {
    workspace: 'internal',
    sections: sections(INTERNAL_SECTIONS, 'full'),
    actions: ALL_INTERNAL_ACTIONS,
  },
  crm_admin: {
    workspace: 'internal',
    sections: sections(INTERNAL_SECTIONS, 'full', { settings: 'edit', users: 'edit', audit: 'view' }),
    actions: [
      'company.create', 'company.edit', 'contact.edit', 'pipeline.stage_change',
      'sample.approve', 'sample.status_update', 'shipment.update', 'feedback.reply',
      'nda.prepare', 'nda.send', 'nda.mark_signed', 'finance.edit',
      'registration.approve', 'user.manage', 'data.export', 'settings.edit', 'audit.view',
    ],
  },
  business_dev: {
    workspace: 'internal',
    sections: sections(INTERNAL_SECTIONS, 'view', {
      overview: 'full', companies: 'full', agencies: 'full', contacts: 'full', pipeline: 'full',
      samples: 'edit', ndas: 'edit', projects: 'edit', activities: 'full',
      tasks: 'full', calendar: 'full', communications: 'full',
      finance: 'view', users: 'hidden', settings: 'hidden', audit: 'hidden',
    }),
    actions: [
      'company.create', 'company.edit', 'contact.edit', 'pipeline.stage_change',
      'nda.prepare', 'nda.send', 'data.export', 'sample.status_update',
    ],
  },
  rnd_technical: {
    workspace: 'internal',
    sections: sections(INTERNAL_SECTIONS, 'view', {
      overview: 'full', feedback: 'full', projects: 'full', products: 'full',
      samples: 'edit', activities: 'edit', tasks: 'full', calendar: 'full',
      finance: 'hidden', users: 'hidden', settings: 'hidden', audit: 'hidden',
      registrations: 'hidden', import_export: 'hidden',
    }),
    actions: ['feedback.reply', 'sample.status_update', 'data.export'],
  },
  logistics: {
    workspace: 'internal',
    sections: sections(INTERNAL_SECTIONS, 'view', {
      overview: 'full', samples: 'full', shipments: 'full',
      activities: 'edit', tasks: 'full', calendar: 'full',
      finance: 'hidden', users: 'hidden', settings: 'hidden', audit: 'hidden',
      registrations: 'hidden', ndas: 'hidden', pipeline: 'hidden',
    }),
    actions: ['sample.approve', 'sample.status_update', 'shipment.update', 'data.export'],
  },
  finance: {
    workspace: 'internal',
    sections: sections(INTERNAL_SECTIONS, 'view', {
      overview: 'full', finance: 'full', analytics: 'full', tasks: 'full',
      ndas: 'hidden', feedback: 'hidden', projects: 'hidden', products: 'hidden',
      users: 'hidden', settings: 'hidden', audit: 'hidden', registrations: 'hidden',
      import_export: 'hidden', communications: 'hidden',
    }),
    actions: ['finance.edit', 'data.export'],
  },
  management_readonly: {
    workspace: 'internal',
    sections: sections(INTERNAL_SECTIONS, 'view', {
      users: 'hidden', settings: 'hidden', audit: 'hidden',
      import_export: 'hidden', registrations: 'hidden',
    }),
    actions: ['data.export'],
  },

  /* ── External (portal) ── */
  company_owner: {
    workspace: 'external',
    sections: sections(PORTAL_SECTIONS, 'full'),
    actions: [
      'portal.request_sample', 'portal.confirm_delivery', 'portal.submit_feedback',
      'portal.upload_results', 'portal.edit_company', 'portal.submit_sensitive_edit',
      'portal.request_meeting', 'portal.request_docs',
    ],
  },
  company_member: {
    workspace: 'external',
    sections: sections(PORTAL_SECTIONS, 'view', {
      samples: 'edit', feedback: 'edit', requests: 'edit',
    }),
    actions: [
      'portal.request_sample', 'portal.confirm_delivery', 'portal.submit_feedback',
      'portal.request_meeting', 'portal.request_docs',
    ],
  },
  company_technical: {
    workspace: 'external',
    sections: sections(PORTAL_SECTIONS, 'view', {
      samples: 'edit', feedback: 'full', projects: 'full', requests: 'edit',
    }),
    actions: [
      'portal.request_sample', 'portal.submit_feedback', 'portal.upload_results',
      'portal.request_meeting', 'portal.request_docs',
    ],
  },
  company_logistics: {
    workspace: 'external',
    sections: sections(PORTAL_SECTIONS, 'view', {
      samples: 'full', requests: 'edit',
    }),
    actions: [
      'portal.request_sample', 'portal.confirm_delivery',
      'portal.request_meeting', 'portal.request_docs',
    ],
  },
  company_finance: {
    workspace: 'external',
    sections: sections(PORTAL_SECTIONS, 'view', {
      documents: 'full', requests: 'edit',
    }),
    actions: ['portal.request_docs', 'portal.request_meeting'],
  },
};

/* ────────────────────────────── Helpers ────────────────────────────── */

export function accessLevel(role: Role, section: Section): AccessLevel {
  return PERMISSIONS[role]?.sections[section] ?? 'hidden';
}

export function canView(role: Role, section: Section): boolean {
  return accessLevel(role, section) !== 'hidden';
}

export function canEdit(role: Role, section: Section): boolean {
  const lvl = accessLevel(role, section);
  return lvl === 'full' || lvl === 'edit';
}

export function can(role: Role, action: Action): boolean {
  return PERMISSIONS[role]?.actions.includes(action) ?? false;
}

export function workspaceOf(role: Role): Workspace {
  return PERMISSIONS[role]?.workspace ?? 'external';
}

export function isInternal(role: Role): role is InternalRole {
  return workspaceOf(role) === 'internal';
}

export function isExternal(role: Role): role is ExternalRole {
  return workspaceOf(role) === 'external';
}

/** Management role is view-only across the board. */
export function isReadOnly(role: Role): boolean {
  return role === 'management_readonly';
}
