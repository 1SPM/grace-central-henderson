/**
 * GET /api/tenant/config?host=<hostname>
 *
 * Public route (no auth) — resolves branding for a custom domain a
 * church has added to their `hosts` array (Settings → Custom domains).
 * This is COSMETIC ONLY: church_name and branding (logo/color), nothing
 * else. It is never the source of truth for which church's DATA a
 * session can see — that is still resolved server-side from the JWT
 * church_id claim on every authenticated route. The auth/demo-bypass
 * host maps (api/_lib/authz.ts's HOST_CHURCH_IDS, src/config/tenant.ts's
 * HOST_TENANTS) are deliberately separate and stay hardcoded — enabling
 * an auth bypass for a host is a code change, not a database edit.
 *
 * Response: { church_name: string, branding: { primaryColor?, logoUrl? } } | { church_name: null, branding: null }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CACHE_CONTROL = 'public, max-age=300, s-maxage=300';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const host = typeof req.query.host === 'string' ? req.query.host.trim().toLowerCase() : '';
  res.setHeader('Cache-Control', CACHE_CONTROL);
  if (!host || host.length > 255) {
    return res.status(200).json({ church_name: null, branding: null });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const { data: church, error } = await supabase
    .from('churches')
    .select('settings')
    .contains('hosts', [host])
    .limit(1)
    .maybeSingle();
  if (error || !church) {
    return res.status(200).json({ church_name: null, branding: null });
  }

  const settings = (church.settings as Record<string, unknown> | null) ?? {};
  const profile = settings.profile as Record<string, unknown> | undefined;
  const branding = settings.branding as Record<string, unknown> | undefined;

  return res.status(200).json({
    church_name: typeof profile?.name === 'string' ? profile.name : null,
    branding: {
      primaryColor: typeof branding?.primaryColor === 'string' ? branding.primaryColor : undefined,
      logoUrl: typeof branding?.logoUrl === 'string' ? branding.logoUrl : undefined,
    },
  });
}
