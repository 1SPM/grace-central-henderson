import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Fingerprint,
  Landmark,
  Plus,
  RefreshCw,
  Send,
  Shield,
  SlidersHorizontal,
  Smartphone,
  Snowflake,
  Trophy,
} from 'lucide-react';
import type { Person } from '../../types';
import { getDemoWallet, type CardRail } from './demoWallets';

interface MemberWalletDetailProps {
  person: Person;
  onBack: () => void;
}

const RAIL_PILL: Record<CardRail, string> = {
  i2c: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  VERUS: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'DIV minted': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
};

export function MemberWalletDetail({ person, onBack }: MemberWalletDetailProps) {
  const wallet = getDemoWallet(person);
  // Demo freeze state; wire to the impactCard service when a live card
  // exists for this member.
  const [frozen, setFrozen] = useState<Record<string, boolean>>(
    Object.fromEntries(wallet.cards.map(c => [c.type, c.status === 'Frozen'])),
  );

  const maxTrend = Math.max(...wallet.balanceTrend, 1);

  const controls = [
    { icon: Smartphone, label: 'Virtual card' },
    { icon: Plus, label: 'Add to wallet' },
    { icon: SlidersHorizontal, label: 'Spend limits' },
    { icon: Landmark, label: 'Link ACH' },
    { icon: RefreshCw, label: 'Replace card' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Identity bar */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-dark-400 hover:text-gray-800 dark:hover:text-dark-200 mb-4 transition-colors"
      >
        <ArrowLeft size={15} /> All wallets
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
            <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">{person.email || wallet.verusId}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              Wallet active
            </span>
            {wallet.kycApproved ? (
              <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <BadgeCheck size={12} /> KYC approved
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                KYC pending
              </span>
            )}
            {wallet.cards.map(c => (
              <span
                key={c.type}
                className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-dark-300"
              >
                <CreditCard size={11} /> {c.type === 'debit' ? 'Debit' : 'Credit'} •{c.last4}
              </span>
            ))}
            <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              <Fingerprint size={11} /> {wallet.verusId}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              <Trophy size={11} /> Giving rank #{wallet.givingRank}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 cols: cards + controls + transactions */}
        <div className="lg:col-span-2 space-y-4">
          {/* Card visuals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {wallet.cards.map(card => {
              const isFrozen = frozen[card.type];
              const pct = Math.min(Math.round((card.mtdSpend / card.limit) * 100), 100);
              return (
                <div
                  key={card.type}
                  className={`rounded-2xl p-4 text-white shadow-lg relative overflow-hidden ${
                    card.type === 'debit'
                      ? 'bg-gradient-to-br from-slate-800 to-slate-950'
                      : 'bg-gradient-to-br from-amber-700 to-stone-900'
                  } ${isFrozen ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">
                      GRACE Impact {card.type}
                    </span>
                    <span className="text-xs font-semibold italic text-white/80">VISA</span>
                  </div>
                  <p className="text-base tracking-[0.2em] font-medium mb-4">•••• •••• •••• {card.last4}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-white/50 uppercase">MTD spend</p>
                      <p className="text-sm font-semibold">
                        ${card.mtdSpend.toLocaleString()}
                        <span className="text-white/50 font-normal"> / ${card.limit.toLocaleString()}</span>
                      </p>
                      <div className="w-28 h-1 bg-white/20 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-white/80 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        isFrozen ? 'bg-blue-200/30 text-blue-100' : 'bg-emerald-300/20 text-emerald-200'
                      }`}
                    >
                      {isFrozen ? 'Frozen' : 'Active'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Card controls */}
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-3">Card controls</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {controls.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-gray-50 dark:bg-dark-850 hover:bg-gray-100 dark:hover:bg-dark-750 transition-colors"
                >
                  <Icon size={16} className="text-gray-600 dark:text-dark-300" />
                  <span className="text-[10px] text-gray-600 dark:text-dark-300 text-center leading-tight">{label}</span>
                </button>
              ))}
              <button
                onClick={() => setFrozen(f => ({ ...f, debit: !f.debit }))}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors ${
                  frozen.debit
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-50 dark:bg-dark-850 hover:bg-gray-100 dark:hover:bg-dark-750 text-gray-600 dark:text-dark-300'
                }`}
              >
                <Snowflake size={16} />
                <span className="text-[10px] text-center leading-tight">{frozen.debit ? 'Unfreeze' : 'Freeze'}</span>
              </button>
            </div>
          </div>

          {/* Transactions */}
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Recent transactions</h2>
              <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-dark-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> i2c rail</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> VERUS</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" /> DIV minted</span>
              </div>
            </div>
            <div className="space-y-0.5">
              {wallet.transactions.map(tx => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-dark-700 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        tx.direction === 'in'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-400'
                      }`}
                    >
                      {tx.direction === 'in' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">{tx.merchant}</p>
                      <p className="text-[11px] text-gray-400 dark:text-dark-500">
                        {new Date(tx.date).toLocaleDateString()} · {tx.category}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${RAIL_PILL[tx.rail]}`}>
                      {tx.rail}
                    </span>
                    <span
                      className={`text-sm font-medium tabular-nums ${
                        tx.direction === 'in'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-gray-900 dark:text-dark-100'
                      }`}
                    >
                      {tx.direction === 'in' ? '+' : '−'}${tx.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Balance + trend + actions */}
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <p className="section-eyebrow">Wallet balance</p>
            <p className="stat-number text-3xl text-slate-900 dark:text-dark-100 mt-1.5">
              ${wallet.balance.toLocaleString()}
            </p>
            <div className="flex items-end gap-1 h-12 mt-3">
              {wallet.balanceTrend.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 bg-emerald-600/70 dark:bg-emerald-500/60 rounded-sm"
                  style={{ height: `${(v / maxTrend) * 100}%` }}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <button className="flex flex-col items-center gap-1 py-2 rounded-lg bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-950 transition-colors">
                <Send size={13} /> Send
              </button>
              <button className="flex flex-col items-center gap-1 py-2 rounded-lg border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 text-[11px] font-medium hover:bg-gray-50 dark:hover:bg-dark-850 transition-colors">
                <ArrowDownLeft size={13} /> Receive
              </button>
              <button className="flex flex-col items-center gap-1 py-2 rounded-lg border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 text-[11px] font-medium hover:bg-gray-50 dark:hover:bg-dark-850 transition-colors">
                <Banknote size={13} /> Top up
              </button>
            </div>
          </div>

          {/* VerusID */}
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <p className="section-eyebrow mb-2">VerusID</p>
            <div className="flex items-center gap-2.5 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <Fingerprint size={18} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">{wallet.verusId}</p>
                <p className="text-[10px] text-gray-500 dark:text-dark-400">
                  Self-sovereign identity · on-chain attestation
                </p>
              </div>
            </div>
          </div>

          {/* Fund tokens */}
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <p className="section-eyebrow mb-3">Fund tokens held</p>
            <div className="space-y-2">
              {wallet.fundTokens.map(token => (
                <div key={token.symbol} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <Coins size={14} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{token.symbol}</p>
                      <p className="text-[10px] text-gray-400 dark:text-dark-500">{token.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100 tabular-nums">
                      {token.balance.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-dark-500">≈ ${token.usd.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* KYC compliance checklist */}
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <p className="section-eyebrow mb-3 flex items-center gap-1.5">
              <Shield size={12} /> KYC &amp; compliance
            </p>
            <div className="space-y-2.5">
              {wallet.kyc.map(item => (
                <div key={item.label} className="flex items-start gap-2.5">
                  {item.status === 'passed' ? (
                    <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Clock size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-xs font-medium text-gray-900 dark:text-dark-100">{item.label}</p>
                    <p className="text-[10px] text-gray-400 dark:text-dark-500">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
