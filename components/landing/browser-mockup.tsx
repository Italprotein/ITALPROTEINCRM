import Image from 'next/image';
import { Lock } from 'lucide-react';

import { cn } from '@/lib/utils';

/*
 * Premium browser frame for the hero's CRM screenshot. Navy chrome in both
 * themes — it frames a light product shot, so it never flips with the page
 * theme — with a glass URL pill and a blue floor-glow underneath. The frame
 * is static markup; any entrance animation belongs on a wrapper, because an
 * `animate-*` with `forwards` fill would permanently override a transform
 * set here (e.g. the hero's rotateX).
 */
export function BrowserMockup({
  src,
  alt,
  url,
  width,
  height,
  className,
}: {
  src: string;
  alt: string;
  url: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <figure className={cn('relative', className)}>
      {/* Floor glow: sits behind and slightly below the frame, so the mockup
          appears lit from beneath rather than outlined. Decoration → brand-blue. */}
      <div
        className="absolute inset-x-8 -bottom-6 top-16 -z-10 rounded-[3rem] bg-brand-blue/25 blur-3xl dark:bg-brand-blueBright/20"
        aria-hidden
      />
      <div className="overflow-hidden rounded-xl border border-brand-navy/15 shadow-[0_44px_120px_-40px_rgba(2,132,199,0.50),0_24px_60px_-30px_rgba(10,22,40,0.45)] ring-1 ring-brand-blueBright/25 dark:border-brand-blueBright/15 sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-white/10 bg-brand-navy/95 px-3.5 py-2.5 backdrop-blur sm:px-5 sm:py-3">
          <span className="flex shrink-0 gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </span>
          <span className="mx-auto flex min-w-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.06] px-3 py-1 font-mono text-[0.625rem] tracking-wide text-brand-blueSoft sm:px-4 sm:text-[0.6875rem]">
            <Lock className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
            <span className="truncate">{url}</span>
          </span>
          {/* Ghost spacer the width of the traffic lights, so the pill's
              mx-auto centres it on the frame rather than on the leftover. */}
          <span className="hidden w-[52px] shrink-0 sm:block" aria-hidden />
        </div>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority
          sizes="(max-width: 1024px) 100vw, 1152px"
          className="w-full bg-brand-navy"
        />
      </div>
    </figure>
  );
}
