/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Re-enabled ESLint during builds
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Re-enabled type checking during builds
    ignoreBuildErrors: false,
  },
  webpack: (config) => {
    // Handle canvas and other node modules if needed
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
