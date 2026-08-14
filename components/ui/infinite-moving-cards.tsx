'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';

import { cn } from '@/lib/utils';

type PartnerItem = {
  logo?: string;
  name: string;
  title?: string;
};

const SPEEDS = {
  fast: '28s',
  normal: '48s',
  slow: '80s',
} as const;

export function InfiniteMovingCards({
  items,
  direction = 'left',
  speed = 'fast',
  pauseOnHover = true,
  className,
  ariaLabel = 'Partner logos',
}: {
  items: PartnerItem[];
  direction?: 'left' | 'right';
  speed?: keyof typeof SPEEDS;
  pauseOnHover?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const animationStyle: CSSProperties = {
    animationDuration: SPEEDS[speed],
    animationDirection: direction === 'left' ? 'normal' : 'reverse',
  };

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'group relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)]',
        'motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <div
        style={animationStyle}
        className={cn(
          'flex w-max animate-marquee will-change-transform motion-reduce:animate-none motion-reduce:transform-none motion-reduce:will-change-auto',
          pauseOnHover && 'group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]',
        )}
      >
        {[0, 1].map((track) => (
          <ul
            key={track}
            aria-hidden={track === 1 ? true : undefined}
            className={cn(
              'flex shrink-0 flex-nowrap gap-4 py-3 pr-4 sm:gap-5 sm:pr-5',
              track === 1 && 'motion-reduce:hidden',
            )}
          >
            {items.map((item) => (
              <li
                key={`${track}-${item.name}`}
                className="group/logo flex h-24 w-40 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-card p-2 shadow-xs transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-md motion-reduce:transform-none sm:h-28 sm:w-48"
              >
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg bg-white px-5 py-3">
                  {item.logo ? (
                    <Image
                      src={item.logo}
                      alt={item.name}
                      width={160}
                      height={64}
                      sizes="(max-width: 640px) 8rem, 10rem"
                      // Desaturated at rest so the wall of partner marks reads
                      // as one calm band instead of a dozen competing brand
                      // palettes; the hovered tile is the only one in colour.
                      // Reduced motion gets full colour permanently rather than
                      // a filter that animates on approach.
                      className="max-h-10 w-auto max-w-full object-contain grayscale transition-[transform,filter] duration-300 group-hover/logo:scale-[1.04] group-hover/logo:grayscale-0 motion-reduce:grayscale-0 motion-reduce:transform-none sm:max-h-12"
                    />
                  ) : (
                    <span className="text-center text-sm font-semibold text-brand-navy">{item.name}</span>
                  )}
                  {item.title ? (
                    <span className="font-mono text-[0.5625rem] font-medium uppercase tracking-[0.16em] text-slate-500">
                      {item.title}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
