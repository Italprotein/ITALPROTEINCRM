import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  /**
   * Keeps the header — and its actions — on screen while the page scrolls.
   * Use on long list pages, where "Add company" would otherwise scroll away
   * and force a trip back to the top.
   */
  sticky?: boolean;
}

/** Consistent page title block used across CRM and portal pages. */
export function PageHeader({ title, subtitle, actions, className, sticky }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        // Sits just under the app topbar. The background and negative margins
        // let it cover the content sliding underneath without a visible seam.
        sticky &&
          'sticky top-16 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8',
        className,
      )}
    >
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
