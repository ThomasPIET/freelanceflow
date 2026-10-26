import type { NextConfig } from 'next';

// Les rewrites sont figés au build : ces URL sont des ARG du Dockerfile.
const backendUrl = process.env.BACKEND_URL ?? 'http://backend:3000';
const usersServiceUrl =
  process.env.USERS_SERVICE_URL ?? 'http://users-service:8000';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/api/users', destination: `${usersServiceUrl}/users` },
      {
        source: '/api/users/:path*',
        destination: `${usersServiceUrl}/users/:path*`,
      },
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
    ];
  },
};

export default nextConfig;
