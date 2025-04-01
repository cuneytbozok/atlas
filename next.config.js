/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    // Disable ESLint during the build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript checking during the build
    ignoreBuildErrors: true,
  },
  // Add build time environment variables
  env: {
    NEXT_PUBLIC_SKIP_DB_CHECKS: 'true',
    PRISMA_SKIP_DATABASE_CONNECT_CHECK: 'true',
  },
};

module.exports = nextConfig; 