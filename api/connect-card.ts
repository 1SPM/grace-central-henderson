import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
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
      churchId,
      firstName,
      lastName,
      email,
      phone,
      howDidYouHear,
      prayerRequest,
      interestedIn,
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    if (!churchId) {
      return res.status(400).json({ error: 'Church ID is required' });
    }

    // Build tags from interests and source
    const tags: string[] = ['connect-card'];
    if (howDidYouHear) {
      tags.push(`source:${howDidYouHear}`);
    }
    if (interestedIn && Array.isArray(interestedIn)) {
      interestedIn.forEach((interest: string) => {
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
