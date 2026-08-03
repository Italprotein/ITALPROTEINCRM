import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/*
 * Instrument-panel treatments shared by every module in the public column.
 *
 * Moved here from app/[locale]/page.tsx, where they were first written for the
 * landing page alone. `Rail` and the column modules (Task 2) both need them,
 * so they live in the shared components/public tree instead of being
 * duplicated or exported out of a page file.
 */

/** Instrument label voice: small, wide-tracked, monospace. */
export function Designation({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('font-mono text-[0.6875rem] uppercase tracking-[0.18em]', className)}>
      {children}
    </p>
  );
}

/** A module rule: hairline with a lit tick at its head. */
export function ModuleRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-2.5 w-px bg-sky-400" aria-hidden />
      <Designation className="text-sky-300/90">{label}</Designation>
      <span className="h-px flex-1 bg-white/10" aria-hidden />
    </div>
  );
}

/**
 * One content module in the public column: a mono designation with its
 * hairline-and-lit-tick rule, then the module's own content below.
 *
 * `last:border-b-0` assumes modules sit as direct siblings in the column (the
 * shape `PublicShell` provides) — the hairline separates one module from the
 * next, and the final module doesn't need a trailing rule before the footer.
 */
export function Module({
  designation,
  children,
  className,
}: {
  designation: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border-b border-white/10 py-14 last:border-b-0 sm:py-16', className)}>
      <ModuleRule label={designation} />
      <div className="mt-8">{children}</div>
    </section>
  );
}
