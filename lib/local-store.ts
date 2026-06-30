import { clearStore } from '@/lib/mock-services/storage';

/**
 * Reset every local mutation: clears all localStorage overlays + the session,
 * notifies same-tab listeners, then reloads so the seeded sample data is shown
 * again. Local-preview (mock) mode only.
 */
export function resetLocalData(): void {
  if (typeof window === 'undefined') return;
  clearStore(); // removes every 'italprotein-crm:' key (repo overlays + session)
  window.dispatchEvent(new CustomEvent('italprotein-store', { detail: { key: 'reset' } }));
  window.location.reload();
}
