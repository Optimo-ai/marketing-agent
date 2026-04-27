/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { 
    serverActions: { allowedOrigins: ['*'] },
    serverComponentsExternalPackages: ['@napi-rs/canvas']
  }
}
module.exports = nextConfig
