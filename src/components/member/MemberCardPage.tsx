/**
 * GRACE Impact Card — member portal tab (Phase C).
 *
 * Full lifecycle: apply (KYC form) → status → card display (masked
 * PAN, freeze toggle) → transaction feed. Runs on the mock i2c
 * adapter today; identical UX when the live adapter flips on.
 *
 * Demo mode (no Clerk session): a local simulated walkthrough so the
 * tab is explorable without backend config.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Snowflake,
  Play,
  ShieldCheck,
  Clock,
  XCircle,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import {
  fetchMyCard,
  submitKyc,
  issueCard,
  freezeCard,
  unfreezeCard,
  microUsdToDollars,
  PlanGateError,
  type MyCardData,
  type CardRecord,
  type CardTransaction,
} from '../../lib/services/impactCard';

interface MemberCardPageProps {
  churchName?: string;
  memberName?: string;
  memberEmail?: string;
  primaryColor?: string;
}

type PageState =
  | { phase: 'loading' }
  | { phase: 'demo' }
  | { phase: 'plan_gate'; message: string }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: MyCardData };

function formatMoney(micro: number): string {
  return microUsdToDollars(micro).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function TxnRow({ txn }: { txn: CardTransaction }) {
  const isCredit = txn.direction === 'credit';
  const declined = txn.event_type === 'declined';
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        declined ? 'bg-red-100 dark:bg-red-500/10' : isCredit ? 'bg-green-100 dark:bg-green-500/10' : 'bg-gray-100 dark:bg-dark-700'
      }`}>
        {declined
          ? <XCircle size={14} className="text-red-500" />
          : isCredit
            ? <ArrowDownLeft size={14} className="text-green-600 dark:text-green-400" />
            : <ArrowUpRight size={14} className="text-gray-500 dark:text-dark-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
          {txn.merchant_name ?? (txn.event_type === 'fee' ? 'Program fee' : txn.event_type)}
        </p>
        <p className="text-xs text-gray-400 dark:text-dark-500">
          {new Date(txn.occurred_at).toLocaleDateString()} · {declined ? `Declined — ${txn.decline_reason}` : txn.event_type}
        </p>
      </div>
      <span className={`text-sm font-semibold flex-shrink-0 ${
        declined ? 'text-gray-400 dark:text-dark-500 line-through' : isCredit ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-dark-100'
      }`}>
        {isCredit ? '+' : '−'}{formatMoney(txn.amount_micro_usd)}
      </span>
    </div>
  );
}

function CardVisual({ card, churchName, primaryColor }: { card: CardRecord; churchName: string; primaryColor: string }) {
  const frozen = card.status === 'frozen';
  return (
    <div
      className={`relative rounded-2xl p-5 text-white overflow-hidden transition-opacity ${frozen ? 'opacity-60' : ''}`}
      style={{ background: `linear-gradient(135deg, ${primaryColor}, #1e293b)` }}
    >
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/70">GRACE Impact Card</p>
          <p className="text-xs text-white/90 mt-0.5">{churchName}</p>
        </div>
        <Sparkles size={20} className="text-white/80" />
      </div>
      <p className="font-mono text-xl tracking-[0.2em] mb-4">{card.masked_pan.replace('••••', '•••• •••• •••• ')}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase text-white/60">Cardholder</p>
          <p className="text-sm font-medium">{card.cardholder_name}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-white/60">Expires</p>
          <p className="text-sm font-medium">{String(card.expiry_month).padStart(2, '0')}/{String(card.expiry_year).slice(-2)}</p>
        </div>
      </div>
      {frozen && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/90 rounded-full">
            <Snowflake size={14} className="text-cyan-600" />
            <span className="text-xs font-semibold text-gray-800">Frozen</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function MemberCardPage({ churchName = 'Grace Church', memberName, memberEmail, primaryColor = '#4f46e5' }: MemberCardPageProps) {
  const [state, setState] = useState<PageState>({ phase: 'loading' });
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName: memberName ?? '', dateOfBirth: '', email: memberEmail ?? '', phone: '' });
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchMyCard();
      if (data === null) {
        setState({ phase: 'demo' });
      } else {
        setState({ phase: 'ready', data });
      }
    } catch (err) {
      if (err instanceof PlanGateError) {
        setState({ phase: 'plan_gate', message: err.message });
      } else {
        setState({ phase: 'error', message: err instanceof Error ? err.message : 'Failed to load card data' });
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleApply = async () => {
    setFormError(null);
    if (!form.fullName.trim() || !form.dateOfBirth || !form.email.trim()) {
      setFormError('Name, date of birth, and email are required.');
      return;
    }
    setBusy(true);
    try {
      await submitKyc({
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
      });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Application failed');
    } finally {
      setBusy(false);
    }
  };

  const handleIssue = async (kycId: string) => {
    setBusy(true);
    try {
      await issueCard(kycId);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Card issuance failed');
    } finally {
      setBusy(false);
    }
  };

  const handleFreezeToggle = async (card: CardRecord) => {
    setBusy(true);
    try {
      if (card.status === 'frozen') await unfreezeCard(card.id);
      else await freezeCard(card.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (state.phase === 'loading') {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (state.phase === 'demo') {
    return (
      <div className="p-4 space-y-4">
        <Hero churchName={churchName} primaryColor={primaryColor} />
        <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl text-sm text-amber-800 dark:text-amber-300">
          The GRACE Impact Card requires a member sign-in. This is a preview — sign in to apply.
        </div>
      </div>
    );
  }

  if (state.phase === 'plan_gate') {
    return (
      <div className="p-4 space-y-4">
        <Hero churchName={churchName} primaryColor={primaryColor} />
        <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl text-sm text-indigo-800 dark:text-indigo-300">
          The Impact Card program isn't enabled for {churchName} yet. Ask your church office about it.
        </div>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="p-4">
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-sm text-red-700 dark:text-red-400">
          {state.message}
        </div>
      </div>
    );
  }

  const { data } = state;
  const activeCard = data.cards.find(c => c.status === 'active' || c.status === 'frozen') ?? null;
  const kyc = data.kyc;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* No application yet → hero + KYC form */}
      {!kyc && !activeCard && (
        <>
          <Hero churchName={churchName} primaryColor={primaryColor} />
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-dark-100 text-sm">Apply in under a minute</h3>
            <p className="text-xs text-gray-500 dark:text-dark-400">
              Identity verification is required by federal banking regulations.
            </p>
            <input
              type="text"
              placeholder="Full legal name"
              value={form.fullName}
              onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-gray-900 dark:text-dark-100 text-sm"
            />
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-gray-900 dark:text-dark-100 text-sm"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-gray-900 dark:text-dark-100 text-sm"
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-900 text-gray-900 dark:text-dark-100 text-sm"
            />
            {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
            <button
              onClick={handleApply}
              disabled={busy}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Apply for Impact Card
            </button>
          </div>
        </>
      )}

      {/* Application pending / in review */}
      {kyc && (kyc.status === 'pending' || kyc.status === 'in_review') && !activeCard && (
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 p-5 text-center">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock size={22} className="text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-dark-100">Application in review</h3>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
            We're verifying your identity. This usually takes a few minutes.
          </p>
        </div>
      )}

      {/* Rejected */}
      {kyc && kyc.status === 'rejected' && !activeCard && (
        <div className="bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/30 p-5 text-center">
          <XCircle size={22} className="text-red-500 mx-auto mb-2" />
          <h3 className="font-semibold text-gray-900 dark:text-dark-100">Application not approved</h3>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
            {kyc.rejection_reason ?? 'Please contact your church office for details.'}
          </p>
        </div>
      )}

      {/* Approved, no card yet → issue */}
      {kyc && kyc.status === 'approved' && !activeCard && (
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 p-5 text-center space-y-3">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck size={22} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-dark-100">You're approved!</h3>
            <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">Issue your GRACE Impact Card now.</p>
          </div>
          {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
          <button
            onClick={() => handleIssue(kyc.id)}
            disabled={busy}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
            Issue my card
          </button>
        </div>
      )}

      {/* Card issued → card visual + controls + transactions */}
      {activeCard && (
        <>
          <CardVisual card={activeCard} churchName={churchName} primaryColor={primaryColor} />

          <button
            onClick={() => handleFreezeToggle(activeCard)}
            disabled={busy}
            className="w-full py-3 rounded-xl font-semibold text-sm border flex items-center justify-center gap-2 disabled:opacity-50 bg-stone-100 dark:bg-dark-800 border-gray-200 dark:border-dark-600 text-gray-800 dark:text-dark-200"
          >
            {busy
              ? <Loader2 size={16} className="animate-spin" />
              : activeCard.status === 'frozen'
                ? <><Play size={16} className="text-green-600" /> Unfreeze card</>
                : <><Snowflake size={16} className="text-cyan-600" /> Freeze card</>}
          </button>

          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 p-4">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-400 mb-1">
              <span>Daily limit</span>
              <span className="font-medium text-gray-900 dark:text-dark-100">{formatMoney(activeCard.daily_limit_micro_usd)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-400">
              <span>Monthly limit</span>
              <span className="font-medium text-gray-900 dark:text-dark-100">{formatMoney(activeCard.monthly_limit_micro_usd)}</span>
            </div>
          </div>

          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-dark-100 text-sm mb-1">Recent activity</h3>
            {data.transactions.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-dark-500 py-4 text-center">No transactions yet</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-dark-700">
                {data.transactions.map(txn => <TxnRow key={txn.id} txn={txn} />)}
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-[10px] text-gray-400 dark:text-dark-500 text-center px-4">
        A portion of every purchase generates interchange revenue that supports {churchName}'s mission.
        {data.adapter_mode === 'mock' && ' (Sandbox mode — no real money moves.)'}
      </p>
    </div>
  );
}

function Hero({ churchName, primaryColor }: { churchName: string; primaryColor: string }) {
  return (
    <div
      className="rounded-2xl p-5 text-white relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${primaryColor}, #1e293b)` }}
    >
      <Sparkles size={20} className="text-white/80 mb-3" />
      <h2 className="text-xl font-bold leading-tight">GRACE Impact Card</h2>
      <p className="text-sm text-white/85 mt-1.5">
        A debit card that gives back — every purchase generates support for {churchName} at no cost to you.
      </p>
    </div>
  );
}
