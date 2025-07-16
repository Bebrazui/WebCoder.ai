import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // This is required for isomorphic-git to work.
  transpilePackages: ['isomorphic-git'],
  // Set output to 'export' for static builds that Electron can use
  output: 'export',
};

export default nextConfig;
