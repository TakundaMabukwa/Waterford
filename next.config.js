/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    workerThreads: false
  },
  compress: false,
  productionBrowserSourceMaps: false,
  webpack: (config) => {
    config.optimization.minimize = false
    config.cache = false
    return config
  }
}

module.exports = nextConfig
