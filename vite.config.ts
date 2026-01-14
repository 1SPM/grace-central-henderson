import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Security headers plugin for development server
    {
      name: 'security-headers',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          // Content Security Policy
          res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://*.clerk.accounts.dev; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data: https: blob:; " +
            "connect-src 'self' https://*.supabase.co https://api.resend.com https://api.twilio.com https://api.stripe.com https://*.clerk.accounts.dev wss://*.supabase.co; " +
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
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
  server: {
    port: 3000,
    proxy: {
      // Proxy API requests to the backend server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/webhooks': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  }
});
