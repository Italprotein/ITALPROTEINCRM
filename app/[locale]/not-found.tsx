import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-navy px-6 text-center text-white">
      <Logo tone="light" />
      <div>
        <p className="font-display text-6xl font-bold text-brand-gold">404</p>
        <h1 className="mt-2 text-xl font-semibold">Page not found · Pagina non trovata</h1>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          The page you are looking for does not exist or has moved.
        </p>
      </div>
      <Link
        href="/en"
        className="rounded-full bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-goldLight"
      >
        Back to home
      </Link>
    </div>
  );
}
