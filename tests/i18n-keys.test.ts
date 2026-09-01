import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Structural guard on the message catalogues.
 *
 * A missing key is not a type error and not a lint error — it throws
 * MISSING_MESSAGE at render time, in whichever locale is short, on whichever
 * page nobody opened before deploying. That has now cost two production
 * builds: once for a key deleted while a component still read it, and once for
 * a new page whose delete-confirmation strings were never added.
 *
 * Two assertions, both cheap:
 *   1. the two locales carry identical key sets;
 *   2. every `t('…')` a page makes actually resolves in both.
 */

const ROOT = process.cwd();
// Named in full: a bare `it` would shadow vitest's own `it`.
const enMessages = JSON.parse(readFileSync(join(ROOT, 'messages/en.json'), 'utf8')) as Record<string, unknown>;
const itMessages = JSON.parse(readFileSync(join(ROOT, 'messages/it.json'), 'utf8')) as Record<string, unknown>;

/** Flatten to dotted paths so nested namespaces are compared too. */
function flatten(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'generated') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith('.tsx')) out.push(path);
  }
  return out;
}

describe('message catalogues', () => {
  it('carries the same keys in both locales', () => {
    const enKeys = flatten(enMessages).sort();
    const itKeys = flatten(itMessages).sort();

    const missingInIt = enKeys.filter((k) => !itKeys.includes(k));
    const missingInEn = itKeys.filter((k) => !enKeys.includes(k));

    expect(missingInIt, `missing from it.json:\n  ${missingInIt.join('\n  ')}`).toEqual([]);
    expect(missingInEn, `missing from en.json:\n  ${missingInEn.join('\n  ')}`).toEqual([]);
  });

  it('resolves every key a page asks for', () => {
    const files = walk(join(ROOT, 'app'));
    const problems: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');

      // `useTranslations('Namespace')` — a file may hold more than one.
      const namespaces = [...source.matchAll(/useTranslations\(\s*'([A-Za-z0-9_.]+)'\s*\)/g)].map(
        (m) => m[1],
      );
      if (namespaces.length !== 1) continue; // ambiguous or none; skip rather than guess

      const namespace = namespaces[0];
      const enNs = flatten(enMessages[namespace] ?? {}, namespace);
      const itNs = flatten(itMessages[namespace] ?? {}, namespace);

      // Only the plain `t('key')` form — anything computed cannot be checked
      // statically, and guessing at it would produce false failures.
      const used = new Set([...source.matchAll(/\bt\(\s*'([A-Za-z0-9_]+)'/g)].map((m) => m[1]));

      for (const key of used) {
        const path = `${namespace}.${key}`;
        if (!enNs.includes(path)) problems.push(`${file}: en is missing ${path}`);
        if (!itNs.includes(path)) problems.push(`${file}: it is missing ${path}`);
      }
    }

    expect(problems, problems.join('\n')).toEqual([]);
  });
});
