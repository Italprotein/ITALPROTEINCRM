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
 * `Rail` itself) and the column offsets by the same `26rem` to clear it.
 * Below `lg` the rail renders as a normal static block at the top of the
 * page — a fixed rail on a phone would consume the entire viewport, so no
 * fixed positioning applies there and the column simply follows it in flow.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-navy text-slate-200">
      <Rail />
      <div className="lg:ml-[26rem]">
        <div className="container">{children}</div>
      </div>
    </div>
  );
}
