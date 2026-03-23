/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['lowdb', 'bitcoinjs-message', 'bitcoinjs-lib']
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
        stream: false,
        buffer: false,
      };
    }

    return config;
  },
  env: {
    NEXT_PUBLIC_APP_NAME: 'Galactica Lending Bot',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  }
};

module.exports = nextConfig;
