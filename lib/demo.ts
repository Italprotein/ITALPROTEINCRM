import { clearStore } from '@/lib/mock-services/storage';

/** This build is always a front-end demo (no real backend). */
export function isDemo(): boolean {
  return true;
}

/**
 * Reset every demo mutation: clears all localStorage overlays + the session,
 * notifies same-tab listeners, then reloads so seeded fixtures are shown again.
 */
export function resetDemoData(): void {
  if (typeof window === 'undefined') return;
  clearStore(); // removes every 'italprotein-crm:' key (repo overlays + session)
  window.dispatchEvent(new CustomEvent('italprotein-store', { detail: { key: 'reset' } }));
  window.location.reload();
}
