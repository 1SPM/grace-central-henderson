import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { readBody, str, email_, arrayOfStr } from './_lib/validation.js';
import { resolveChurchIdForHost } from './_lib/resolveChurchByHost.js';
import { requireClerkAuth } from './_lib/auth-helper.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Hardened input schema. This route is PUBLIC and accepts traffic from
// the open internet, so we cap field sizes + constrain interest tags to
// an allowlist. Security fix: churchId is NOT accepted from the client
// (see the church resolution in the handler) — it used to be, which let
// anyone inject records into any real tenant by supplying that tenant's
// church_id in the request body, with no verification of any
// relationship to it.
const SCHEMA = {
  firstName:     str({ required: true, max: 100 }),
  lastName:      str({ required: true, max: 100 }),
  email:         email_({ max: 320 }),
  phone:         str({ max: 50, pattern: /^[0-9+()\-.\s]*$/ }),
  howDidYouHear: str({ max: 200 }),
  prayerRequest: str({ max: 2000 }),
  interestedIn:  arrayOfStr({ maxLength: 20, maxItem: 80 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers. Authorization is allowed so the in-admin Connect Card
  // (which posts with a staff bearer token) works; the public form sends
  // no token and resolves its church from the request Host instead.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Structured 400 on any malformed input — sets the response and returns null.
  const body = readBody(req, res, SCHEMA);
  if (!body) return;
  const { firstName, lastName, email, phone, howDidYouHear, prayerRequest, interestedIn } = body;

  try {
    // Build tags from interests and source
    const tags: string[] = ['connect-card'];
    if (howDidYouHear) {
      tags.push(`source:${howDidYouHear}`);
    }
    if (interestedIn && interestedIn.length > 0) {
      interestedIn.forEach((interest) => {
        tags.push(`interest:${interest}`);
      });
    }

    // Build notes from additional info
    const noteParts: string[] = [];
    if (howDidYouHear) {
      noteParts.push(`How they heard about us: ${howDidYouHear}`);
    }
    if (interestedIn && interestedIn.length > 0) {
      noteParts.push(`Interested in: ${interestedIn.join(', ')}`);
    }
    const notes = noteParts.join('\n');

    // Create person record
    if (!supabaseUrl || !supabaseKey) {
      // Demo mode - just return success
      console.log('Connect card submission (demo mode):', {
        firstName,
        lastName,
        email,
        phone,
        tags,
        notes,
      });
      return res.status(200).json({ success: true, demo: true });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve which church this submission is for. Two trusted paths,
    // never the request body:
    //   1. Authenticated (in-admin Connect Card): the church_id comes
    //      from the verified Clerk JWT — works on any host, and is the
    //      right signal when we actually know who the caller is.
    //   2. Anonymous (public /connect form, no token): fall back to the
    //      request's own Host header (see resolveChurchIdForHost).
    // A present-but-invalid token is rejected outright rather than
    // silently downgraded to the Host path.
    let churchId: string | null;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      const auth = await requireClerkAuth(req);
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
      churchId = auth.churchId;
    } else {
      churchId = await resolveChurchIdForHost(req.headers.host, supabase);
    }
    if (!churchId) {
      return res.status(404).json({ error: 'Connect card is not available on this domain' });
    }

    // Insert person
    const { data: person, error: personError } = await supabase
      .from('people')
      .insert({
        church_id: churchId,
        first_name: firstName,
        last_name: lastName,
        email: email || null,
        phone: phone || null,
        status: 'visitor',
        tags,
        notes,
        first_visit: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (personError) {
      console.error('Error creating person:', personError);
      return res.status(500).json({ error: 'Failed to create visitor record' });
    }

    // If there's a prayer request, create it
    if (prayerRequest && prayerRequest.trim()) {
      const { error: prayerError } = await supabase
        .from('prayer_requests')
        .insert({
          church_id: churchId,
          person_id: person.id,
          content: prayerRequest,
          is_private: false,
          is_answered: false,
        });

      if (prayerError) {
        console.error('Error creating prayer request:', prayerError);
        // Don't fail the whole request, just log it
      }
    }

    // Create a follow-up task
    const { error: taskError } = await supabase
      .from('tasks')
      .insert({
        church_id: churchId,
        person_id: person.id,
        title: `Follow up with new visitor: ${firstName} ${lastName}`,
        description: `New visitor from connect card.\n${notes}`,
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
        priority: 'high',
        category: 'follow-up',
        completed: false,
      });

    if (taskError) {
      console.error('Error creating task:', taskError);
      // Don't fail the whole request
    }

    return res.status(200).json({ success: true, personId: person.id });
  } catch (error) {
    console.error('Connect card error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
