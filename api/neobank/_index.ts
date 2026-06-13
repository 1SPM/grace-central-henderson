/**
 * /api/neobank — GRACE Impact Card program (Portal-CRM Alignment, Phase C)
 *
 * Single consolidated route (action dispatch) covering the whole card
 * lifecycle, all through the i2c adapter (api/_lib/i2c/) — mock today,
 * live when I2C_LIVE + I2C_API_KEY flip on (TD-036).
 *
 *   GET  ?resource=me            member: own KYC + cards + transactions
 *   GET  ?resource=admin         staff: KYC queue, card roster, interchange rollup
 *   GET  ?resource=transactions&card_id=…
 *   POST { action: 'submit_kyc', full_name, date_of_birth, email, phone? }
 *   POST { action: 'issue_card', kyc_verification_id }
 *   POST { action: 'freeze_card' | 'unfreeze_card' | 'cancel_card', card_id }
 *   POST { action: 'review_kyc', kyc_verification_id, decision }   (staff)
 *   POST { action: 'set_limits', card_id, daily_limit_micro_usd, monthly_limit_micro_usd } (staff)
 *
 * Auth: Clerk Bearer. Plan gate: cardProgram (Enterprise).
 * Every state change writes member_activity_events so card activity
 * shows up in the Portal Activity feed and GRACE context.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireClerkAuth, type AuthOk } from '../_lib/auth-helper.js';
import { requirePlanGate } from '../_lib/billing/gates.js';
import { readBody, str, int_ } from '../_lib/validation.js';
import { getI2cAdapter } from '../_lib/i2c/index.js';
import {
  ensureCardAccount,
  syncAccountBalance,
  loadAdminAccountData,
} from '../_lib/neobank/accounts.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STAFF_ROLES = ['admin', 'pastor', 'staff'];

const POST_SCHEMA = {
  action: str({ required: true, max: 30, pattern: /^[a-z_]+$/ }),
  full_name: str({ max: 120 }),
  date_of_birth: str({ max: 10, pattern: /^\d{4}-\d{2}-\d{2}$/ }),
  email: str({ max: 200 }),
  phone: str({ max: 30 }),
  kyc_verification_id: str({ max: 60, pattern: /^[0-9a-fA-F-]+$/ }),
  card_id: str({ max: 60, pattern: /^[0-9a-fA-F-]+$/ }),
  decision: str({ max: 10, pattern: /^(approve|reject)$/ }),
  rejection_reason: str({ max: 300 }),
  daily_limit_micro_usd: int_({ min: 0 }),
  monthly_limit_micro_usd: int_({ min: 0 }),
  person_id: str({ max: 60, pattern: /^[0-9a-fA-F-]+$/ }),
  route_label: str({ max: 120 }),
  route_fund: str({ max: 60 }),
  amount_micro_usd: int_({ min: 1 }),
  transfer_type: str({ max: 20, pattern: /^(member|ach|bank|give|receive)$/ }),
  counterparty_name: str({ max: 120 }),
  counterparty_ref: str({ max: 120 }),
  memo: str({ max: 300 }),
  direction: str({ max: 10, pattern: /^(outbound|inbound)$/ }),
  account_id: str({ max: 60, pattern: /^[0-9a-fA-F-]+$/ }),
  transfer_id: str({ max: 60, pattern: /^[0-9a-fA-F-]+$/ }),
  reason: str({ max: 300 }),
  note: str({ max: 300 }),
};

function mergeCardMetadata(existing: unknown, patch: Record<string, unknown>) {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? existing as Record<string, unknown>
    : {};
  return { ...base, ...patch };
}

async function resolvePerson(supabase: Db, auth: AuthOk) {
  const { data } = await supabase
    .from('people')
    .select('id, first_name, last_name, email')
    .eq('clerk_user_id', auth.clerkUserId)
    .eq('church_id', auth.churchId)
    .maybeSingle();
  return data as { id: string; first_name: string; last_name: string; email: string | null } | null;
}

function logActivity(supabase: Db, churchId: string, personId: string | null, eventType: string, entityId: string, metadata: Record<string, unknown>) {
  return supabase.from('member_activity_events').insert({
    church_id: churchId,
    person_id: personId,
    event_type: eventType,
    entity_type: 'card_program',
    entity_id: entityId,
    metadata,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const auth = await requireClerkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const gate = await requirePlanGate(auth.churchId, 'cardProgram', supabase);
  if (!gate.ok) {
    return res.status(gate.status).json({
      error: gate.error,
      detail: gate.detail,
      required_plan: gate.required_plan,
    });
  }

  const isStaff = STAFF_ROLES.includes(auth.role);
  const adapter = getI2cAdapter({ liveMode: process.env.I2C_LIVE === 'true' });

  // ---------- READS ----------
  if (req.method === 'GET') {
    const resource = String(req.query.resource ?? 'me');

    if (resource === 'me') {
      const person = await resolvePerson(supabase, auth);
      if (!person) return res.status(200).json({ person_id: null, kyc: null, cards: [], transactions: [] });

      const [{ data: kyc }, { data: cards }] = await Promise.all([
        supabase
          .from('kyc_verifications')
          .select('*')
          .eq('church_id', auth.churchId)
          .eq('person_id', person.id)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('cards')
          .select('*')
          .eq('church_id', auth.churchId)
          .eq('cardholder_person_id', person.id)
          .order('issued_at', { ascending: false }),
      ]);

      const cardIds = (cards ?? []).map(c => c.id);
      let transactions: unknown[] = [];
      if (cardIds.length > 0) {
        const { data: txns } = await supabase
          .from('interchange_events')
          .select('*')
          .in('card_id', cardIds)
          .order('occurred_at', { ascending: false })
          .limit(50);
        transactions = txns ?? [];
      }

      const { data: account } = await supabase
        .from('card_accounts')
        .select('*')
        .eq('church_id', auth.churchId)
        .eq('person_id', person.id)
        .maybeSingle();

      const { data: route } = await supabase
        .from('impact_routes')
        .select('*')
        .eq('church_id', auth.churchId)
        .eq('person_id', person.id)
        .maybeSingle();

      const { data: transfers } = await supabase
        .from('card_transfers')
        .select('*')
        .eq('church_id', auth.churchId)
        .eq('person_id', person.id)
        .order('initiated_at', { ascending: false })
        .limit(25);

      return res.status(200).json({
        person_id: person.id,
        kyc: kyc ?? null,
        cards: cards ?? [],
        transactions,
        account: account ?? null,
        impact_route: route ?? null,
        transfers: transfers ?? [],
        adapter_mode: adapter.mode,
      });
    }

    if (resource === 'account') {
      const personId = String(req.query.person_id ?? '');
      if (!personId) return res.status(400).json({ error: 'person_id required' });
      if (!isStaff) {
        const me = await resolvePerson(supabase, auth);
        if (!me || me.id !== personId) return res.status(403).json({ error: 'forbidden' });
      }

      let account = await supabase
        .from('card_accounts')
        .select('*')
        .eq('church_id', auth.churchId)
        .eq('person_id', personId)
        .maybeSingle()
        .then(r => r.data);

      if (account && !account.routing_number && isStaff) {
        const deposit = await adapter.getDepositInstructions({
          i2cAccountId: account.i2c_account_id,
          churchId: auth.churchId,
          accountName: account.account_name,
        });
        const { data: refreshed } = await supabase
          .from('card_accounts')
          .update({
            routing_number: deposit.routingNumber,
            account_number_last4: deposit.accountNumberLast4,
          })
          .eq('id', account.id)
          .select()
          .single();
        account = refreshed ?? account;
      }

      const { data: route } = await supabase
        .from('impact_routes')
        .select('*')
        .eq('church_id', auth.churchId)
        .eq('person_id', personId)
        .maybeSingle();

      const { data: transfers } = await supabase
        .from('card_transfers')
        .select('*')
        .eq('church_id', auth.churchId)
        .eq('person_id', personId)
        .order('initiated_at', { ascending: false })
        .limit(100);

      return res.status(200).json({ account: account ?? null, impact_route: route ?? null, transfers: transfers ?? [] });
    }

    if (resource === 'admin') {
      if (!isStaff) return res.status(403).json({ error: 'forbidden' });
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      const [{ data: kycQueue }, { data: cards }, { data: interchange }] = await Promise.all([
        supabase
          .from('kyc_verifications')
          .select('*')
          .eq('church_id', auth.churchId)
          .order('submitted_at', { ascending: false })
          .limit(200),
        supabase
          .from('cards')
          .select('*')
          .eq('church_id', auth.churchId)
          .order('issued_at', { ascending: false })
          .limit(500),
        supabase
          .from('interchange_events')
          .select('*')
          .eq('church_id', auth.churchId)
          .gte('occurred_at', monthStart.toISOString())
          .order('occurred_at', { ascending: false })
          .limit(1000),
      ]);

      const events = interchange ?? [];
      const accountData = await loadAdminAccountData(supabase, auth.churchId);

      // Interchange revenue ≈ fee events credited to the program.
      const interchangeMtdMicroUsd = events
        .filter(e => e.event_type === 'fee' && e.direction === 'credit')
        .reduce((sum, e) => sum + Number(e.amount_micro_usd), 0);
      const spendMtdMicroUsd = events
        .filter(e => e.event_type === 'capture' && e.direction === 'debit')
        .reduce((sum, e) => sum + Number(e.amount_micro_usd), 0);

      const totalFloatMicroUsd = (accountData.accounts ?? []).reduce(
        (sum, a) => sum + Number(a.available_balance_micro_usd),
        0,
      );
      const impactMtdMicroUsd = (accountData.impact_allocations ?? []).reduce(
        (sum, a) => sum + Number(a.amount_micro_usd),
        0,
      ) || interchangeMtdMicroUsd;

      const declineCount = events.filter(e => e.event_type === 'declined').length;
      const pendingTransfers = (accountData.transfers ?? []).filter(t => t.status === 'pending' || t.status === 'processing').length;
      const failedTransfers = (accountData.transfers ?? []).filter(t => t.status === 'failed').length;

      // i2c ledger reconciliation hint
      const { data: i2cLedger } = await supabase
        .from('ledger_entries')
        .select('amount_micro_usd, direction')
        .eq('church_id', auth.churchId)
        .eq('source', 'i2c')
        .gte('occurred_at', monthStart.toISOString());

      const ledgerI2cMicroUsd = (i2cLedger ?? []).reduce((sum, row) => {
        const amt = Number(row.amount_micro_usd);
        return sum + (row.direction === 'credit' ? amt : -amt);
      }, 0);

      return res.status(200).json({
        kyc_queue: kycQueue ?? [],
        cards: cards ?? [],
        interchange_events: events.slice(0, 100),
        ...accountData,
        summary: {
          pending_kyc: (kycQueue ?? []).filter(k => k.status === 'pending' || k.status === 'in_review').length,
          active_cards: (cards ?? []).filter(c => c.status === 'active').length,
          frozen_cards: (cards ?? []).filter(c => c.status === 'frozen').length,
          interchange_mtd_micro_usd: interchangeMtdMicroUsd,
          spend_mtd_micro_usd: spendMtdMicroUsd,
          total_float_micro_usd: totalFloatMicroUsd,
          impact_mtd_micro_usd: impactMtdMicroUsd,
          decline_count_mtd: declineCount,
          pending_transfers: pendingTransfers,
          failed_transfers: failedTransfers,
          ledger_i2c_net_mtd_micro_usd: ledgerI2cMicroUsd,
          reconciliation_delta_micro_usd: interchangeMtdMicroUsd - ledgerI2cMicroUsd,
        },
        adapter_mode: adapter.mode,
      });
    }

    if (resource === 'transactions') {
      const cardId = String(req.query.card_id ?? '');
      if (!cardId) return res.status(400).json({ error: 'card_id required' });
      const { data: card } = await supabase
        .from('cards')
        .select('id, church_id, cardholder_person_id')
        .eq('id', cardId)
        .eq('church_id', auth.churchId)
        .maybeSingle();
      if (!card) return res.status(404).json({ error: 'card_not_found' });
      if (!isStaff) {
        const person = await resolvePerson(supabase, auth);
        if (!person || card.cardholder_person_id !== person.id) {
          return res.status(403).json({ error: 'forbidden' });
        }
      }
      const { data: txns } = await supabase
        .from('interchange_events')
        .select('*')
        .eq('card_id', cardId)
        .order('occurred_at', { ascending: false })
        .limit(100);
      return res.status(200).json({ transactions: txns ?? [] });
    }

    return res.status(400).json({ error: 'unknown_resource' });
  }

  // ---------- WRITES ----------
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = readBody(req, res, POST_SCHEMA);
  if (!body) return;
  const person = await resolvePerson(supabase, auth);

  switch (body.action) {
    case 'submit_kyc': {
      if (!person) return res.status(403).json({ error: 'no_member_record' });
      if (!body.full_name || !body.date_of_birth || !body.email) {
        return res.status(400).json({ error: 'full_name, date_of_birth, email required' });
      }

      // One live application at a time.
      const { data: existing } = await supabase
        .from('kyc_verifications')
        .select('id, status')
        .eq('church_id', auth.churchId)
        .eq('person_id', person.id)
        .in('status', ['pending', 'in_review', 'approved'])
        .limit(1)
        .maybeSingle();
      if (existing) {
        return res.status(409).json({ error: 'kyc_already_exists', status: existing.status });
      }

      const result = await adapter.submitKyc({
        fullName: body.full_name,
        dateOfBirth: body.date_of_birth,
        email: body.email,
        phone: body.phone,
        churchId: auth.churchId,
      });

      const { data: kyc, error } = await supabase
        .from('kyc_verifications')
        .insert({
          church_id: auth.churchId,
          person_id: person.id,
          full_name: body.full_name,
          date_of_birth: body.date_of_birth,
          email: body.email,
          phone: body.phone ?? null,
          status: result.status,
          i2c_kyc_id: result.i2cKycId,
          rejection_reason: result.rejectionReason ?? null,
          reviewed_at: result.status === 'approved' || result.status === 'rejected' ? new Date().toISOString() : null,
          expires_at: result.expiresAt ?? null,
          metadata: { adapter_mode: adapter.mode },
        })
        .select()
        .single();
      if (error || !kyc) {
        console.error('[neobank] kyc insert failed', error);
        return res.status(500).json({ error: 'kyc_insert_failed' });
      }

      await logActivity(supabase, auth.churchId, person.id, 'kyc_submitted', kyc.id, {
        status: kyc.status,
        adapter_mode: adapter.mode,
      });
      return res.status(201).json({ kyc });
    }

    case 'issue_card': {
      const kycId = body.kyc_verification_id;
      if (!kycId) return res.status(400).json({ error: 'kyc_verification_id required' });

      const { data: kyc } = await supabase
        .from('kyc_verifications')
        .select('*')
        .eq('id', kycId)
        .eq('church_id', auth.churchId)
        .maybeSingle();
      if (!kyc) return res.status(404).json({ error: 'kyc_not_found' });
      if (kyc.status !== 'approved') return res.status(409).json({ error: 'kyc_not_approved', status: kyc.status });
      if (!isStaff && (!person || kyc.person_id !== person.id)) return res.status(403).json({ error: 'forbidden' });

      const { data: existingCard } = await supabase
        .from('cards')
        .select('id')
        .eq('church_id', auth.churchId)
        .eq('cardholder_person_id', kyc.person_id)
        .in('status', ['pending', 'active', 'frozen'])
        .limit(1)
        .maybeSingle();
      if (existingCard) return res.status(409).json({ error: 'card_already_exists' });

      const result = await adapter.issueCard({
        churchId: auth.churchId,
        kycVerificationId: kyc.id,
        cardholderName: kyc.full_name,
      });

      const { data: card, error } = await supabase
        .from('cards')
        .insert({
          church_id: auth.churchId,
          cardholder_person_id: kyc.person_id,
          kyc_verification_id: kyc.id,
          i2c_card_id: result.i2cCardId,
          masked_pan: result.maskedPan,
          cardholder_name: kyc.full_name,
          expiry_month: result.expiryMonth,
          expiry_year: result.expiryYear,
          status: result.status,
          activated_at: result.status === 'active' ? new Date().toISOString() : null,
          metadata: { adapter_mode: adapter.mode, program: 'GRACE Impact Card' },
        })
        .select()
        .single();
      if (error || !card) {
        console.error('[neobank] card insert failed', error);
        return res.status(500).json({ error: 'card_insert_failed' });
      }

      await logActivity(supabase, auth.churchId, kyc.person_id, 'card_issued', card.id, {
        masked_pan: card.masked_pan,
        adapter_mode: adapter.mode,
      });

      try {
        await ensureCardAccount(supabase, auth.churchId, kyc.person_id, kyc.full_name, adapter);
      } catch (err) {
        console.warn('[neobank] card_account provisioning failed', err);
      }

      return res.status(201).json({ card });
    }

    case 'freeze_card':
    case 'unfreeze_card':
    case 'cancel_card': {
      const cardId = body.card_id;
      if (!cardId) return res.status(400).json({ error: 'card_id required' });

      const { data: card } = await supabase
        .from('cards')
        .select('*')
        .eq('id', cardId)
        .eq('church_id', auth.churchId)
        .maybeSingle();
      if (!card) return res.status(404).json({ error: 'card_not_found' });
      if (!isStaff && (!person || card.cardholder_person_id !== person.id)) {
        return res.status(403).json({ error: 'forbidden' });
      }
      if (card.status === 'cancelled') return res.status(409).json({ error: 'card_cancelled' });

      const staffReason = isStaff && body.reason ? body.reason : undefined;
      if (isStaff && (body.action === 'freeze_card' || body.action === 'cancel_card') && !staffReason) {
        return res.status(400).json({ error: 'reason required for staff freeze/cancel' });
      }

      const result = body.action === 'freeze_card'
        ? await adapter.freezeCard({ i2cCardId: card.i2c_card_id, reason: staffReason })
        : body.action === 'unfreeze_card'
          ? await adapter.unfreezeCard({ i2cCardId: card.i2c_card_id })
          : await adapter.cancelCard({ i2cCardId: card.i2c_card_id, reason: staffReason });

      const updates: Record<string, unknown> = { status: result.status };
      if (result.status === 'frozen') updates.frozen_at = new Date().toISOString();
      if (result.status === 'active') updates.frozen_at = null;
      if (result.status === 'cancelled') updates.cancelled_at = new Date().toISOString();
      if (staffReason && (body.action === 'freeze_card' || body.action === 'cancel_card')) {
        updates.metadata = mergeCardMetadata(card.metadata, {
          last_staff_action: {
            action: body.action,
            reason: staffReason,
            at: new Date().toISOString(),
            clerk_user_id: auth.clerkUserId,
          },
        });
      }

      const { data: updated, error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', cardId)
        .select()
        .single();
      if (error) return res.status(500).json({ error: 'card_update_failed' });

      const eventType = result.status === 'frozen' ? 'card_frozen'
        : result.status === 'cancelled' ? 'card_cancelled' : 'card_unfrozen';
      await logActivity(supabase, auth.churchId, card.cardholder_person_id, eventType, cardId, {
        actor: isStaff ? 'staff' : 'member',
        reason: staffReason ?? null,
      });
      return res.status(200).json({ card: updated });
    }

    case 'review_kyc': {
      if (!isStaff) return res.status(403).json({ error: 'forbidden' });
      const kycId = body.kyc_verification_id;
      if (!kycId || !body.decision) {
        return res.status(400).json({ error: 'kyc_verification_id and decision required' });
      }
      const { data: kyc } = await supabase
        .from('kyc_verifications')
        .select('id, status, person_id')
        .eq('id', kycId)
        .eq('church_id', auth.churchId)
        .maybeSingle();
      if (!kyc) return res.status(404).json({ error: 'kyc_not_found' });

      const newStatus = body.decision === 'approve' ? 'approved' : 'rejected';
      const { data: updated, error } = await supabase
        .from('kyc_verifications')
        .update({
          status: newStatus,
          rejection_reason: body.decision === 'reject' ? body.rejection_reason ?? 'Rejected by staff review' : null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', kycId)
        .select()
        .single();
      if (error) return res.status(500).json({ error: 'kyc_update_failed' });

      await logActivity(supabase, auth.churchId, kyc.person_id, `kyc_${newStatus}`, kycId, {
        reviewer: auth.clerkUserId,
      });
      return res.status(200).json({ kyc: updated });
    }

    case 'set_limits': {
      if (!isStaff) return res.status(403).json({ error: 'forbidden' });
      const cardId = body.card_id;
      if (!cardId || (body.daily_limit_micro_usd === undefined && body.monthly_limit_micro_usd === undefined)) {
        return res.status(400).json({ error: 'card_id and at least one limit required' });
      }
      const updates: Record<string, unknown> = {};
      if (body.daily_limit_micro_usd !== undefined) updates.daily_limit_micro_usd = body.daily_limit_micro_usd;
      if (body.monthly_limit_micro_usd !== undefined) updates.monthly_limit_micro_usd = body.monthly_limit_micro_usd;

      const { data: updated, error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', cardId)
        .eq('church_id', auth.churchId)
        .select()
        .maybeSingle();
      if (error || !updated) return res.status(error ? 500 : 404).json({ error: error ? 'card_update_failed' : 'card_not_found' });
      return res.status(200).json({ card: updated });
    }

    case 'set_impact_route': {
      if (!isStaff) return res.status(403).json({ error: 'forbidden' });
      const personId = body.person_id;
      if (!personId || !body.route_label) {
        return res.status(400).json({ error: 'person_id and route_label required' });
      }
      const routeFund = body.route_fund ?? 'tithe';
      const { data: route, error } = await supabase
        .from('impact_routes')
        .upsert({
          church_id: auth.churchId,
          person_id: personId,
          route_label: body.route_label,
          route_fund: routeFund,
          set_by: 'staff',
          effective_at: new Date().toISOString(),
          metadata: { actor: auth.clerkUserId },
        }, { onConflict: 'church_id,person_id' })
        .select()
        .single();
      if (error) return res.status(500).json({ error: 'route_update_failed' });

      await logActivity(supabase, auth.churchId, personId, 'impact_route_set', route.id, {
        route_label: body.route_label,
        route_fund: routeFund,
        actor: 'staff',
      });
      return res.status(200).json({ impact_route: route });
    }

    case 'sync_balance': {
      const personId = body.person_id;
      if (!personId) return res.status(400).json({ error: 'person_id required' });
      if (!isStaff) {
        if (!person || person.id !== personId) return res.status(403).json({ error: 'forbidden' });
      }

      const { data: account } = await supabase
        .from('card_accounts')
        .select('*')
        .eq('church_id', auth.churchId)
        .eq('person_id', personId)
        .maybeSingle();
      if (!account) return res.status(404).json({ error: 'account_not_found' });

      const updated = await syncAccountBalance(supabase, account, adapter);
      return res.status(200).json({ account: updated });
    }

    case 'create_transfer': {
      const personId = body.person_id;
      if (!personId || !body.amount_micro_usd || !body.transfer_type || !body.counterparty_name || !body.direction) {
        return res.status(400).json({ error: 'person_id, amount_micro_usd, transfer_type, counterparty_name, direction required' });
      }
      if (!isStaff) {
        if (!person || person.id !== personId) return res.status(403).json({ error: 'forbidden' });
      }

      const { data: account } = await supabase
        .from('card_accounts')
        .select('*')
        .eq('church_id', auth.churchId)
        .eq('person_id', personId)
        .maybeSingle();
      if (!account) return res.status(404).json({ error: 'account_not_found' });

      const result = await adapter.initiateTransfer({
        i2cAccountId: account.i2c_account_id,
        churchId: auth.churchId,
        amountMicroUsd: body.amount_micro_usd,
        direction: body.direction as 'outbound' | 'inbound',
        transferType: body.transfer_type as 'member' | 'ach' | 'bank' | 'give' | 'receive',
        counterpartyName: body.counterparty_name,
        counterpartyRef: body.counterparty_ref,
        memo: body.memo,
      });

      const { data: transfer, error } = await supabase
        .from('card_transfers')
        .insert({
          church_id: auth.churchId,
          person_id: personId,
          card_account_id: account.id,
          direction: body.direction,
          transfer_type: body.transfer_type,
          counterparty_name: body.counterparty_name,
          counterparty_ref: body.counterparty_ref ?? null,
          amount_micro_usd: body.amount_micro_usd,
          memo: body.memo ?? null,
          status: result.status === 'completed' ? 'completed' : result.status,
          i2c_transfer_id: result.i2cTransferId,
          completed_at: result.status === 'completed' ? new Date().toISOString() : null,
          metadata: { adapter_mode: adapter.mode, actor: isStaff ? 'staff' : 'member' },
        })
        .select()
        .single();
      if (error) return res.status(500).json({ error: 'transfer_insert_failed' });

      if (result.status === 'completed' && body.direction === 'outbound') {
        await supabase
          .from('card_accounts')
          .update({
            available_balance_micro_usd: Math.max(0, Number(account.available_balance_micro_usd) - body.amount_micro_usd),
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', account.id);
      }

      await logActivity(supabase, auth.churchId, personId, 'card_transfer', transfer.id, {
        direction: body.direction,
        transfer_type: body.transfer_type,
        amount_micro_usd: body.amount_micro_usd,
        status: transfer.status,
      });
      return res.status(201).json({ transfer });
    }

    case 'retry_transfer': {
      if (!isStaff) return res.status(403).json({ error: 'forbidden' });
      const transferId = body.transfer_id;
      if (!transferId) return res.status(400).json({ error: 'transfer_id required' });

      const { data: transfer } = await supabase
        .from('card_transfers')
        .select('*')
        .eq('id', transferId)
        .eq('church_id', auth.churchId)
        .maybeSingle();
      if (!transfer) return res.status(404).json({ error: 'transfer_not_found' });
      if (transfer.status !== 'failed') return res.status(409).json({ error: 'transfer_not_failed' });

      const { data: account } = await supabase
        .from('card_accounts')
        .select('i2c_account_id')
        .eq('id', transfer.card_account_id ?? '')
        .maybeSingle();
      if (!account) return res.status(404).json({ error: 'account_not_found' });

      const result = await adapter.initiateTransfer({
        i2cAccountId: account.i2c_account_id,
        churchId: auth.churchId,
        amountMicroUsd: Number(transfer.amount_micro_usd),
        direction: transfer.direction as 'outbound' | 'inbound',
        transferType: transfer.transfer_type as 'member' | 'ach' | 'bank' | 'give' | 'receive',
        counterpartyName: transfer.counterparty_name,
        counterpartyRef: transfer.counterparty_ref ?? undefined,
        memo: transfer.memo ?? undefined,
      });

      const { data: updated, error } = await supabase
        .from('card_transfers')
        .update({
          status: result.status === 'completed' ? 'completed' : 'processing',
          i2c_transfer_id: result.i2cTransferId,
          failure_reason: null,
          completed_at: result.status === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', transferId)
        .select()
        .single();
      if (error) return res.status(500).json({ error: 'transfer_update_failed' });
      return res.status(200).json({ transfer: updated });
    }

    case 'issue_replacement_card': {
      if (!isStaff) return res.status(403).json({ error: 'forbidden' });
      const cardId = body.card_id;
      if (!cardId) return res.status(400).json({ error: 'card_id required' });
      const replacementReason = body.reason ?? 'Staff-issued replacement card';

      const { data: oldCard } = await supabase
        .from('cards')
        .select('*')
        .eq('id', cardId)
        .eq('church_id', auth.churchId)
        .maybeSingle();
      if (!oldCard) return res.status(404).json({ error: 'card_not_found' });
      if (oldCard.status === 'cancelled') return res.status(409).json({ error: 'card_cancelled' });

      const { data: kyc } = await supabase
        .from('kyc_verifications')
        .select('*')
        .eq('church_id', auth.churchId)
        .eq('person_id', oldCard.cardholder_person_id)
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!kyc) return res.status(409).json({ error: 'kyc_not_approved' });

      await adapter.cancelCard({ i2cCardId: oldCard.i2c_card_id, reason: replacementReason });
      await supabase
        .from('cards')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          metadata: mergeCardMetadata(oldCard.metadata, {
            replaced_by_staff: true,
            replacement_reason: replacementReason,
            replaced_at: new Date().toISOString(),
          }),
        })
        .eq('id', oldCard.id);

      const result = await adapter.issueCard({
        churchId: auth.churchId,
        kycVerificationId: kyc.id,
        cardholderName: kyc.full_name,
      });

      const { data: newCard, error } = await supabase
        .from('cards')
        .insert({
          church_id: auth.churchId,
          cardholder_person_id: kyc.person_id,
          kyc_verification_id: kyc.id,
          i2c_card_id: result.i2cCardId,
          masked_pan: result.maskedPan,
          cardholder_name: kyc.full_name,
          expiry_month: result.expiryMonth,
          expiry_year: result.expiryYear,
          status: result.status,
          activated_at: result.status === 'active' ? new Date().toISOString() : null,
          metadata: {
            adapter_mode: adapter.mode,
            program: 'GRACE Impact Card',
            replaced_card_id: oldCard.id,
            replacement_reason: replacementReason,
          },
        })
        .select()
        .single();
      if (error || !newCard) return res.status(500).json({ error: 'card_insert_failed' });

      await logActivity(supabase, auth.churchId, kyc.person_id, 'card_replaced', newCard.id, {
        old_card_id: oldCard.id,
        reason: replacementReason,
      });
      return res.status(201).json({ card: newCard });
    }

    case 'review_transfer': {
      if (!isStaff) return res.status(403).json({ error: 'forbidden' });
      const transferId = body.transfer_id;
      if (!transferId || !body.note) {
        return res.status(400).json({ error: 'transfer_id and note required' });
      }

      const { data: transfer } = await supabase
        .from('card_transfers')
        .select('*')
        .eq('id', transferId)
        .eq('church_id', auth.churchId)
        .maybeSingle();
      if (!transfer) return res.status(404).json({ error: 'transfer_not_found' });
      if (transfer.status !== 'failed') return res.status(409).json({ error: 'transfer_not_failed' });

      const metadata = transfer.metadata && typeof transfer.metadata === 'object' && !Array.isArray(transfer.metadata)
        ? transfer.metadata as Record<string, unknown>
        : {};
      const { data: updated, error } = await supabase
        .from('card_transfers')
        .update({
          metadata: {
            ...metadata,
            staff_review: {
              note: body.note,
              marked_at: new Date().toISOString(),
              clerk_user_id: auth.clerkUserId,
            },
          },
        })
        .eq('id', transferId)
        .select()
        .single();
      if (error) return res.status(500).json({ error: 'transfer_update_failed' });

      await logActivity(supabase, auth.churchId, transfer.person_id, 'transfer_marked_review', transferId, {
        note: body.note,
      });
      return res.status(200).json({ transfer: updated });
    }

    default:
      return res.status(400).json({ error: 'unknown_action' });
  }
}
