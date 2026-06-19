import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  /** 'full' = mark + wordmark, 'mark' = image only, 'wordmark' = text only */
  variant?: 'full' | 'mark' | 'wordmark';
  /** 'light' for dark backgrounds (navy sidebar/auth), 'dark' for light backgrounds */
  tone?: 'light' | 'dark';
  className?: string;
  showProduct?: boolean;
}

/**
 * Italprotein brand lockup. The official "OFFICIAL DISTRIBUTORS" logo is a
 * raster asset, so on dark surfaces we render a crisp typographic wordmark in
 * brand colours and reserve the image for light surfaces.
 */
export function Logo({ variant = 'full', tone = 'dark', className, showProduct = true }: LogoProps) {
  const navy = tone === 'light';

  if (variant === 'mark') {
    return (
      <span className={cn('inline-flex items-center justify-center', className)}>
        <Image src="/brand/italprotein-logo.jpeg" alt="Italprotein" width={36} height={36} className="rounded-full" priority />
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-baseline gap-1.5 font-display', className)}>
      <span className={cn('text-lg font-bold tracking-tight', navy ? 'text-white' : 'text-brand-navy')}>
        ITAL<span className="text-brand-molecular">PROTE</span>IN
      </span>
      {showProduct && (
        <span className={cn('font-sans text-2xs font-semibold uppercase tracking-[0.16em]', navy ? 'text-brand-gold' : 'text-brand-goldDark')}>
          · Proamina®
        </span>
      )}
    </span>
  );
}
