/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Isolate simultaneous local previews when requested by the dev runner.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    // Tracés et profils d'altitude 2026 lus par /api/clm au runtime.
    outputFileTracingIncludes: {
      '/api/clm': ['./lib/circuits/2026/**'],
    },
  },
};

export default nextConfig;
