import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@atlas/core'],
  async rewrites() {
    const dmsUrl = process.env.NEXT_PUBLIC_DMS_URL || 'http://localhost:4001';
    return [
      {
        source: '/api/v1/dms/shares/:token',
        destination: `${dmsUrl}/api/v1/dms/shares/:token`,
      },
    ];
  },
};

export default nextConfig;
