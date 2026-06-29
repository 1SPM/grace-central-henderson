import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function copyDirSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDirSync(from, to);
    else fs.copyFileSync(from, to);
  }
}

/** Copy member-portal static demos into dist (Vite public/ does not include repo-root previews). */
function copyMemberPortalDemos(): Plugin {
  return {
    name: 'copy-member-portal-demos',
    closeBundle() {
      const root = process.cwd();
      const dist = path.join(root, 'dist');
      const iosApp = path.join(root, 'grace_central_henderson_members_card_ios_app.html');
      if (fs.existsSync(iosApp)) {
        fs.copyFileSync(iosApp, path.join(dist, path.basename(iosApp)));
      }
      copyDirSync(path.join(root, 'previews'), path.join(dist, 'previews'));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isFaithfulTenant =
    env.VITE_TENANT_DEFAULT === 'faithful' ||
    (env.VITE_TENANT_DEFAULT !== 'central' &&
      env.VITE_ENABLE_DEMO_MODE !== 'true');
  // Default 3010 — 3001/3002 are often taken by other local Vite instances
  const apiTarget = env.VITE_API_PROXY || 'http://127.0.0.1:3010';
  const BUILD_VERSION = Date.now().toString();

  const faithfulHeadExtras = isFaithfulTenant
    ? [
        '    <link rel="preconnect" href="https://fonts.googleapis.com">',
        '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        '    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">',
      ].join('\n')
    : '';

  return {
    define: {
      __GRACE_BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
    },
    plugins: [
      react(),
      {
        name: 'inject-grace-build-version',
        transformIndexHtml(html) {
          let out = html;
          if (isFaithfulTenant) {
            out = out.replace(
              '<meta name="theme-color" content="#EE2B37" />',
              '<meta name="theme-color" content="#449eca" />',
            );
            if (faithfulHeadExtras) {
              out = out.replace('</head>', `${faithfulHeadExtras}\n  </head>`);
            }
          }
          return out.replace(
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
              "media-src 'self' blob: data:; " +
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
              'camera=(), microphone=(self), geolocation=(), payment=(self)'
            );
            next();
          });
        },
      },
      copyMemberPortalDemos(),
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
          cacheId: 'grace-crm-voice-v4',
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
