import { notFound } from 'next/navigation';

// Every navigable admin section has its own page, so any unmatched /admin/*
// path is a genuine 404 (mistyped or stale URL) — not an "under construction"
// screen. Render the not-found boundary.
export default function AdminCatchAll() {
  notFound();
}
