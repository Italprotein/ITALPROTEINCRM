import { cn } from '@/lib/utils';

/** Loading placeholder. Use to compose page-level loading skeletons. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} {...props} />;
}

export { Skeleton };
