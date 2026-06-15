import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Default 3010 — 3001/3002 are often taken by other local Vite instances
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
      // Security headers plugin for development server
      {
        name: 'security-headers',
        configureServer(server) {
          server.middlewares.use((_req, res, next) => {
            // Content Security Policy
            res.setHeader(
              'Content-Security-Policy',
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.i.posthog.com; " +
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
              "font-src 'self' https://fonts.gstatic.com; " +
              "img-src 'self' data: https: blob:; " +
              "connect-src 'self' https://*.supabase.co https://api.resend.com https://api.twilio.com https://api.stripe.com https://*.clerk.accounts.dev wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://*.i.posthog.com; " +
              "frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com https://*.clerk.accounts.dev; " +
              "frame-ancestors 'none';"
            );
            // Prevent clickjacking
            res.setHeader('X-Frame-Options', 'DENY');
            // Prevent MIME type sniffing
            res.setHeader('X-Content-Type-Options', 'nosniff');
            // Enable XSS filter
            res.setHeader('X-XSS-Protection', '1; mode=block');
            // Control referrer information
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            // Permissions policy
            res.setHeader(
              'Permissions-Policy',
              'camera=(), microphone=(), geolocation=(), payment=(self)'
            );
            next();
          });
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/*.svg'],
        manifest: {
          name: 'GRACE Church CRM',
          short_name: 'GRACE',
          description: 'Church CRM for Growth, Relationships, Attendance, Community, and Engagement',
          theme_color: '#6366f1',
          background_color: '#18181b',
          display: 'standalone',
          icons: [
            {
              src: '/favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: '/icons/icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: '/icons/icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any'
            }
          ]
        },
        workbox: {
          cacheId: 'grace-crm-crisis-dispatch-v3',
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-icons': ['lucide-react'],
            'vendor-supabase': ['@supabase/supabase-js'],
          },
        },
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
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
