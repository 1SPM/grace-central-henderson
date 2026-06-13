import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Ban,
  CreditCard,
  Loader2,
  Play,
  Shield,
  Snowflake,
} from 'lucide-react';
import type { Person } from '../../types';
import type { AdminCardData, CardRecord } from '../../lib/services/impactCard';
import { cancelCard, freezeCard, unfreezeCard } from '../../lib/services/impactCard';
import {
  fmtImpactUsd,
  getMemberCards,
  getMemberTransactions,
  spendMicroToEarnedPoints,
} from '../../hooks/useImpactCardProgram';

interface MemberWalletDetailProps {
  person: Person;
  adminData: AdminCardData;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  busyId: string | null;
  withBusy: (id: string, fn: () => Promise<unknown>) => Promise<void>;
}

function CardVisual({ card }: { card: CardRecord }) {
  const isFrozen = card.status === 'frozen';
  return (
    <div
      className={`rounded-2xl p-4 text-white shadow-lg relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-950 ${isFrozen ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between mb-6">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">GRACE Impact Card</span>
        <span className="text-xs font-semibold italic text-white/80">VISA</span>
      </div>
      <p className="text-base tracking-[0.2em] font-medium mb-4">{card.masked_pan}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-white/50 uppercase">Daily limit</p>
          <p className="text-sm font-semibold">{fmtImpactUsd(card.daily_limit_micro_usd)}</p>
          <p className="text-[10px] text-white/50 uppercase mt-2">Monthly limit</p>
          <p className="text-sm font-semibold">{fmtImpactUsd(card.monthly_limit_micro_usd)}</p>
        </div>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
            isFrozen ? 'bg-blue-200/30 text-blue-100' : 'bg-emerald-300/20 text-emerald-200'
          }`}
        >
          {card.status}
        </span>
      </div>
    </div>
  );
}

export function MemberWalletDetail({
  person,
  adminData,
  onBack,
  busyId,
  withBusy,
}: MemberWalletDetailProps) {
  const cards = getMemberCards(adminData, person.id);
  const transactions = getMemberTransactions(adminData, person.id);
  const kyc = adminData.kyc_queue.find(k => k.person_id === person.id);

  const mtdSpendMicro = transactions
    .filter(t => t.event_type === 'capture' && t.direction === 'debit')
    .reduce((sum, t) => sum + t.amount_micro_usd, 0);
  const earnedPoints = spendMicroToEarnedPoints(mtdSpendMicro);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-dark-400 hover:text-gray-800 dark:hover:text-dark-200 mb-4 transition-colors"
      >
        <ArrowLeft size={15} /> All accounts
      </button>

      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 bg-slate-900 dark:bg-dark-100 rounded-full flex items-center justify-center text-sm font-semibold text-white dark:text-dark-900">
            {person.firstName[0]}{person.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="serif text-2xl text-slate-900 dark:text-dark-100 leading-none">
              {person.firstName} {person.lastName}
            </h1>
            <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">{person.email}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {kyc?.status === 'approved' ? (
              <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <BadgeCheck size={12} /> KYC approved
              </span>
            ) : kyc ? (
              <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 capitalize">
                KYC {kyc.status.replace('_', ' ')}
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-dark-400">
                Not enrolled
              </span>
            )}
            {adminData.adapter_mode === 'mock' && (
              <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                i2c sandbox
              </span>
            )}
            {adminData.adapter_mode === 'live' && (
              <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                i2c live
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {cards.length === 0 ? (
            <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-8 text-center">
              <CreditCard size={32} className="mx-auto text-gray-300 dark:text-dark-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-dark-400">No Impact Card issued for this member</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cards.map(card => (
                <div key={card.id} className="space-y-3">
                  <CardVisual card={card} />
                  <div className="flex items-center gap-2">
                    {card.status === 'active' && (
                      <button
                        onClick={() => withBusy(card.id, () => freezeCard(card.id))}
                        disabled={busyId === card.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-cyan-300 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-400 rounded-lg disabled:opacity-50"
                      >
                        {busyId === card.id ? <Loader2 size={12} className="animate-spin" /> : <Snowflake size={12} />}
                        Freeze
                      </button>
                    )}
                    {card.status === 'frozen' && (
                      <button
                        onClick={() => withBusy(card.id, () => unfreezeCard(card.id))}
                        disabled={busyId === card.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 rounded-lg disabled:opacity-50"
                      >
                        {busyId === card.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                        Unfreeze
                      </button>
                    )}
                    {card.status !== 'cancelled' && card.status !== 'expired' && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Cancel card ${card.masked_pan}? This cannot be undone.`)) {
                            void withBusy(card.id, () => cancelCard(card.id));
                          }
                        }}
                        disabled={busyId === card.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 rounded-lg disabled:opacity-50"
                      >
                        <Ban size={12} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Recent transactions</h2>
              <span className="text-[10px] text-gray-400 dark:text-dark-500">i2c merchant program</span>
            </div>
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-dark-500 text-center py-6">No card activity yet</p>
            ) : (
              <div className="space-y-0.5">
                {transactions.map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-dark-700 last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          tx.direction === 'credit'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-400'
                        }`}
                      >
                        {tx.direction === 'credit' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                          {tx.merchant_name ?? tx.event_type}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-dark-500">
                          {new Date(tx.occurred_at).toLocaleString()} · {tx.event_type}
                          {tx.decline_reason ? ` · ${tx.decline_reason}` : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-medium tabular-nums flex-shrink-0 ${
                        tx.direction === 'credit'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-gray-900 dark:text-dark-100'
                      }`}
                    >
                      {tx.direction === 'credit' ? '+' : '−'}{fmtImpactUsd(tx.amount_micro_usd)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <p className="section-eyebrow">Card spend (MTD)</p>
            <p className="stat-number text-3xl text-slate-900 dark:text-dark-100 mt-1.5">
              {fmtImpactUsd(mtdSpendMicro)}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-2">
              ≈ {earnedPoints.toLocaleString()} pts earned (1 pt / $1 spend)
            </p>
          </div>

          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <p className="section-eyebrow mb-2 flex items-center gap-1.5">
              <Shield size={12} /> Program
            </p>
            <p className="text-xs text-gray-600 dark:text-dark-300 leading-relaxed">
              Card issued via i2cInc merchant services. Member spend generates interchange revenue
              credited to the church ledger; rewards points are estimated from capture events until
              a dedicated points ledger is deployed.
            </p>
          </div>

          {kyc && (
            <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <p className="section-eyebrow mb-2">KYC record</p>
              <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{kyc.full_name}</p>
              <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-1 capitalize">
                Status: {kyc.status.replace('_', ' ')}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-dark-500">
                Submitted {new Date(kyc.submitted_at).toLocaleDateString()}
              </p>
              {kyc.rejection_reason && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">{kyc.rejection_reason}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
