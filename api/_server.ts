/**
 * Grace CRM - Backend API Server
 *
 * Handles secure processing for:
 * - Stripe payment processing
 * - Resend email sending
 * - Twilio SMS messaging
 * - AI Agent orchestration
 *
 * This server should be run separately from the frontend.
 *
 * Environment variables required:
 * - STRIPE_SECRET_KEY: Your Stripe secret key
 * - STRIPE_WEBHOOK_SECRET: Webhook signing secret
 * - RESEND_API_KEY: Your Resend API key
 * - TWILIO_ACCOUNT_SID: Your Twilio Account SID
 * - TWILIO_AUTH_TOKEN: Your Twilio Auth Token
 * - TWILIO_FROM_NUMBER: Your Twilio phone number
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_KEY: Supabase service role key
 * - PORT: Server port (default 3001)
 */

// MUST be the first side-effect import — runs Sentry.init() at module
// top level, before Express or http are evaluated. See api/instrument.ts.
import { Sentry, sentryEnabled } from './instrument.js';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Import route modules
import { initPaymentRoutes } from './_routes/payments.js';
import emailRoutes from './_routes/email.js';
import smsRoutes from './_routes/sms.js';
import agentRoutes from './_routes/agents.js';
import aiRoutes from './_routes/ai.js';
import { initWebhookRoutes } from './_routes/webhooks.js';

// Import middleware
import { requireAuth, optionalAuth, getAuthStatus } from './_middleware/auth.js';
import { csrfCookie, csrfProtection } from './_middleware/csrf.js';
import { rateLimit } from './_middleware/rateLimit.js';
import { auditMutations } from './_middleware/audit.js';

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe (optional — AI routes work without it)
const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: '2023-10-16' })
  : null;

// Initialize Supabase (service role preferred; anon key OK for local AI dev)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// MIDDLEWARE
// ============================================

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Raw body for webhooks (must come before json parser)
app.use('/webhooks', express.raw({ type: 'application/json' }));

// JSON body for other routes
app.use(express.json());

// Issue CSRF cookie for browser clients
app.use(csrfCookie);

// Append-only audit trail for every successful mutation. Fires on
// res.finish so it never delays the user response; failures go to Sentry.
app.use(auditMutations(supabase));

// ============================================
// ROUTES
// ============================================

// Protected routes - require authentication, CSRF, and rate limiting
if (stripe) {
  app.use('/api/payments', requireAuth, csrfProtection, rateLimit(30), initPaymentRoutes(stripe));
  app.use('/webhooks', initWebhookRoutes(stripe, supabase));
} else {
  console.warn('STRIPE_SECRET_KEY not set — payment and webhook routes disabled');
}
app.use('/api/email', requireAuth, csrfProtection, rateLimit(20), emailRoutes);
app.use('/api/sms', requireAuth, csrfProtection, rateLimit(10), smsRoutes);
app.use('/api/agents', requireAuth, csrfProtection, rateLimit(30), agentRoutes);

// AI routes - optional auth, tighter rate limit
app.use('/api/ai', optionalAuth, rateLimit(15), aiRoutes);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  const authStatus = getAuthStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    resend: !!process.env.RESEND_API_KEY,
    twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
    supabase: !!process.env.SUPABASE_URL,
    gemini: !!process.env.GEMINI_API_KEY,
    agents: true,
    auth: authStatus,
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// Sentry's Express error handler must come BEFORE our handler so it
// captures the exception with full request context.
if (sentryEnabled) {
  Sentry.setupExpressErrorHandler(app);
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(Number(PORT), '127.0.0.1', () => {
  console.log(`Grace CRM Payment API running on http://127.0.0.1:${PORT}`);
  console.log(`Health check: http://127.0.0.1:${PORT}/health`);
});

export default app;
