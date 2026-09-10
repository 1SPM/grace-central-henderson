import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Same shared backend as apps/admin-web — see the M2/M3 decision to keep
  // one api/ at the repo root, deployed by both Vercel projects.
  const apiTarget = env.VITE_API_PROXY || 'http://127.0.0.1:3010';
  const BUILD_VERSION = Date.now().toString();

  return {
    define: {
      __GRACE_BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
    },
    plugins: [
      react(),
      {
        name: 'inject-grace-build-version',
        transformIndexHtml(html) {
          return html.replace(
            '</head>',
            `    <meta name="grace-build" content="${BUILD_VERSION}" />\n  </head>`,
          );
        },
      },
      // Mirrors apps/admin-web's dev security headers.
      {
        name: 'security-headers',
        configureServer(server) {
          server.middlewares.use((_req, res, next) => {
            res.setHeader(
              'Content-Security-Policy',
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.i.posthog.com; " +
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
              "font-src 'self' https://fonts.gstatic.com; " +
              "img-src 'self' data: https: blob:; " +
              "connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.clerk.accounts.dev wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://*.i.posthog.com; " +
              "frame-src 'self' https://js.stripe.com https://*.clerk.accounts.dev; " +
              "frame-ancestors 'none';"
            );
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
            next();
          });
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/*.svg'],
        manifest: {
          name: 'GRACE Members',
          short_name: 'GRACE',
          description: 'Your church member portal — giving, care, prayer, community, and your journey.',
          theme_color: '#e11d48',
          background_color: '#fafaf9',
          display: 'standalone',
          icons: [
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
            { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          ],
        },
        workbox: {
          cacheId: 'grace-members-v1',
          // See apps/admin-web/vite.config.ts's identical comment: precaching
          // index.html risks serving a stale shell pointing at asset hashes
          // that no longer exist after a deploy. Vercel already serves
          // index.html as no-cache, so letting navigations hit the network
          // is correct and cheap.
          globPatterns: ['**/*.{js,css,svg,png,ico,woff,woff2}'],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
          },
        },
      },
    },
    server: {
      port: 3020,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          bypass: (req) => (req.url?.startsWith('/api/_lib/') ? req.url : undefined),
        },
        '/webhooks': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
