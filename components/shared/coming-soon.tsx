import { Hammer } from 'lucide-react';

interface ComingSoonProps {
  title: string;
  body: string;
  phaseLabel: string;
}

/** Polished placeholder for sections whose navigation + permissions exist but
 *  whose UI is scheduled for a later build phase. */
export function ComingSoon({ title, body, phaseLabel }: ComingSoonProps) {
  return (
    <div className="p-6 sm:p-8">
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-xl border border-dashed bg-card px-8 py-16 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-navy text-brand-gold">
          <Hammer className="h-6 w-6" />
        </div>
        <span className="mt-5 inline-flex items-center rounded-full bg-brand-gold/15 px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-brand-goldDark">
          {phaseLabel}
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
