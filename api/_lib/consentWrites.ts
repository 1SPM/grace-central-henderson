/**
 * Writing consents from a route that is not api/consents/_index.ts.
 *
 * Two things have to happen together, and forgetting the second is the bug
 * this exists to prevent: the `consents` row is the record of what the member
 * agreed to, and `communication_preferences` is the denormalized read-model
 * every messaging path actually consults. Writing one without the other leaves
 * a member who declined email still receiving it, with an audit trail saying
 * they declined.
 *
 * api/consents/_index.ts keeps its own copy of this sequence inline because it
 * also does permission checks, audit and a member-vs-staff event split; this is
 * the same write, reusable by routes that have already established who the
 * member is.
 */
import type { ServiceClient } from './supabaseServiceClient.js';
import { deriveCommunicationFlags } from './consentPreferences.js';

export type ConsentStatus = 'granted' | 'denied' | 'withdrawn';

export interface ConsentEntry {
  consentType: string;
  status: ConsentStatus;
}

/**
 * Upserts each consent and rebuilds the preference read-model once.
 *
 * Records DENIALS explicitly rather than omitting them. "Asked and declined"
 * and "never asked" are different facts, and only the first is a defensible
 * basis for never contacting someone — the second is a gap that looks like a
 * decision later.
 */
export async function recordConsents(
  supabase: ServiceClient,
  churchId: string,
  personId: string,
  entries: ConsentEntry[],
  opts: { source?: string; recordedByUserId?: string | null } = {},
): Promise<{ ok: boolean; error?: string }> {
  if (entries.length === 0) return { ok: true };

  const now = new Date().toISOString();
  const rows = entries.map(entry => ({
    church_id: churchId,
    person_id: personId,
    consent_type: entry.consentType,
    status: entry.status,
    source: opts.source ?? 'portal',
    recorded_by_user_id: opts.recordedByUserId ?? null,
    granted_at: entry.status === 'granted' ? now : null,
    withdrawn_at: entry.status === 'withdrawn' ? now : null,
  }));

  const { error } = await supabase
    .from('consents')
    .upsert(rows, { onConflict: 'person_id,consent_type' });
  if (error) return { ok: false, error: error.message };

  const { data: consents } = await supabase
    .from('consents')
    .select('consent_type, status')
    .eq('church_id', churchId)
    .eq('person_id', personId);

  const { error: prefErr } = await supabase
    .from('communication_preferences')
    .upsert(
      { church_id: churchId, person_id: personId, ...deriveCommunicationFlags(consents ?? []) },
      { onConflict: 'person_id' },
    );
  if (prefErr) return { ok: false, error: prefErr.message };

  return { ok: true };
}
