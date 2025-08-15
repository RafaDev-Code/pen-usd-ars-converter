const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: { document: '/offline' },
  runtimeCaching: [
    {
      // cache de nuestras API
      urlPattern: /\/api\/(forex|ars).*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 3,
        expiration: { maxAgeSeconds: 60, maxEntries: 50 },
        cacheableResponse: { statuses: [0, 200] }
      }
    },
    {
      // cache para proveedores externos
      urlPattern: /^https:\/\/(api\.exchangerate\.host|api\.frankfurter\.app|criptoya\.com|dolarapi\.com)\/.*$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'providers-cache',
        networkTimeoutSeconds: 3,
        expiration: { maxAgeSeconds: 60, maxEntries: 50 },
        cacheableResponse: { statuses: [0, 200] }
      }
    }
  ]
});

module.exports = withPWA({
  reactStrictMode: true
});