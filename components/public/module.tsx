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
      <span className="h-3 w-px bg-brand-goldDark dark:bg-brand-gold" aria-hidden />
      <Designation className="text-brand-molecular dark:text-brand-gold">{label}</Designation>
      <span className="h-px flex-1 bg-border" aria-hidden />
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground" aria-hidden>
        ITALPROTEIN / PROAMINA
      </span>
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
    <section
      className={cn(
        'relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-border/80 bg-card/95 px-5 py-7 text-card-foreground shadow-lg shadow-brand-navy/[0.06] backdrop-blur-sm ',
        'motion-safe:animate-fade-up dark:shadow-black/20 sm:px-8 sm:py-9 lg:px-10 lg:py-10',
        className,
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-navy via-brand-goldDark to-brand-gold dark:from-brand-goldDark dark:via-brand-gold dark:to-brand-teal"
        aria-hidden
      />
      <ModuleRule label={designation} />
      {/* Several secondary public flows predate theme tokens. These scoped
          compatibility selectors keep their existing logic and markup usable
          in light mode while the shared shell moves to semantic surfaces. */}
      <div
        className={
          'mt-8 text-foreground ' +
          '[&_:not(button).text-white]:!text-foreground [&_.text-slate-200]:!text-foreground ' +
          '[&_.text-slate-300]:!text-foreground [&_.text-slate-400]:!text-muted-foreground ' +
          '[&_.text-slate-500]:!text-muted-foreground [&_.border-white\\/10]:!border-border ' +
          '[&_.border-white\\/15]:!border-border [&_.text-brand-goldLight]:!text-brand-molecular ' +
          'dark:[&_.text-brand-goldLight]:!text-brand-gold'
        }
      >
        {children}
      </div>
    </section>
  );
}
