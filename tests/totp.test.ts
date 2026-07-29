import { describe, it, expect } from 'vitest';

import {
  base32Encode,
  base32Decode,
  totpCode,
  verifyTotp,
  generateTotpSecret,
  generateBackupCodes,
  normaliseBackupCode,
  totpAuthUri,
} from '@/lib/backend/totp';

/*
 * TOTP is implemented in-house, so it has to earn that by matching the
 * specification exactly. These assert against RFC 6238's published test vectors
 * — if the implementation ever drifts, an authenticator app would stop working
 * and these fail first.
 */

// RFC 6238 Appendix B seed: the ASCII string "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

describe('base32 round-trip', () => {
  it('encodes and decodes back to the original bytes', () => {
    for (const sample of ['', 'a', 'ab', 'abc', 'abcd', 'abcde', 'hello world']) {
      const buf = Buffer.from(sample, 'utf8');
      expect(base32Decode(base32Encode(buf))).toEqual(buf);
    }
  });

  it('rejects invalid characters', () => {
    expect(() => base32Decode('ABC1!')).toThrow();
  });
});

describe('RFC 6238 test vectors (SHA1, 6 digits, 30s)', () => {
  // Appendix B, restricted to the SHA1 rows — truncated to 6 digits.
  const VECTORS: { seconds: number; expected: string }[] = [
    { seconds: 59, expected: '287082' },
    { seconds: 1111111109, expected: '081804' },
    { seconds: 1111111111, expected: '050471' },
    { seconds: 1234567890, expected: '005924' },
    { seconds: 2000000000, expected: '279037' },
  ];

  for (const { seconds, expected } of VECTORS) {
    it(`produces ${expected} at T=${seconds}`, () => {
      expect(totpCode(RFC_SECRET, seconds * 1000)).toBe(expected);
    });
  }
});

describe('verifyTotp', () => {
  const now = 1234567890 * 1000;

  it('accepts the code for the current step', () => {
    expect(verifyTotp(RFC_SECRET, '005924', now)).toBe(true);
  });

  it('tolerates one step of clock drift in each direction', () => {
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 30_000), now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now + 30_000), now)).toBe(true);
  });

  it('rejects a code from outside the window', () => {
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now + 300_000), now)).toBe(false);
  });

  it('rejects wrong, empty and malformed input', () => {
    expect(verifyTotp(RFC_SECRET, '000000', now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, '', now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, '12345', now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, 'abcdef', now)).toBe(false);
  });

  it('ignores separators and spaces the user may paste', () => {
    expect(verifyTotp(RFC_SECRET, '005 924', now)).toBe(true);
  });
});

describe('secret and backup-code generation', () => {
  it('generates distinct, decodable 160-bit secrets', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
    expect(base32Decode(a)).toHaveLength(20);
  });

  it('generates the requested number of unique backup codes', () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('normalises backup codes so formatting never blocks recovery', () => {
    expect(normaliseBackupCode('4f2a-9c7e')).toBe('4F2A9C7E');
    expect(normaliseBackupCode('4F2A 9C7E')).toBe('4F2A9C7E');
  });
});

describe('otpauth URI', () => {
  it('carries the parameters an authenticator app needs', () => {
    const uri = totpAuthUri('JBSWY3DPEHPK3PXP', 'admin@example.com');
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
    expect(uri).toContain(encodeURIComponent('admin@example.com'));
  });
});
