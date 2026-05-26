/**
 * POST /api/billing/create-church
 *
 * Step 1 of the sign-up flow. Creates a fresh church tenant with the
 * authenticated Clerk user as its admin, and sets church_id on the
 * user's Clerk public_metadata so future requests resolve correctly.
 *
 * Flow:
 *   1. User signs up via Clerk (handled client-side)
 *   2. Client immediately calls this endpoint with the church details
 *   3. We create the churches row, set the user's role, write
 *      church_id back to Clerk metadata, return church_id
 *   4. Client then calls /api/billing/create-checkout-session
 *
 * Auth: requires valid Clerk JWT. The JWT subject becomes the admin.
 *
 * Idempotency: if the user already has a church_id in Clerk metadata,
 * we return that church_id with a 200 instead of creating a duplicate.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { readBody, str } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

const SCHEMA = {
  church_name: str({ required: true, max: 200 }),
  admin_full_name: str({ required: true, max: 200 }),
  city: str({ max: 100 }),
  state: str({ max: 50 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !CLERK_SECRET_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  // Auth check
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'auth_required' });

  let payload: { sub?: string };
  try {
    payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
  const clerkUserId = payload.sub;
  if (!clerkUserId) return res.status(401).json({ error: 'invalid_token' });

  const body = readBody(req, res, SCHEMA);
  if (!body) return;
  const { church_name, admin_full_name, city, state } = body;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

  // Idempotency: check if this user already has a church_id
  const user = await clerk.users.getUser(clerkUserId);
  const existingChurchId = (user.publicMetadata?.church_id as string | undefined)
                        ?? (user.privateMetadata?.church_id as string | undefined);
  if (existingChurchId) {
    const { data: existing } = await supabase
      .from('churches')
      .select('id, name, subscription_status')
      .eq('id', existingChurchId)
      .single();
    if (existing) {
      return res.status(200).json({
        church_id: existing.id,
        name: existing.name,
        subscription_status: existing.subscription_status,
        already_exists: true,
      });
    }
  }

  // Create the church
  const slug = church_name!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  const { data: church, error: chErr } = await supabase
    .from('churches')
    .insert({
      name: church_name,
      slug: `${slug}-${Math.random().toString(36).slice(2, 8)}`,
      city: city ?? null,
      state: state ?? null,
      subscription_status: 'incomplete',
    })
    .select('id, name, slug')
    .single();
  if (chErr || !church) {
    return res.status(500).json({ error: 'church_creation_failed', detail: chErr?.message });
  }

  // Create the admin member record. The exact table varies by schema age;
  // we attempt the most common shape and ignore if it doesn't exist.
  const userEmail = user.emailAddresses[0]?.emailAddress;
  try {
    await supabase
      .from('users')
      .upsert(
        {
          clerk_id: clerkUserId,
          email: userEmail,
          name: admin_full_name,
          role: 'admin',
          church_id: church.id,
        },
        { onConflict: 'clerk_id' },
      );
  } catch {
    // users table may not exist in this schema iteration; the metadata
    // write below is the authoritative source for church-of-record.
  }

  // Write church_id back to Clerk metadata so future requests resolve
  await clerk.users.updateUserMetadata(clerkUserId, {
    publicMetadata: {
      ...(user.publicMetadata ?? {}),
      church_id: church.id,
      role: 'admin',
    },
  });

  return res.status(201).json({
    church_id: church.id,
    name: church.name,
    slug: church.slug,
    subscription_status: 'incomplete',
  });
}
