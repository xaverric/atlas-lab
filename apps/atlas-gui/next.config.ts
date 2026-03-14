import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@atlas/core'],
  async rewrites() {
    const dmsUrl = process.env.NEXT_PUBLIC_DMS_URL || 'http://localhost:4001';
    const notesUrl = process.env.NEXT_PUBLIC_NOTES_URL || 'http://localhost:4004';
    return [
      {
        source: '/api/v1/files/shares/:token',
        destination: `${dmsUrl}/api/v1/files/shares/:token`,
      },
      {
        source: '/api/v1/dms/shares/:token',
        destination: `${dmsUrl}/api/v1/dms/shares/:token`,
      },
      {
        source: '/api/public/notes/:path*',
        destination: `${notesUrl}/public/notes/:path*`,
      },
      {
        source: '/api/public/folders/:path*',
        destination: `${notesUrl}/public/folders/:path*`,
      },
    ];
  },
};

export default nextConfig;
