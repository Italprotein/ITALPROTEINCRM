import type { Company } from '@/lib/types';

/**
 * The ONE company-profile completion computation.
 *
 * Both the portal dashboard checklist and the profile page bar consume this,
 * always from the PERSISTED Company record — never from in-flight form state —
 * so the two surfaces cannot drift apart and the number cannot move while the
 * user is still typing.
 */

export type ProfileItemKey =
  | 'website'
  | 'vatNumber'
  | 'mainActivity'
  | 'billingAddress'
  | 'shippingAddress'
  | 'applicationInterests'
  | 'deliveryPreferences'
  | 'teamContacts';

export interface ProfileCompletionItem {
  key: ProfileItemKey;
  done: boolean;
}

export interface ProfileCompletion {
  percent: number;
  items: ProfileCompletionItem[];
}

export function profileCompletion(company: Company, contactCount: number): ProfileCompletion {
  const items: ProfileCompletionItem[] = [
    { key: 'website', done: !!company.website },
    { key: 'vatNumber', done: !!company.vatNumber },
    { key: 'mainActivity', done: !!company.mainActivity?.trim() },
    { key: 'billingAddress', done: !!company.billingAddress },
    { key: 'shippingAddress', done: !!company.shippingAddresses?.length },
    // Either field answers "what will you use Proamina for" — the portal form
    // writes productCategories; applicationInterests is the admin-side note.
    {
      key: 'applicationInterests',
      done: !!(company.productCategories?.length || company.applicationInterests?.length),
    },
    {
      key: 'deliveryPreferences',
      done: !!(company.preferredCourier?.trim() || company.deliveryInstructions?.trim()),
    },
    { key: 'teamContacts', done: contactCount > 0 },
  ];
  const done = items.filter((item) => item.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}
