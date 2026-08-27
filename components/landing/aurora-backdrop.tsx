import { cn } from '@/lib/utils';

/*
 * Proamina aurora — the Aceternity "aurora-background" technique rebuilt on
 * the brand palette instead of installing the demo (the lockfile stays
 * untouched; framer-motion is not needed for this, it is pure CSS).
 *
 * Two background images share one element: a repeating band gradient in the
 * four brand blues, and a same-tone "veil" gradient that slices the bands so
 * they shimmer instead of reading as stripes. The `aurora` keyframe drifts
 * both by +300% over 60s — the band layer is 200% wide with a 20% period, so
 * the shift covers whole periods and the loop never visibly restarts.
 *
 * All colour here is DECORATION, hence brand-blue is allowed (see the blue
 * discipline note in app/[locale]/(public)/page.tsx). The radial mask keeps
 * the effect in the upper reach of the hero so it never sits behind body
 * copy at full strength, and the whole thing is aria-hidden + pointer-inert.
 */

const BANDS =
  'repeating-linear-gradient(100deg,#0284C7 10%,#38BDF8 15%,#BAE6FD 20%,#2563EB 25%,#7DD3FC 30%)';
// The veil matches the surface it sits on: white in light mode, brand navy in
// dark — so the "gaps" between bands dissolve into the page background.
const VEIL_LIGHT =
  'repeating-linear-gradient(100deg,#FAFBFC 0%,#FAFBFC 7%,transparent 10%,transparent 12%,#FAFBFC 16%)';
const VEIL_DARK =
  'repeating-linear-gradient(100deg,#0A1628 0%,#0A1628 7%,transparent 10%,transparent 12%,#0A1628 16%)';

function AuroraLayer({ veil, className }: { veil: string; className?: string }) {
  return (
    <div
      style={{
        backgroundImage: `${veil},${BANDS}`,
        backgroundSize: '300% 200%, 200% 100%',
      }}
      className={cn(
        // -inset-[10px]: the blur samples past the element's edge; bleeding it
        // outward hides the resulting soft border at the viewport edges.
        'absolute -inset-[10px] bg-[position:50%_50%,50%_50%] blur-[12px] will-change-[background-position]',
        // Reduced motion parks the drift; a static wash remains, same as the
        // hero's other decorative gradients.
        'motion-safe:animate-aurora motion-reduce:animate-none',
        className,
      )}
    />
  );
}

export function AuroraBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        '[mask-image:radial-gradient(ellipse_120%_70%_at_50%_-5%,black_35%,transparent_80%)]',
        className,
      )}
    >
      {/* Lower opacity on phones: less pixel area for the blur to average
          over, so the same layer reads louder on a small screen. */}
      <AuroraLayer veil={VEIL_LIGHT} className="opacity-25 max-sm:opacity-15 dark:hidden" />
      {/* Dark needs more gain: the same bands over near-black navy read at a
          fraction of their light-mode strength. */}
      <AuroraLayer veil={VEIL_DARK} className="hidden opacity-45 max-sm:opacity-30 dark:block" />
    </div>
  );
}
