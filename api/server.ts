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

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Import route modules
import { initPaymentRoutes } from './routes/payments';
import emailRoutes from './routes/email';
import smsRoutes from './routes/sms';
import agentRoutes from './routes/agents';
import aiRoutes from './routes/ai';
import { initWebhookRoutes } from './routes/webhooks';

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

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

// ============================================
// ROUTES
// ============================================

// Mount route modules
app.use('/api/payments', initPaymentRoutes(stripe));
app.use('/api/email', emailRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/webhooks', initWebhookRoutes(stripe, supabase));

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    resend: !!process.env.RESEND_API_KEY,
    twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
    supabase: !!process.env.SUPABASE_URL,
    gemini: !!process.env.GEMINI_API_KEY,
    agents: true, // AI agents are always available
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`Grace CRM Payment API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;
