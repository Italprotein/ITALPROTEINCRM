import { notFound } from 'next/navigation';

// Every portal section has its own page, so any unmatched /portal/* path is a
// genuine 404 rather than an "under construction" screen.
export default function PortalCatchAll() {
  notFound();
}
