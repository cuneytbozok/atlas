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
};

module.exports = nextConfig; 