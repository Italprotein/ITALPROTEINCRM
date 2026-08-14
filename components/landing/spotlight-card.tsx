'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The hero figure, with a soft light that follows the pointer across it.
 *
 * Deliberately the only pointer-driven effect on the public page. It is a
 * `<figure>` because it has exactly one caller — the landing hero — and
 * wrapping that element in an extra `<div>` would put a non-semantic node
 * between the figure and its `<figcaption>`.
 *
 * For the same reason the overlay is rendered BEFORE `{children}`: HTML
 * requires `<figcaption>` to be the figure's first or last child, and the
 * caller's caption is the last thing it passes in — appending the overlay
 * after it would strand the caption in the middle and break the positional
 * caption/figure association some parsers and ATs rely on. Painting order is
 * unaffected: every other layer in the figure is positioned with `z-index:
 * auto`, so `z-10` here puts the light above all of them regardless of where
 * it sits in the DOM.
 *
 * How it stays cheap:
 *  - it does nothing at all unless the effect is actually visible — the
 *    handler returns immediately for non-mouse pointers (touch/pen fire
 *    `pointermove` while dragging but never resolve `:hover`) and for anyone
 *    who asked for reduced motion, before scheduling a frame or reading
 *    layout;
 *  - no state and no re-render — `pointermove` writes two CSS custom
 *    properties straight onto the node, and CSS paints the gradient;
 *  - one queued rAF at a time, so a 1000 Hz mouse still costs one layout read
 *    and two property writes per frame;
 *  - the overlay's opacity is driven by `group-hover`, not JS, so nothing runs
 *    while the pointer is elsewhere on the page.
 *
 * Reduced motion removes the overlay entirely (`motion-reduce:hidden`) rather
 * than freezing it mid-fade, and — per the guard above — stops the handler
 * doing per-frame layout reads to feed a `display:none` element. Touch devices
 * never resolve hover, so the overlay simply stays invisible there —
 * acceptable, since it carries no content: it is `aria-hidden` decoration and
 * holds nothing focusable.
 */
export function SpotlightCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLElement>(null);
  const frame = React.useRef(0);
  const point = React.useRef({ x: 0, y: 0 });
  // Created once, then read live — a MediaQueryList keeps `.matches` in sync
  // with the OS setting, so this still respects a mid-session change without
  // a listener or a re-render.
  const reduceMotion = React.useRef<MediaQueryList | null>(null);

  React.useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    // Bail before doing any work when the overlay cannot be seen anyway: touch
    // and pen fire `pointermove` on drag but never resolve `:hover`, and
    // reduced motion sets `display:none` on it. Both cases would otherwise pay
    // a forced layout read every frame for nothing.
    if (event.pointerType !== 'mouse') return;
    if (!reduceMotion.current) {
      reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)');
    }
    if (reduceMotion.current.matches) return;

    point.current = { x: event.clientX, y: event.clientY };
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      node.style.setProperty('--sx', `${point.current.x - rect.left}px`);
      node.style.setProperty('--sy', `${point.current.y - rect.top}px`);
    });
  }, []);

  return (
    <figure
      ref={ref}
      onPointerMove={handlePointerMove}
      // Centre the light before the first pointer event, so a hover that
      // starts on an already-loaded page never flashes from the top-left.
      style={{ '--sx': '50%', '--sy': '50%' } as React.CSSProperties}
      className={cn('group', className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:hidden"
        style={{
          background:
            'radial-gradient(24rem circle at var(--sx) var(--sy), rgb(56 189 248 / 0.10), transparent 65%)',
        }}
      />
      {children}
    </figure>
  );
}
