import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The prototype ships with local mock data only — no remote images needed.
  images: {
    remotePatterns: [],
  },
};

export default withNextIntl(nextConfig);
