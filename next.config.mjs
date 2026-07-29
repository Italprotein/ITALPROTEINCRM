import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The prototype ships with local mock data only — no remote images needed.
  images: {
    remotePatterns: [],
  },
  experimental: {
    // These packages are barrels: `import { Building2 } from 'lucide-react'`
    // nominally reaches a module that re-exports well over a thousand icons.
    // Rewriting such imports to their concrete paths cuts what the bundler has
    // to walk, which shows up both as smaller route chunks in production and as
    // noticeably faster first-compile in development.
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns', 'framer-motion'],
  },
};

export default withNextIntl(nextConfig);
