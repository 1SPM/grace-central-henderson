/**
 * Story handoff single-use smoke test — the empirical proof for
 * redeem_visitor_story_handoff() in migration 082_visitor_story_handoff.sql.
 *
 * WHAT IT PROVES, AND WHY NOTHING ELSE CAN
 *
 * The claim is that two phones scanning the same screen produce exactly one
 * winner. That is a claim about a Postgres transaction under READ COMMITTED —
 * the second UPDATE blocks on the row lock, then RE-EVALUATES its WHERE clause
 * against the updated row and matches nothing. api/story/_claim.test.ts covers
 * the call contract and stops at the database boundary; tests/fixtures/
 * mockSupabase.ts is explicit that a mocked .rpc() "CANNOT show anything about
 * what the function does".
 *
 * docs/MEMBER_MOBILE_HANDOFF.md names simultaneous redemption, expiry,
 * cancellation and wrong-tenant as required before enabling QR transfer. This
 * is where those are actually checked.
 *
 * REQUIRED ENV (skips, and therefore passes, without them):
 *   SUPABASE_TEST_URL
 *   SUPABASE_TEST_SERVICE_ROLE_KEY   # the function is service_role-only
 *   SUPABASE_TEST_TENANT_A_ID        # church UUID to write fixtures into
 *   SUPABASE_TEST_TENANT_B_ID        # optional; enables the wrong-tenant case
 *
 * SAFETY
 * Refuses to run against the known production project ref. Every fixture row
 * is removed afterwards — unlike the audit-log case, nothing here is
 * append-only, so this leaves no residue.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';

const URL_ = process.env.SUPABASE_TEST_URL;
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const CHURCH = process.env.SUPABASE_TEST_TENANT_A_ID;
const OTHER_CHURCH = process.env.SUPABASE_TEST_TENANT_B_ID;

const PRODUCTION_PROJECT_REF = 'asphekfvpiancyltzdxp';
const IS_PRODUCTION = Boolean(URL_ && URL_.includes(PRODUCTION_PROJECT_REF));

const HAS_ENV = Boolean(URL_ && SERVICE_KEY && CHURCH) && !IS_PRODUCTION;
const it_ = HAS_ENV ? it : it.skip;
const itTenantB_ = HAS_ENV && OTHER_CHURCH ? it : it.skip;

const RPC = 'redeem_visitor_story_handoff';
const createdDraftIds: string[] = [];

let db: SupabaseClient;

const sha = (t: string) => createHash('sha256').update(t).digest('hex');

/** A draft plus a live token, as the handoff endpoint would create them. */
async function mintHandoff(opts: { expiresInMs?: number; cancelled?: boolean } = {}) {
  const { data: draft, error: draftErr } = await db
    .from('visitor_story_drafts')
    .insert({
      church_id: CHURCH,
      sections: { church: ['smoke-test'] },
      segments: {},
      consent_carry_story: true,
      source: 'atomic_smoke',
    })
    .select('id')
    .single();
  if (draftErr || !draft) throw new Error(`fixture draft failed: ${draftErr?.message}`);
  createdDraftIds.push(draft.id);

  const token = randomBytes(32).toString('base64url');
  const { error: tokenErr } = await db.from('visitor_story_handoffs').insert({
    church_id: CHURCH,
    draft_id: draft.id,
    token_sha256: sha(token),
    expires_at: new Date(Date.now() + (opts.expiresInMs ?? 15 * 60 * 1000)).toISOString(),
    cancelled_at: opts.cancelled ? new Date().toISOString() : null,
  });
  if (tokenErr) throw new Error(`fixture token failed: ${tokenErr.message}`);
  return { token, draftId: draft.id as string };
}

async function redeem(token: string, churchId = CHURCH) {
  const { data, error } = await db.rpc(RPC, { p_token_sha256: sha(token), p_church_id: churchId });
  if (error) throw new Error(`rpc failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return row as { status: string; draft_id: string | null };
}

describe('story handoff single-use redemption (migration 082)', () => {
  beforeAll(async () => {
    if (IS_PRODUCTION) {
      throw new Error('Refusing to run the story-handoff smoke fixture against the production project.');
    }
    if (!HAS_ENV) return;
    db = createClient(URL_!, SERVICE_KEY!, { auth: { persistSession: false } });
  });

  afterAll(async () => {
    if (!HAS_ENV || createdDraftIds.length === 0) return;
    // Handoffs cascade from drafts (ON DELETE CASCADE), so one delete suffices.
    await db.from('visitor_story_drafts').delete().in('id', createdDraftIds);
  });

  it_('redeems a live token once and returns the draft', async () => {
    const { token, draftId } = await mintHandoff();
    const result = await redeem(token);
    expect(result.status).toBe('ok');
    expect(result.draft_id).toBe(draftId);
  });

  it_('THE CENTRAL CASE: two simultaneous redemptions, exactly one wins', async () => {
    const { token, draftId } = await mintHandoff();

    // Fired together, not awaited in sequence — the whole point is that both
    // are in flight when the first takes the row lock.
    const [a, b] = await Promise.all([redeem(token), redeem(token)]);
    const statuses = [a.status, b.status].sort();

    expect(statuses).toEqual(['already_used', 'ok']);
    const winner = a.status === 'ok' ? a : b;
    expect(winner.draft_id).toBe(draftId);

    const { data } = await db
      .from('visitor_story_handoffs')
      .select('use_count, redeemed_at')
      .eq('token_sha256', sha(token))
      .single();
    expect(data?.use_count).toBe(1);
    expect(data?.redeemed_at).not.toBeNull();
  });

  it_('refuses a second redemption made later', async () => {
    const { token } = await mintHandoff();
    expect((await redeem(token)).status).toBe('ok');
    const second = await redeem(token);
    expect(second.status).toBe('already_used');
    expect(second.draft_id).toBeNull();
  });

  it_('refuses an expired token', async () => {
    const { token } = await mintHandoff({ expiresInMs: -1000 });
    const result = await redeem(token);
    expect(result.status).toBe('expired');
    expect(result.draft_id).toBeNull();
  });

  it_('refuses a cancelled token', async () => {
    const { token } = await mintHandoff({ cancelled: true });
    expect((await redeem(token)).status).toBe('cancelled');
  });

  it_('reports an unknown token as unknown', async () => {
    expect((await redeem(randomBytes(32).toString('base64url'))).status).toBe('unknown');
  });

  itTenantB_('gives a token from another tenant the same answer as a nonexistent one', async () => {
    // Must not confirm the token is real somewhere else.
    const { token } = await mintHandoff();
    const result = await redeem(token, OTHER_CHURCH);
    expect(result.status).toBe('unknown');
    expect(result.draft_id).toBeNull();

    // And the real owner can still redeem it: a wrong-tenant attempt must not
    // consume or otherwise disturb the token.
    expect((await redeem(token)).status).toBe('ok');
  });
});
