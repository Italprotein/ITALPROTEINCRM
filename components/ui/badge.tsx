import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        // text-success/-subtle measured 3.44:1 (light) / 3.33:1 (dark) — below
        // 4.5:1 in both themes. text-success-text is tuned for this surface.
        success: 'border-transparent bg-success-subtle text-success-text',
        // text-warning-foreground/-subtle measured 1.19:1 in dark (warning-foreground
        // is never redefined in .dark, so it stays near-black on a near-black
        // subtle fill). text-warning-text is tuned per-theme for this surface.
        warning: 'border-transparent bg-warning-subtle text-warning-text',
        // text-danger/-subtle measured 4.29:1 (light, just under 4.5) / 2.92:1
        // (dark). text-danger-text is tuned for this surface in both themes.
        danger: 'border-transparent bg-danger-subtle text-danger-text',
        // text-info/-subtle measured 2.74:1 in dark (--info is never redefined
        // in .dark). No dedicated --info-text token exists yet (would need new,
        // unprescribed brand values — flagged in the task report instead), so
        // this variant gets a minimal dark: override with the existing
        // brand-blueBright hex already used for other dark-mode accents
        // (6.65:1 measured on info-subtle dark); light is unchanged (4.60:1).
        info: 'border-transparent bg-info-subtle text-info dark:text-brand-blueBright',
        // text-brand-goldDark on bg-brand-gold/15 measured 3.65:1 (light) /
        // 3.38:1 (dark) — goldDark (#0284c7) isn't dark enough for this small
        // text at any alpha over either surface (verified: even 100% opaque
        // white card only reaches 4.10:1). Swapped to the same text pairing
        // Button's own "gold" variant already uses for its solid gold fill —
        // brand-navy for light (16.15:1) — plus brand-blueBright for dark,
        // which this translucent fill needs since it inherits the dark card's
        // near-black tint (6.46:1). Bg utility untouched — same chip family.
        gold: 'border-transparent bg-brand-gold/15 text-brand-navy dark:text-brand-blueBright',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
