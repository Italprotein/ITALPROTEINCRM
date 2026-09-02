import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/*
 * Structural safety net for the server-action layer.
 *
 * Every file in lib/services/*.actions.ts is marked "use server", which makes
 * each exported function a publicly reachable POST endpoint. Middleware does NOT
 * cover server actions, so the ONLY thing standing between an anonymous caller
 * and the database is an explicit guard inside the function body.
 *
 * These tests read the source and assert that property directly. They cannot be
 * satisfied by accident, they need no database, and they fail loudly the moment
 * someone adds an action without a guard or reverts a company-scoped lookup back
 * to a raw findUnique (the IDOR class of bug).
 */

const SERVICES_DIR = path.resolve(__dirname, '..', 'lib', 'services');

/** Throwing guards from lib/backend/session.ts. Any one authenticates the call. */
const GUARDS = [
  'requireUser',
  'requireInternal',
  'requireSection',
  'requireSectionEdit',
  'requireAction',
];

/**
 * Actions that MUST stay reachable without a session, because the user has no
 * session yet when they call them. Each is authenticated by something other than
 * a cookie — a signed token, or a rate-limited public form. Adding to this list
 * is a deliberate security decision, not a convenience.
 */
const INTENTIONALLY_PUBLIC: Record<string, string> = {
  'auth.actions.ts:requestPasswordReset':
    'You are logged out when you forget your password. Rate-limited and does not reveal whether an account exists.',
  'auth.actions.ts:confirmPasswordReset':
    'Authenticated by the emailed single-use reset token, not by a session.',
  'auth.actions.ts:acceptAccountInvitation':
    'Authenticated by the emailed invitation token — the account has no password yet.',
  'registration.actions.ts:createRegistration':
    'The public /register form. Creates a pending registration only; approval is guarded.',
  'auth.actions.ts:getPasswordChangeRequired':
    'Reports whether the CALLER must change their password. Cannot use requireUser(), ' +
    'which throws PASSWORD_CHANGE_REQUIRED in exactly the state this reports. Takes no ' +
    'input, reads only the caller\'s own session, and returns false when there is none — ' +
    'so an anonymous caller learns nothing about any account.',
};

/**
 * Actions with no guard of their own because they immediately delegate to a
 * guarded action. The delegate is asserted to be guarded below, so this cannot
 * rot into a real hole.
 */
const GUARDED_BY_DELEGATION: Record<string, string> = {
  'user.actions.ts:createUser': 'inviteStaff',
};

/** `getCurrentUser()` + an explicit unauthenticated rejection is also a guard. */
function guardsViaCurrentUser(body: string): boolean {
  return body.includes('getCurrentUser(') && body.includes('unauthenticated');
}

function isGuarded(fn: ExportedFn): boolean {
  return GUARDS.some((g) => fn.body.includes(`${g}(`)) || guardsViaCurrentUser(fn.body);
}

interface ExportedFn {
  file: string;
  name: string;
  body: string;
}

/**
 * Slice out the body of each `export async function`.
 *
 * Naive "first { after the name" is wrong: a default parameter value
 * (`query: CompanyQuery = {}`) or a return type (`Promise<{ x: string }[]>`)
 * both contain braces before the body starts. So we step over the parameter
 * list by matching parentheses, then take the first brace that sits outside any
 * angle brackets — that is the real body.
 */
