import { describe, it, expect } from 'vitest';

import { PUBLIC_NAMESPACES, pickMessages } from '@/lib/i18n/public-namespaces';

/*
 * The public route group (landing + auth screens) hydrates its
 * NextIntlClientProvider with only a slice of the full message catalogue —
 * shipping all 51 namespaces to an anonymous visitor leaks admin/portal
 * copy and bloats every public page by tens of KB. `pickMessages` is the
 * filter that makes the slice, and `PUBLIC_NAMESPACES` is the allow-list it
 * is fed. These tests pin both against regressions.
 */

describe('pickMessages', () => {
  it('keeps only the requested namespaces', () => {
    const messages = { A: { x: '1' }, B: { y: '2' } } as any;
    expect(pickMessages(messages, ['A'])).toEqual({ A: { x: '1' } });
  });

  it('ignores namespace names absent from the source object', () => {
    const messages = { A: { x: '1' } } as any;
    const result = pickMessages(messages, ['A', 'Ghost']);
    expect(result).toEqual({ A: { x: '1' } });
    expect(Object.prototype.hasOwnProperty.call(result, 'Ghost')).toBe(false);
  });
});

describe('PUBLIC_NAMESPACES', () => {
  it('contains the core public namespaces', () => {
    for (const namespace of ['Landing', 'Login', 'TeamLogin', 'Errors', 'Common']) {
      expect(PUBLIC_NAMESPACES).toContain(namespace);
    }
  });

  it('contains nothing scoped to the internal CRM', () => {
    expect(PUBLIC_NAMESPACES.some((namespace) => namespace.startsWith('Admin'))).toBe(false);
  });
});
