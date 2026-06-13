/**
 * Impact Card Program — admin ops panel (KYC, card roster, interchange).
 *
 * All data flows through /api/neobank (i2cInc merchant services). In mock
 * mode a "simulate transaction" control exercises the real webhook pipeline
 * (webhook_events → interchange_events → ledger_entries).
 */

import { useState } from 'react';
import {
  CreditCard,
  ShieldCheck,
  ShieldOff,
  Snowflake,
  Play,
  Ban,
  Loader2,
  Zap,
  TrendingUp,
} from 'lucide-react';
import {
  reviewKyc,
  freezeCard,
  unfreezeCard,
  cancelCard,
  issueCard,
  type AdminCardData,
  type CardRecord,
} from '../../lib/services/impactCard';
import { getClerkTokenProvider } from '../../lib/supabase';
import {
  fmtImpactUsd,
  useImpactCardProgram,
  type UseImpactCardProgramResult,
} from '../../hooks/useImpactCardProgram';

const DEMO_MERCHANTS = [
  { name: 'Harvest Grocery', category: '5411' },
  { name: 'Shell Gas Station', category: '5541' },
  { name: 'Chick-fil-A', category: '5814' },
  { name: 'Target', category: '5310' },
  { name: 'CVS Pharmacy', category: '5912' },
];

