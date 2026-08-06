import type { ReactNode } from 'react';

import { Rail } from '@/components/public/rail';

/**
 * The shared frame for every public-facing screen — the landing page and the
 * six auth screens (Task 2 and Task 3 render inside it).
 *
 * A fixed instrument rail sits beside a scrolling column instead of the usual
 * stacked marketing sections: the rail carries identity, the two doors and
 * contact permanently, so the column never needs to repeat a call to action
 * just because the reader scrolled past the last one.
 *
 * At `lg` and above the rail pins to the left edge (`lg:fixed`, defined on
 * `Rail` itself) and the column offsets by the same `25rem` to clear it.
 * Below `lg` the rail renders as a normal static block at the top of the
 * page — a fixed rail on a phone would consume the entire viewport, so no
 * fixed positioning applies there and the column simply follows it in flow.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground transition-colors duration-300 motion-reduce:transition-none">
      {/* A quiet analytical field: the offset planes echo chromatography
          traces without turning the auth surface into a decorative hero. */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,rgba(2,132,199,0.10),transparent_32%),linear-gradient(135deg,transparent_0%,transparent_63%,rgba(56,189,248,0.045)_63%,rgba(56,189,248,0.045)_78%,transparent_78%)] dark:bg-[radial-gradient(circle_at_82%_12%,rgba(56,189,248,0.09),transparent_30%),linear-gradient(135deg,transparent_0%,transparent_63%,rgba(56,189,248,0.035)_63%,rgba(56,189,248,0.035)_78%,transparent_78%)]" />
        <div className="absolute bottom-12 right-0 h-px w-[38vw] bg-gradient-to-l from-brand-goldDark/30 to-transparent dark:from-brand-gold/20" />
      </div>
      <Rail />
      <main className="relative lg:pl-[25rem]">
        <div className="mx-auto flex w-full max-w-[78rem] items-start px-4 py-6 sm:px-8 sm:py-10 lg:min-h-[calc(100vh-1px)] lg:items-center lg:px-12 lg:py-12 xl:px-16">
          <div className="w-full">{children}</div>
        </div>
      </main>
    </div>
  );
}
