/**
 * POST /api/survey/respond
 *
 * Records a pilot survey response. Anonymous by design: the pilot document
 * asks that participant identity be separable from survey analysis, so this
 * takes no member token and writes no person_id. What it does accept is an
 * optional story_draft_id, which links a response to the walkthrough's
 * segmentation — language, age band, attendance mode, digital confidence —
 * so the scaled survey can answer whether comprehension differs by language
 * without naming anyone.
 *
 * Upsert on (church_id, track, respondent_key): a member may answer, go back,
 * change something and submit again within a sitting. Each save replaces their
 * own row rather than adding a second partial response and inflating the count.
 *
 * Every question is skippable, so an empty or partial submission is valid
 * data — the participant script promises exactly that.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { readBody, str, bool_ } from '../_lib/validation.js';
import { resolvePortalChurchId } from '../_lib/portalTenants.js';
import { clientIp, enforceRateLimit } from '../_lib/rateLimit/limiter.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { validateAnswers, SURVEY_TRACKS } from '../_lib/pilotSurvey.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEMA = {
  tenant: str({ max: 64, pattern: /^[a-z0-9-]+$/ }),
  track: str({ required: true, pattern: new RegExp(`^(${Object.keys(SURVEY_TRACKS).join('|')})$`) }),
  respondentKey: str({ required: true, max: 64, pattern: /^[A-Za-z0-9_-]{16,64}$/ }),
  storyDraftId: str({ max: 64, pattern: /^[0-9a-fA-F-]{36}$/ }),
  completed: bool_(),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: 'service_not_configured' });

  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  const answers = validateAnswers(body.track!, (req.body as Record<string, unknown> | undefined)?.answers);
  if (!answers.ok) {
    return res.status(400).json({ error: 'invalid_request', detail: answers.error, path: answers.path });
  }

  // A workshop room shares one NAT, so this has to clear a whole cohort
  // answering at once; saves are also repeated as a member edits their answers.
  if (await enforceRateLimit(res, `survey:ip:${clientIp(req)}`, 120, 600,
    'Too many submissions from this network. Please wait a few minutes and try again.')) return;

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const churchId = await resolvePortalChurchId(req.headers.host, body.tenant, supabase);
  if (!churchId) return res.status(404).json({ error: 'survey_not_available_on_this_domain' });

  // The draft must belong to this church. Same reasoning as the story attach:
  // it stops an id scraped from another tenant being joined to this one's
  // results and quietly corrupting the segmentation analysis.
  let storyDraftId: string | null = null;
  if (body.storyDraftId) {
    const { data: draft } = await supabase
      .from('visitor_story_drafts')
      .select('id')
      .eq('id', body.storyDraftId)
      .eq('church_id', churchId)
      .maybeSingle();
    storyDraftId = draft?.id ?? null;
  }

  // completed_at is written only when a response IS completed, never cleared.
  // The respondent key lives in sessionStorage, so reloading the tab remounts an
  // empty form under the same key; without this, an autosave after a reload
  // would quietly downgrade a finished response to a partial one and understate
  // the completion rate the pilot is being judged on. Omitting the column from
  // the payload leaves the stored value alone on the conflict path.
  const row: Record<string, unknown> = {
    church_id: churchId,
    track: body.track,
    respondent_key: body.respondentKey,
    story_draft_id: storyDraftId,
    answers: answers.value,
    source: body.tenant ? `${body.tenant}_portal` : 'member_portal',
    updated_at: new Date().toISOString(),
  };
  if (body.completed === true) row.completed_at = new Date().toISOString();

  const { data: saved, error } = await supabase
    .from('pilot_survey_responses')
    .upsert(row, { onConflict: 'church_id,track,respondent_key' })
    .select('id, completed_at')
    .single();
  if (error || !saved) return res.status(500).json({ error: 'survey_save_failed' });

  // Counts only — never an answer. These events are read by staff tooling that
  // has no pilot_research.view check of its own.
  await emitPlatformEvent(supabase, {
    churchId,
    eventType: body.completed === true ? 'pilot_survey.completed' : 'pilot_survey.saved',
    sourceApp: 'member_portal',
    subjectType: 'pilot_survey_response',
    subjectId: saved.id,
    payload: {
      track: body.track,
      answered_count: Object.keys(answers.value).length,
      segmented: !!storyDraftId,
    },
  });

  return res.status(200).json({
    ok: true,
    response_id: saved.id,
    answered_count: Object.keys(answers.value).length,
    completed: !!saved.completed_at,
  });
}
