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
 * How it stays cheap:
 *  - no state and no re-render — `pointermove` writes two CSS custom
 *    properties straight onto the node, and CSS paints the gradient;
 *  - one queued rAF at a time, so a 1000 Hz mouse still costs one write per
 *    frame;
 *  - the overlay's opacity is driven by `group-hover`, not JS, so nothing runs
 *    while the pointer is elsewhere on the page.
 *
 * Reduced motion removes the overlay entirely (`motion-reduce:hidden`) rather
 * than freezing it mid-fade. Touch devices never fire hover, so the overlay
 * simply stays invisible there — acceptable, since it carries no content: it
 * is `aria-hidden` decoration and holds nothing focusable.
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

  React.useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
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
      {children}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:hidden"
        style={{
          background:
            'radial-gradient(24rem circle at var(--sx) var(--sy), rgb(56 189 248 / 0.10), transparent 65%)',
        }}
      />
    </figure>
  );
}