function exportedFunctions(source: string, file: string): ExportedFn[] {
  const found: ExportedFn[] = [];
  const signature = /export\s+async\s+function\s+([A-Za-z0-9_]+)/g;
  let match: RegExpExecArray | null;

  while ((match = signature.exec(source)) !== null) {
    // 1. Step over the parameter list.
    const paramStart = source.indexOf('(', match.index);
    if (paramStart === -1) continue;
    let parens = 0;
    let paramEnd = -1;
    for (let i = paramStart; i < source.length; i++) {
      if (source[i] === '(') parens++;
      else if (source[i] === ')') {
        parens--;
        if (parens === 0) {
          paramEnd = i;
          break;
        }
      }
    }
    if (paramEnd === -1) continue;

    // 2. Skip the return type: the body brace is the first one at angle-depth 0.
    let angle = 0;
    let open = -1;
    for (let i = paramEnd + 1; i < source.length; i++) {
      const ch = source[i];
      if (ch === '<') angle++;
      else if (ch === '>') angle = Math.max(0, angle - 1);
      else if (ch === '{' && angle === 0) {
        open = i;
        break;
      }
    }
    if (open === -1) continue;

    // 3. Match braces to find the end of the body.
    let depth = 0;
    let end = open;
    for (let i = open; i < source.length; i++) {
      const ch = source[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    found.push({ file, name: match[1], body: source.slice(open, end + 1) });
  }
  return found;
}

function actionFiles(): string[] {
  return fs
    .readdirSync(SERVICES_DIR)
    .filter((f) => f.endsWith('.actions.ts'))
    .map((f) => path.join(SERVICES_DIR, f));
}

const ALL_ACTIONS: ExportedFn[] = actionFiles().flatMap((file) =>
  exportedFunctions(fs.readFileSync(file, 'utf8'), path.basename(file)),
);

describe('server-action layer', () => {
  it('finds the action files (guards against a silently empty test)', () => {
    expect(actionFiles().length).toBeGreaterThan(10);
    expect(ALL_ACTIONS.length).toBeGreaterThan(100);
  });

  it('marks every actions file "use server"', () => {
    for (const file of actionFiles()) {
      const head = fs.readFileSync(file, 'utf8').slice(0, 200);
      expect(head, `${path.basename(file)} must declare "use server"`).toMatch(/["']use server["']/);
    }
  });

  it('guards every exported server action against anonymous callers', () => {
    const unguarded = ALL_ACTIONS.filter((fn) => {
      const key = `${fn.file}:${fn.name}`;
      if (key in INTENTIONALLY_PUBLIC || key in GUARDED_BY_DELEGATION) return false;
      return !isGuarded(fn);
    }).map((fn) => `${fn.file}:${fn.name}`);

    expect(
      unguarded,
      `These server actions reach the database with no auth guard.\n` +
        `Add a guard from lib/backend/session.ts, or — if it must be public —\n` +
        `add it to INTENTIONALLY_PUBLIC with a written justification:\n  ${unguarded.join('\n  ')}`,
    ).toEqual([]);
  });

  it('keeps every delegated action pointing at a genuinely guarded delegate', () => {
    for (const [key, delegate] of Object.entries(GUARDED_BY_DELEGATION)) {
      const [file, name] = key.split(':');
      const caller = ALL_ACTIONS.find((f) => f.file === file && f.name === name);
      expect(caller, `${key} no longer exists — drop it from GUARDED_BY_DELEGATION`).toBeDefined();
      expect(caller!.body, `${key} must still delegate to ${delegate}`).toContain(`${delegate}(`);

      const target = ALL_ACTIONS.find((f) => f.file === file && f.name === delegate);
      expect(target, `${file}:${delegate} not found`).toBeDefined();
      expect(isGuarded(target!), `${file}:${delegate} must itself be guarded`).toBe(true);
    }
  });

  it('keeps the public allowlist free of stale entries', () => {
    for (const key of Object.keys(INTENTIONALLY_PUBLIC)) {
      const [file, name] = key.split(':');
      const fn = ALL_ACTIONS.find((f) => f.file === file && f.name === name);
      expect(fn, `${key} is allowlisted as public but no longer exists — remove it`).toBeDefined();
    }
  });
});

describe('company scoping on writes (IDOR regression)', () => {
  /**
   * These writes are reachable by external portal users, so they must constrain
   * the target row to the caller's own company. A bare findUnique({ where: { id } })
   * here means a portal user can edit another company's record by guessing an id.
   */
  const MUST_SCOPE: Record<string, string> = {
    'company.actions.ts': 'updateCompany',
    'contact.actions.ts': 'updateContact',
    'support.actions.ts': 'updateSupportRequest',
  };

  for (const [file, name] of Object.entries(MUST_SCOPE)) {
    it(`${name} constrains the target with scopeWhere()`, () => {
      const fn = ALL_ACTIONS.find((f) => f.file === file && f.name === name);
      expect(fn, `${file}:${name} not found`).toBeDefined();
      expect(fn!.body, `${name} must scope its lookup`).toContain('scopeWhere()');
      expect(
        fn!.body,
        `${name} must not look the row up by raw id — use a scoped findFirst`,
      ).not.toMatch(/findUnique\(\{\s*where:\s*\{\s*id\s*\}/);
    });
  }

  it('createContact pins a portal author to their own company', () => {
    const fn = ALL_ACTIONS.find((f) => f.file === 'contact.actions.ts' && f.name === 'createContact');
    expect(fn).toBeDefined();
    // Portal owners lack contact.edit, so the company must come from the session.
    expect(fn!.body).toContain('actor.companyId');
  });
});

/*
 * A "use server" file may export ONLY async functions.
 *
 * The server-action transform emits a runtime binding for every export it
 * finds. A type-only re-export — `export type { Foo }` — has already been
 * erased by TypeScript, so the emitted binding points at nothing and the module
 * throws `ReferenceError: Foo is not defined` the moment it is evaluated. That
 * takes down every page reaching the module through lib/mock-services.
 *
 * It happened, on the companies list, and nothing caught it: the failure is
 * runtime-only, so typecheck, lint and `next build` are all silent. Hence a
 * source-level assertion.
 *
 * `export type Foo = ...` (a declaration, not a re-export of a binding) is
 * fine and is used widely for the discriminated result types.
 */
describe('server-action files export only async functions', () => {
  const files = fs
    .readdirSync(SERVICES_DIR)
    .filter((f) => f.endsWith('.actions.ts'));

  it('has action files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} re-exports no type bindings`, () => {
      const source = fs.readFileSync(path.join(SERVICES_DIR, file), 'utf8');
      if (!/^\s*['"]use server['"]/m.test(source)) return;

      // `export type { X }` and `export { type X }` both re-export a binding
      // the transform will try to emit at runtime.
      const reexports = [
        ...source.matchAll(/^\s*export\s+type\s*\{[^}]*\}/gm),
        ...source.matchAll(/^\s*export\s*\{\s*type\s[^}]*\}/gm),
      ].map((m) => m[0].trim());

      expect(
        reexports,
        `${file} re-exports a type from a "use server" file. TypeScript erases ` +
          `the binding but the server-action transform still emits it, so the ` +
          `module throws ReferenceError at evaluation. Import the type straight ` +
          `from the module that declares it instead.`,
      ).toEqual([]);
    });
  }
});