async function simulateTransaction(card: CardRecord): Promise<void> {
  const provider = getClerkTokenProvider();
  const token = provider ? await provider() : null;
  if (!token) throw new Error('Sign in required');

  const merchant = DEMO_MERCHANTS[Math.floor(Math.random() * DEMO_MERCHANTS.length)];
  const amountMicroUsd = (Math.floor(Math.random() * 9000) + 500) * 10_000;
  const eventId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const sendEvent = (payload: Record<string, unknown>) =>
    fetch('/api/webhooks/i2c', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

  const captureRes = await sendEvent({
    event_id: eventId,
    event_type: 'capture',
    i2c_card_id: card.i2c_card_id,
    amount_micro_usd: amountMicroUsd,
    direction: 'debit',
    merchant_name: merchant.name,
    merchant_category: merchant.category,
    occurred_at: new Date().toISOString(),
  });
  if (!captureRes.ok) throw new Error('Simulation failed');

  await sendEvent({
    event_id: `${eventId}_fee`,
    event_type: 'fee',
    i2c_card_id: card.i2c_card_id,
    amount_micro_usd: Math.max(10_000, Math.round(amountMicroUsd * 0.015)),
    direction: 'credit',
    merchant_name: merchant.name,
    occurred_at: new Date().toISOString(),
  });
}

async function approveAndIssue(kycId: string): Promise<void> {
  await reviewKyc(kycId, 'approve');
  await issueCard(kycId);
}

interface CardProgramSectionProps {
  program?: UseImpactCardProgramResult;
  embedded?: boolean;
}

export function CardProgramSection({ program: programProp, embedded }: CardProgramSectionProps) {
  const internal = useImpactCardProgram();
  const program = programProp ?? internal;
  const { data, state, gateMessage, errorMessage, refetch } = program;

  const [busyId, setBusyId] = useState<string | null>(null);

  const withBusy = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await fn();
      await refetch();
    } catch (err) {
      console.warn('[card-program] action failed', err);
    } finally {
      setBusyId(null);
    }
  };

  if (state === 'loading') {
    return (
      <div className={`${embedded ? '' : 'mt-8'} p-8 flex justify-center`}>
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (state === 'unavailable') {
    return (
      <div className={embedded ? '' : 'mt-8'}>
        {!embedded && <SectionHeader />}
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          {program.errorMessage || 'Impact Card program data is unavailable.'}
        </div>
      </div>
    );
  }

  if (state === 'gated') {
    return (
      <div className={embedded ? '' : 'mt-8'}>
        <SectionHeader />
        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-5 text-sm text-indigo-800 dark:text-indigo-300">
          {gateMessage || 'The GRACE Impact Card program requires the Enterprise plan.'}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <CardProgramContent
      data={data}
      busyId={busyId}
      withBusy={withBusy}
      embedded={embedded}
    />
  );
}

interface CardProgramContentProps {
  data: AdminCardData;
  busyId: string | null;
  withBusy: (id: string, fn: () => Promise<unknown>) => Promise<void>;
  embedded?: boolean;
}

export function CardProgramContent({ data, busyId, withBusy, embedded }: CardProgramContentProps) {
  const pendingKyc = data.kyc_queue.filter(k => k.status === 'pending' || k.status === 'in_review');
  const liveCards = data.cards.filter(c => c.status !== 'cancelled' && c.status !== 'expired');

  return (
    <div className={embedded ? '' : 'mt-8'}>
      <SectionHeader mode={data.adapter_mode} />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-dark-400">
        <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-dark-700">
          Adapter: {data.adapter_mode === 'live' ? 'i2c live' : 'i2c sandbox (mock)'}
        </span>
        <a
          href="https://www.i2cinc.com/products/merchant-services"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          i2c program docs →
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pending KYC', value: String(data.summary.pending_kyc), icon: ShieldCheck, accent: 'text-amber-600 dark:text-amber-400' },
          { label: 'Active cards', value: String(data.summary.active_cards), icon: CreditCard, accent: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Interchange (MTD)', value: fmtImpactUsd(data.summary.interchange_mtd_micro_usd), icon: TrendingUp, accent: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Card spend (MTD)', value: fmtImpactUsd(data.summary.spend_mtd_micro_usd), icon: Zap, accent: 'text-slate-600 dark:text-slate-400' },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="bg-stone-100 dark:bg-dark-800 border border-stone-200 dark:border-dark-700 rounded-xl p-4">
            <Icon size={16} className={`${accent} mb-2`} />
            <p className="text-xl font-bold text-gray-900 dark:text-dark-100">{value}</p>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-stone-100 dark:bg-dark-800 border border-stone-200 dark:border-dark-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-stone-200 dark:border-dark-700">
            <h3 className="font-medium text-gray-900 dark:text-dark-100 text-sm">KYC approval queue</h3>
            <p className="text-xs text-gray-500 dark:text-dark-400">{pendingKyc.length} awaiting review</p>
          </div>
          <div className="divide-y divide-stone-200 dark:divide-dark-700 max-h-80 overflow-y-auto">
            {pendingKyc.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400 dark:text-dark-500">Queue is clear</p>
            ) : (
              pendingKyc.map(kyc => (
                <div key={kyc.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">{kyc.full_name}</p>
                    <p className="text-xs text-gray-400 dark:text-dark-500">
                      {kyc.email} · {new Date(kyc.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => withBusy(kyc.id, () => reviewKyc(kyc.id, 'approve'))}
                    disabled={busyId === kyc.id}
                    className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 flex items-center gap-1"
                  >
                    <ShieldCheck size={12} /> Approve
                  </button>
                  <button
                    onClick={() => withBusy(`issue-${kyc.id}`, () => approveAndIssue(kyc.id))}
                    disabled={busyId === `issue-${kyc.id}`}
                    title="Approve KYC and issue card in one step"
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 flex items-center gap-1"
                  >
                    <CreditCard size={12} /> Approve + Issue
                  </button>
                  <button
                    onClick={() => withBusy(kyc.id, () => reviewKyc(kyc.id, 'reject'))}
                    disabled={busyId === kyc.id}
                    className="px-2.5 py-1.5 border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg disabled:opacity-50 flex items-center gap-1"
                  >
                    <ShieldOff size={12} /> Reject
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-stone-100 dark:bg-dark-800 border border-stone-200 dark:border-dark-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-stone-200 dark:border-dark-700">
            <h3 className="font-medium text-gray-900 dark:text-dark-100 text-sm">Issued cards</h3>
            <p className="text-xs text-gray-500 dark:text-dark-400">{liveCards.length} live · i2c merchant program</p>
          </div>
          <div className="divide-y divide-stone-200 dark:divide-dark-700 max-h-80 overflow-y-auto">
            {liveCards.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400 dark:text-dark-500">No cards issued yet</p>
            ) : (
              liveCards.map(card => (
                <div key={card.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                      {card.cardholder_name} <span className="font-mono text-xs text-gray-400">{card.masked_pan}</span>
                    </p>
                    <p className="text-xs text-gray-400 dark:text-dark-500 capitalize">
                      {card.status} · {fmtImpactUsd(card.daily_limit_micro_usd)}/day
                    </p>
                  </div>
                  {data.adapter_mode === 'mock' && card.status === 'active' && (
                    <button
                      onClick={() => withBusy(`sim-${card.id}`, () => simulateTransaction(card))}
                      disabled={busyId === `sim-${card.id}`}
                      title="Simulate a card transaction through the i2c webhook pipeline"
                      className="px-2 py-1.5 border border-gray-300 dark:border-dark-600 text-gray-600 dark:text-dark-300 text-xs rounded-lg disabled:opacity-50 flex items-center gap-1"
                    >
                      {busyId === `sim-${card.id}` ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} Simulate txn
                    </button>
                  )}
                  {card.status === 'active' ? (
                    <button
                      onClick={() => withBusy(card.id, () => freezeCard(card.id))}
                      disabled={busyId === card.id}
                      className="p-1.5 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg disabled:opacity-50"
                      title="Freeze card"
                    >
                      <Snowflake size={14} />
                    </button>
                  ) : card.status === 'frozen' ? (
                    <button
                      onClick={() => withBusy(card.id, () => unfreezeCard(card.id))}
                      disabled={busyId === card.id}
                      className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg disabled:opacity-50"
                      title="Unfreeze card"
                    >
                      <Play size={14} />
                    </button>
                  ) : null}
                  <button
                    onClick={() => {
                      if (window.confirm(`Cancel ${card.cardholder_name}'s card ${card.masked_pan}? This cannot be undone.`)) {
                        void withBusy(card.id, () => cancelCard(card.id));
                      }
                    }}
                    disabled={busyId === card.id}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg disabled:opacity-50"
                    title="Cancel card"
                  >
                    <Ban size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {data.interchange_events.length > 0 && (
        <div className="mt-6 bg-stone-100 dark:bg-dark-800 border border-stone-200 dark:border-dark-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-stone-200 dark:border-dark-700">
            <h3 className="font-medium text-gray-900 dark:text-dark-100 text-sm">Recent card activity</h3>
          </div>
          <div className="divide-y divide-stone-200 dark:divide-dark-700 max-h-72 overflow-y-auto">
            {data.interchange_events.slice(0, 25).map(e => (
              <div key={e.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                  e.event_type === 'fee'
                    ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : e.event_type === 'declined'
                      ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300'
                }`}>
                  {e.event_type}
                </span>
                <span className="flex-1 text-gray-700 dark:text-dark-300 truncate">
                  {e.merchant_name ?? '—'}
                </span>
                <span className="text-xs text-gray-400 dark:text-dark-500">
                  {new Date(e.occurred_at).toLocaleString()}
                </span>
                <span className={`font-semibold ${e.direction === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-dark-100'}`}>
                  {e.direction === 'credit' ? '+' : '−'}{fmtImpactUsd(e.amount_micro_usd)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ mode }: { mode?: 'live' | 'mock' }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="serif text-2xl text-slate-900 dark:text-dark-100 leading-none">Impact Card Program</h2>
        <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
          GRACE Impact Card — i2cInc merchant services, KYC, card roster, and interchange revenue
        </p>
      </div>
      {mode === 'mock' && (
        <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
          Sandbox mode
        </span>
      )}
      {mode === 'live' && (
        <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full">
          i2c live
        </span>
      )}
    </div>
  );
}
