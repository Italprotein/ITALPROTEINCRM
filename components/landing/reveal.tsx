'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Scroll-entry reveal without an animation library. One IntersectionObserver
 * per element, disconnected after it fires, and a plain CSS transition — so
 * nothing keeps running once the reveal has settled.
 *
 * Reduced motion is handled entirely by the `motion-safe:` variants below: the
 * hidden state never applies for those users, so the content is visible from
 * first paint whether or not the observer ever fires.
 *
 * Deliberately not used above the fold: the hero renders as static HTML so it
 * paints on the first frame instead of waiting for hydration.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { rootMargin: '-64px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
        shown ? 'translate-y-0 opacity-100' : 'motion-safe:translate-y-5 motion-safe:opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
