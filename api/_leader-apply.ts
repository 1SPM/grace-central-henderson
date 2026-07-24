import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { readBody, str, email_, arrayOfStr } from './_lib/validation.js';
import { clientIp, enforceRateLimit } from './_lib/rateLimit/limiter.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Hardened input schema. Public route — caps size on every freeform field.
const SCHEMA = {
  displayName:    str({ required: true, max: 200 }),
  email:          email_({ required: true }),
  phone:          str({ max: 50, pattern: /^[0-9+()\-.\s]*$/ }),
  role:           str({ max: 100 }),
  audienceUrl:    str({ max: 500, pattern: /^https?:\/\// }),
  audienceSize:   str({ max: 50 }),
  expertiseAreas: arrayOfStr({ maxLength: 30, maxItem: 80 }),
  bio:            str({ max: 5000 }),
  motivation:     str({ max: 5000 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Public application form — throttle per IP against spam applications.
  if (await enforceRateLimit(res, `leader-apply:ip:${clientIp(req)}`, 5, 3600,
    'Too many applications from this connection. Please try again later.')) return;

  // Support legacy clients that send expertiseAreas as a comma-separated
  // string: pre-split before validation.
  const rawBody = (req.body ?? {}) as Record<string, unknown>;
  if (typeof rawBody.expertiseAreas === 'string') {
    rawBody.expertiseAreas = rawBody.expertiseAreas
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  req.body = rawBody;

  const body = readBody(req, res, SCHEMA);
  if (!body) return;
  const { displayName, email, phone, role, audienceUrl, audienceSize, expertiseAreas, bio, motivation } = body;
  const applicantName = displayName as string;
  const applicantEmail = email as string;
  const expertise: string[] = expertiseAreas ?? [];

  try {

    if (!supabaseUrl || !supabaseKey) {
      console.log('Leader application (demo mode):', { displayName: applicantName, email: applicantEmail, role });
      return res.status(200).json({ success: true, demo: true });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('anchor_leader_applications')
      .insert({
        display_name: applicantName.trim(),
        email: applicantEmail.trim(),
        phone: phone?.trim() || null,
        role: role?.trim() || null,
        audience_url: audienceUrl?.trim() || null,
        audience_size: audienceSize?.trim() || null,
        expertise_areas: expertise,
        bio: bio?.trim() || null,
        motivation: motivation?.trim() || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating leader application:', error);
      return res.status(500).json({ error: 'Failed to submit application' });
    }

    return res.status(200).json({ success: true, applicationId: data.id });
  } catch (error) {
    console.error('Leader apply error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
