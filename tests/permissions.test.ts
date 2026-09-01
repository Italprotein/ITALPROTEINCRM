import { describe, it, expect } from 'vitest';

import {
  PERMISSIONS,
  INTERNAL_SECTIONS,
  PORTAL_SECTIONS,
  can,
  canView,
  canEdit,
  isInternal,
  isExternal,
  type Action,
  type InternalSection,
} from '@/lib/permissions';
import type { Role } from '@/lib/types';

/*
 * The permission matrix is the security model the whole app leans on: the server
 * guards in lib/backend/session.ts resolve every decision through it. These tests
 * pin the rules that would be silently destructive to get wrong — they need no
 * database, so they run on every push.
 */

const ROLES = Object.keys(PERMISSIONS) as Role[];
const INTERNAL_ROLES = ROLES.filter(isInternal);
const EXTERNAL_ROLES = ROLES.filter(isExternal);

/** Sections that only ever make sense inside the staff CRM. */
const STAFF_ONLY_SECTIONS: InternalSection[] = [
  'overview', 'companies', 'agencies', 'contacts', 'pipeline', 'shipments',
  'ndas', 'finance', 'activities', 'tasks', 'calendar',
  'communications', 'analytics', 'registrations', 'users', 'import_export',
  'settings', 'audit',
];

/** Every action an external portal user must never hold. */
const INTERNAL_ONLY_ACTIONS: Action[] = [
  'company.create', 'company.edit', 'contact.edit', 'pipeline.stage_change',
  'sample.approve', 'sample.status_update', 'shipment.update', 'feedback.reply',
  'nda.prepare', 'nda.send', 'nda.mark_signed', 'finance.edit',
  'registration.approve', 'user.manage', 'data.export', 'settings.edit', 'audit.view',
];

describe('matrix integrity', () => {
  it('defines both internal and external roles', () => {
    expect(INTERNAL_ROLES.length).toBeGreaterThan(0);
    expect(EXTERNAL_ROLES.length).toBeGreaterThan(0);
  });

  it('gives every role a workspace and never both kinds at once', () => {
    for (const role of ROLES) {
      expect(PERMISSIONS[role].workspace).toMatch(/^(internal|external)$/);
      expect(isInternal(role)).toBe(!isExternal(role));
    }
  });

  it('never grants a section that is not a known section', () => {
    const known = new Set<string>([...INTERNAL_SECTIONS, ...PORTAL_SECTIONS]);
    for (const role of ROLES) {
      for (const section of Object.keys(PERMISSIONS[role].sections)) {
        expect(known.has(section), `${role} references unknown section "${section}"`).toBe(true);
      }
    }
  });
});

describe('external roles are confined to the portal', () => {
  it('cannot view any staff-only section', () => {
    for (const role of EXTERNAL_ROLES) {
      for (const section of STAFF_ONLY_SECTIONS) {
        expect(canView(role, section), `${role} must not view "${section}"`).toBe(false);
      }
    }
  });

  it('cannot edit any staff-only section', () => {
    for (const role of EXTERNAL_ROLES) {
      for (const section of STAFF_ONLY_SECTIONS) {
        expect(canEdit(role, section), `${role} must not edit "${section}"`).toBe(false);
      }
    }
  });

  it('holds no internal action', () => {
    for (const role of EXTERNAL_ROLES) {
      for (const action of INTERNAL_ONLY_ACTIONS) {
        expect(can(role, action), `${role} must not hold "${action}"`).toBe(false);
      }
    }
  });

  it('cannot manage users, edit settings or read the audit log', () => {
    for (const role of EXTERNAL_ROLES) {
      expect(can(role, 'user.manage')).toBe(false);
      expect(can(role, 'settings.edit')).toBe(false);
      expect(can(role, 'audit.view')).toBe(false);
    }
  });
});

describe('super_admin vs crm_admin (the Italprotein admin split)', () => {
  it('super_admin alone administers admins, settings and audit', () => {
    expect(can('super_admin', 'user.manage')).toBe(true);
    expect(can('super_admin', 'settings.edit')).toBe(true);
    expect(can('super_admin', 'audit.view')).toBe(true);

    expect(can('crm_admin', 'user.manage')).toBe(false);
    expect(can('crm_admin', 'settings.edit')).toBe(false);
    expect(can('crm_admin', 'audit.view')).toBe(false);
  });

  it('hides the admin-only sections from crm_admin', () => {
    for (const section of ['users', 'settings', 'audit'] as InternalSection[]) {
      expect(canView('crm_admin', section), `crm_admin must not view "${section}"`).toBe(false);
    }
  });

  it('still gives crm_admin full day-to-day business CRUD', () => {
    for (const action of [
      'company.create', 'company.edit', 'contact.edit', 'pipeline.stage_change',
      'sample.approve', 'shipment.update', 'nda.mark_signed', 'finance.edit',
      'registration.approve', 'data.export',
    ] as Action[]) {
      expect(can('crm_admin', action), `crm_admin should hold "${action}"`).toBe(true);
    }
    for (const section of ['companies', 'contacts', 'pipeline', 'samples', 'shipments'] as InternalSection[]) {
      expect(canEdit('crm_admin', section), `crm_admin should edit "${section}"`).toBe(true);
    }
  });
});

describe('read-only roles cannot write', () => {
  it('management_readonly holds no mutating action', () => {
    const mutating = INTERNAL_ONLY_ACTIONS.filter((a) => a !== 'data.export');
    for (const action of mutating) {
      expect(can('management_readonly', action), `management_readonly must not hold "${action}"`).toBe(false);
    }
  });

  it('management_readonly cannot edit any section', () => {
    for (const section of INTERNAL_SECTIONS) {
      expect(canEdit('management_readonly', section), `must not edit "${section}"`).toBe(false);
    }
  });
});

describe('unknown roles fail closed', () => {
  const bogus = 'not_a_role' as Role;

  it('grants nothing to an unrecognised role', () => {
    expect(canView(bogus, 'companies')).toBe(false);
    expect(canEdit(bogus, 'companies')).toBe(false);
    expect(can(bogus, 'company.edit')).toBe(false);
  });
});
