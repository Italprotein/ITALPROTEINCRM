'use client';

import { useEffect, useMemo, useState } from 'react';
import type { StaffMember } from '@/fixtures';
import { userService } from '@/lib/mock-services';

// Module-level cache so every page share one staff-directory load per session.
// Replaces the old synchronous fixture-backed authService.getAccount(id) name
// lookups, which never matched real DB user ids in api mode.
let cache: StaffMember[] | null = null;
let pending: Promise<StaffMember[]> | null = null;

function loadStaff(): Promise<StaffMember[]> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = userService
      .list()
      .then((rows) => {
        cache = rows;
        return rows;
      })
      .catch(() => {
        pending = null;
        return [] as StaffMember[];
      });
  }
  return pending;
}

export interface StaffDirectory {
  staff: StaffMember[];
  byId: Map<string, StaffMember>;
  ready: boolean;
  /** Full name for a user id, or the fallback when unknown/unassigned. */
  nameOf: (id: string | undefined | null, fallback?: string) => string;
  /** Avatar colour for a user id (undefined when unknown). */
  colorOf: (id: string | undefined | null) => string | undefined;
  get: (id: string | undefined | null) => StaffMember | undefined;
}

export function useStaffDirectory(): StaffDirectory {
  const [staff, setStaff] = useState<StaffMember[] | null>(cache);

  useEffect(() => {
    let active = true;
    loadStaff().then((rows) => {
      if (active) setStaff(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => {
    const list = staff ?? [];
    const byId = new Map(list.map((s) => [s.id, s]));
    const get = (id: string | undefined | null) => (id ? byId.get(id) : undefined);
    return {
      staff: list,
      byId,
      ready: staff !== null,
      get,
      nameOf: (id, fallback = '—') => {
        const s = get(id);
        return s ? `${s.firstName} ${s.lastName}` : fallback;
      },
      colorOf: (id) => get(id)?.avatarColor,
    };
  }, [staff]);
}
