import { Skeleton } from '@/components/ui/skeleton';

/**
 * Route-level loading UI for every /admin page.
 *
 * Without this, Next has nothing to show while a route's chunk and data are in
 * flight, so clicking a nav item leaves the *previous* page on screen and the
 * app reads as frozen. This renders instantly on navigation and is replaced the
 * moment the page is ready — the single cheapest perceived-performance win.
 *
 * Shaped like the list pages it most often stands in for: header, KPI row, table.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      <div className="space-y-2 rounded-xl border p-4">
        <Skeleton className="h-9 w-full max-w-sm" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
