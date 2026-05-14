import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

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

  try {
    const {
      displayName,
      email,
      phone,
      role,
      audienceUrl,
      audienceSize,
      expertiseAreas,
      bio,
      motivation,
    } = req.body;

    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const expertise: string[] = Array.isArray(expertiseAreas)
      ? expertiseAreas
      : typeof expertiseAreas === 'string'
        ? expertiseAreas.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

    if (!supabaseUrl || !supabaseKey) {
      console.log('Leader application (demo mode):', { displayName, email, role });
      return res.status(200).json({ success: true, demo: true });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('anchor_leader_applications')
      .insert({
        display_name: displayName.trim(),
        email: email.trim(),
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
