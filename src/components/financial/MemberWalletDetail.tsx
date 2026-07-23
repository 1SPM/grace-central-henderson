import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Gift,
  Heart,
  Landmark,
  Loader2,
  MapPin,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  Wallet,
} from 'lucide-react';
import type { Giving, Person } from '../../types';
import type { AdminCardData, CardRecord } from '../../lib/services/impactCard';
import {
  issueCard,
  markTransferForReview,
  retryTransfer,
  setCardLimits,
  setImpactRoute,
  syncAccountBalance,
} from '../../lib/services/impactCard';
import {
  fmtImpactUsd,
  getMemberAccount,
  getMemberCards,
  getMemberImpactMtd,
  getMemberImpactRoute,
  getMemberTransactions,
  getMemberTransfers,
  IMPACT_ROUTE_OPTIONS,
  spendMicroToEarnedPoints,
} from '../../hooks/useImpactCardProgram';
import { buildStatementInput, downloadImpactCardStatement } from './impactCardStatement';
import { CardActionControls, StaffReasonModal } from './CardActionControls';

type DetailTab = 'overview' | 'transactions' | 'transfers' | 'giving' | 'route' | 'activity';

interface MemberWalletDetailProps {
  person: Person;
  adminData: AdminCardData;
  giving?: Giving[];
  churchName?: string;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onViewPortalActivity?: () => void;
  busyId: string | null;
  withBusy: (id: string, fn: () => Promise<unknown>) => Promise<void>;
}

function copyText(value: string) {
  void navigator.clipboard.writeText(value);
}

function DepositPanel({
  account,
  busyId,
  personId,
  withBusy,
}: {
  account: NonNullable<ReturnType<typeof getMemberAccount>>;
  busyId: string | null;
  personId: string;
  withBusy: (id: string, fn: () => Promise<unknown>) => Promise<void>;
}) {
  const maskedAcct = `••••${account.account_number_last4}`;
  return (
    <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
      <p className="section-eyebrow mb-3 flex items-center gap-1"><Landmark size={12} /> ACH deposit details</p>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500 dark:text-dark-400">Account name</dt>
          <dd className="font-medium text-gray-900 dark:text-dark-100">{account.account_name}</dd>
        </div>
        <div className="flex justify-between gap-2 items-center">
          <dt className="text-gray-500 dark:text-dark-400">Account number</dt>
          <dd className="flex items-center gap-1.5 font-mono text-gray-900 dark:text-dark-100">
            {maskedAcct}
            <button onClick={() => copyText(maskedAcct)} className="p-1 text-gray-400 hover:text-gray-600" title="Copy">
              <Copy size={12} />
            </button>
          </dd>
        </div>
        {account.routing_number && (
          <div className="flex justify-between gap-2 items-center">
            <dt className="text-gray-500 dark:text-dark-400">Routing number</dt>
            <dd className="flex items-center gap-1.5 font-mono text-gray-900 dark:text-dark-100">
              {account.routing_number}
              <button onClick={() => copyText(account.routing_number!)} className="p-1 text-gray-400 hover:text-gray-600" title="Copy">
                <Copy size={12} />
              </button>
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500 dark:text-dark-400">Last synced</dt>
          <dd className="text-gray-700 dark:text-dark-300">
            {account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : '—'}
          </dd>
        </div>
      </dl>
      <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-3 leading-relaxed">
        Full account numbers are not stored in CRM (PCI). Unmasked values are available in the i2c merchant console.
      </p>
      <button
        onClick={() => withBusy(`sync-${personId}`, () => syncAccountBalance(personId))}
        disabled={busyId === `sync-${personId}`}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-dark-600 rounded-lg disabled:opacity-50"
      >
        {busyId === `sync-${personId}` ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        Sync balance from i2c
      </button>
    </div>
  );
}

/** Mastercard brand mark — two overlapping circles in the official colors. */
function MastercardMark() {
  return (
    <svg viewBox="0 0 48 30" className="w-11 h-auto" role="img" aria-label="Mastercard">
      <defs>
        <clipPath id="impact-mc-lens">
          <circle cx="17" cy="15" r="14" />
        </clipPath>
      </defs>
      <circle cx="17" cy="15" r="14" fill="#EB001B" />
      <circle cx="31" cy="15" r="14" fill="#F79E1B" />
      <g clipPath="url(#impact-mc-lens)">
        <circle cx="31" cy="15" r="14" fill="#FF5F00" />
      </g>
    </svg>
  );
}

function CardVisual({ card, routeLabel }: { card: CardRecord; routeLabel?: string | null }) {
  const isFrozen = card.status === 'frozen';
  return (
    <div
      className={`rounded-2xl p-4 text-white shadow-lg relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-950 ${isFrozen ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 min-w-0">
          {/* Logo PNG has a white background (no alpha) — the white chip makes that read as intentional. */}
          <span className="w-7 h-7 rounded-full bg-white overflow-hidden flex-shrink-0 shadow">
            <img
              src="/previews/assets/central-henderson-logo.png"
              alt="Central Henderson"
              className="w-full h-full object-cover"
            />
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/60 truncate">GRACE Impact Card</span>
        </div>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${
            isFrozen ? 'bg-blue-200/30 text-blue-100' : 'bg-emerald-300/20 text-emerald-200'
          }`}
        >
          {card.status}
        </span>
      </div>
      <p className="text-base tracking-[0.2em] font-medium mb-4">{card.masked_pan}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-white/50 uppercase">Cardholder</p>
          <p className="text-sm font-semibold truncate max-w-[180px]">{card.cardholder_name}</p>
          {routeLabel && (
            <>
              <p className="text-[10px] text-white/50 uppercase mt-2">Impact route</p>
              <p className="text-sm font-semibold">{routeLabel}</p>
            </>
          )}
        </div>
        <MastercardMark />
      </div>
    </div>
  );
}

function microFromDollarsInput(value: string): number | null {
  const n = parseFloat(value);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 1_000_000);
}

export function MemberWalletDetail({
  person,
  adminData,
  giving = [],
  churchName = 'Grace Church',
  onBack,
  onViewPortalActivity,
  busyId,
  withBusy,
}: MemberWalletDetailProps) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [txnFilter, setTxnFilter] = useState<'all' | 'declined'>('all');
  const [limitsCardId, setLimitsCardId] = useState<string | null>(null);
  const [dailyLimit, setDailyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [routeLabel, setRouteLabel] = useState('');
  const [routeFund, setRouteFund] = useState('tithe');
  const [transferReviewAction, setTransferReviewAction] = useState<{ transferId: string } | null>(null);

  const cards = getMemberCards(adminData, person.id);
  const account = getMemberAccount(adminData, person.id);
  const impactRoute = getMemberImpactRoute(adminData, person.id);
  const transfers = getMemberTransfers(adminData, person.id);
  const allTransactions = getMemberTransactions(adminData, person.id);
  const kyc = adminData.kyc_queue.find(k => k.person_id === person.id);
  const activeCard = cards.find(c => c.status === 'active' || c.status === 'frozen') ?? cards[0];
  const lastStaffAction = activeCard?.metadata?.last_staff_action;

  const handleTransferReviewConfirm = async (reason: string) => {
    if (!transferReviewAction) return;
    const { transferId } = transferReviewAction;
    setTransferReviewAction(null);
    await withBusy(`review-${transferId}`, () => markTransferForReview(transferId, reason));
  };

  const exportStatement = () => {
    downloadImpactCardStatement(buildStatementInput(person, adminData, churchName, {
      account,
      impactRoute,
      transactions: allTransactions,
      transfers,
      impactMtdMicroUsd: impactMtd,
      spendMtdMicroUsd: mtdSpendMicro,
    }));
  };

  const transactions = useMemo(() => {
    if (txnFilter === 'declined') return allTransactions.filter(t => t.event_type === 'declined');
    return allTransactions;
  }, [allTransactions, txnFilter]);

  const mtdSpendMicro = allTransactions
    .filter(t => t.event_type === 'capture' && t.direction === 'debit')
    .reduce((sum, t) => sum + t.amount_micro_usd, 0);
  const impactMtd = getMemberImpactMtd(adminData, person.id);
  const earnedPoints = spendMicroToEarnedPoints(mtdSpendMicro);
  const personGiving = giving.filter(g => g.personId === person.id);
  const givingYtd = personGiving.reduce((s, g) => s + g.amount, 0);
  const givingGoal = 5000;

  const openLimitsEditor = (card: CardRecord) => {
    setLimitsCardId(card.id);
    setDailyLimit(String(card.daily_limit_micro_usd / 1_000_000));
    setMonthlyLimit(String(card.monthly_limit_micro_usd / 1_000_000));
  };

  const saveLimits = async (cardId: string) => {
    const daily = microFromDollarsInput(dailyLimit);
    const monthly = microFromDollarsInput(monthlyLimit);
    if (daily === null || monthly === null) return;
    await withBusy(`limits-${cardId}`, () =>
      setCardLimits(cardId, { dailyMicroUsd: daily, monthlyMicroUsd: monthly }),
    );
    setLimitsCardId(null);
  };

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'transfers', label: 'Transfers' },
    { id: 'giving', label: 'Giving' },
    { id: 'route', label: 'Impact Route' },
    { id: 'activity', label: 'Activity' },
  ];

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
          </div>
        </div>
      </div>

      {/* Command center header — two panel mockup layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div>
          {activeCard ? (
            <CardVisual card={activeCard} routeLabel={impactRoute?.route_label} />
          ) : (
            <div className="rounded-2xl p-8 text-center border border-dashed border-gray-300 dark:border-dark-600 bg-stone-50 dark:bg-dark-850">
              <CreditCard size={32} className="mx-auto text-gray-300 dark:text-dark-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-dark-400 mb-3">No Impact Card issued</p>
              {kyc?.status === 'approved' && (
                <button
                  onClick={() => withBusy(`issue-${kyc.id}`, () => issueCard(kyc.id))}
                  disabled={busyId === `issue-${kyc.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg disabled:opacity-50"
                >
                  {busyId === `issue-${kyc.id}` ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  Issue card
                </button>
              )}
            </div>
          )}
          {activeCard && (
            <div className="flex flex-wrap gap-2 mt-3">
              <CardActionControls card={activeCard} busyId={busyId} withBusy={withBusy} />
              <button
                onClick={() => openLimitsEditor(activeCard)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-lg"
              >
                <Save size={12} /> Set limits
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="section-eyebrow flex items-center gap-1"><Wallet size={12} /> Available balance</p>
                <p className="stat-number text-3xl text-slate-900 dark:text-dark-100 mt-1">
                  {account ? fmtImpactUsd(account.available_balance_micro_usd) : '—'}
                </p>
                {account && (
                  <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-1">
                    Acct ••••{account.account_number_last4}
                    {account.routing_number ? ` · Routing ${account.routing_number}` : ''}
                  </p>
                )}
              </div>
              {account && (
                <button
                  onClick={() => withBusy(`sync-${person.id}`, () => syncAccountBalance(person.id))}
                  disabled={busyId === `sync-${person.id}`}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                  title="Sync balance from i2c"
                >
                  {busyId === `sync-${person.id}` ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <p className="section-eyebrow flex items-center gap-1"><Heart size={12} /> Card Impact MTD</p>
              <p className="stat-number text-xl text-emerald-700 dark:text-emerald-400 mt-1">{fmtImpactUsd(impactMtd)}</p>
            </div>
            <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <p className="section-eyebrow">Spend MTD</p>
              <p className="stat-number text-xl text-slate-900 dark:text-dark-100 mt-1">{fmtImpactUsd(mtdSpendMicro)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">≈ {earnedPoints} pts</p>
            </div>
          </div>
          {impactRoute && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-500/30 p-3 flex items-center gap-2">
              <MapPin size={14} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-indigo-900 dark:text-indigo-200">Current route: {impactRoute.route_label}</p>
                <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 capitalize">Fund: {impactRoute.route_fund}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Limits editor modal inline */}
      {limitsCardId && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-3">Adjust spending limits (USD)</p>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-xs">
              Daily
              <input
                type="number"
                min={0}
                step={1}
                value={dailyLimit}
                onChange={e => setDailyLimit(e.target.value)}
                className="block mt-1 px-2 py-1.5 text-sm border rounded-lg w-28 dark:bg-dark-800 dark:border-dark-600"
              />
            </label>
            <label className="text-xs">
              Monthly
              <input
                type="number"
                min={0}
                step={1}
                value={monthlyLimit}
                onChange={e => setMonthlyLimit(e.target.value)}
                className="block mt-1 px-2 py-1.5 text-sm border rounded-lg w-28 dark:bg-dark-800 dark:border-dark-600"
              />
            </label>
            <button
              onClick={() => void saveLimits(limitsCardId)}
              disabled={busyId === `limits-${limitsCardId}`}
              className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg disabled:opacity-50"
            >
              Save limits
            </button>
            <button onClick={() => setLimitsCardId(null)} className="px-3 py-1.5 text-xs text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-dark-700 mb-4 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-slate-900 dark:border-dark-100 text-slate-900 dark:text-dark-100'
                : 'border-transparent text-gray-500 dark:text-dark-400 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {account && (
            <div className="lg:col-span-2">
              <DepositPanel account={account} busyId={busyId} personId={person.id} withBusy={withBusy} />
            </div>
          )}
          <div className="lg:col-span-2 flex justify-end">
            <button
              onClick={exportStatement}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-dark-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750"
            >
              <Download size={14} /> Export statement (PDF)
            </button>
          </div>
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <h2 className="text-sm font-medium mb-3">Recent transactions</h2>
            {allTransactions.slice(0, 5).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No activity</p>
            ) : (
              allTransactions.slice(0, 5).map(tx => (
                <TxnRow key={tx.id} tx={tx} />
              ))
            )}
          </div>
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <h2 className="text-sm font-medium mb-3">Recent transfers</h2>
            {transfers.slice(0, 5).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No transfers</p>
            ) : (
              transfers.slice(0, 5).map(tr => <TransferRow key={tr.id} tr={tr} />)
            )}
          </div>
          <div className="lg:col-span-2 bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <p className="section-eyebrow mb-2 flex items-center gap-1"><Shield size={12} /> Admin notes</p>
            {lastStaffAction && (
              <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2.5 py-1.5 mb-2">
                Last staff action ({lastStaffAction.action.replace('_', ' ')}): {lastStaffAction.reason}
                <span className="text-gray-400 block mt-0.5">{new Date(lastStaffAction.at).toLocaleString()}</span>
              </p>
            )}
            <p className="text-xs text-gray-600 dark:text-dark-300 leading-relaxed">
              Staff can force-freeze, override impact routes, retry failed transfers, and sync balances.
              Deposit account numbers are masked for PCI. Full ACH details available via i2c admin console.
            </p>
          </div>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-medium">Card transactions</h2>
            <div className="flex gap-1">
              {(['all', 'declined'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTxnFilter(f)}
                  className={`px-2.5 py-1 text-xs rounded-lg capitalize ${
                    txnFilter === f
                      ? 'bg-slate-900 text-white dark:bg-dark-100 dark:text-dark-900'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300'
                  }`}
                >
                  {f === 'declined' ? 'Declines only' : 'All'}
                </button>
              ))}
            </div>
          </div>
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No transactions{txnFilter === 'declined' ? ' declined' : ''}</p>
          ) : (
            transactions.map(tx => <TxnRow key={tx.id} tx={tx} />)
          )}
        </div>
      )}

      {tab === 'transfers' && (
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
          <h2 className="text-sm font-medium mb-3">Send / Receive / Give activity</h2>
          {transfers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No transfers recorded</p>
          ) : (
            transfers.map(tr => (
              <div key={tr.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-dark-700 last:border-0 gap-2">
                <TransferRow tr={tr} reviewNote={tr.metadata?.staff_review?.note} />
                {tr.status === 'failed' && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => withBusy(`retry-${tr.id}`, () => retryTransfer(tr.id))}
                      disabled={busyId === `retry-${tr.id}`}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-amber-700 border border-amber-300 rounded-lg"
                    >
                      <RotateCcw size={11} /> Retry
                    </button>
                    <button
                      onClick={() => setTransferReviewAction({ transferId: tr.id })}
                      disabled={busyId === `review-${tr.id}`}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-red-700 border border-red-300 rounded-lg"
                    >
                      Mark for review
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'giving' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <p className="section-eyebrow flex items-center gap-1"><Gift size={12} /> Giving goal progress</p>
            <p className="stat-number text-2xl mt-2">${givingYtd.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">of ${givingGoal.toLocaleString()} goal</p>
            <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full"
                style={{ width: `${Math.min(100, (givingYtd / givingGoal) * 100)}%` }}
              />
            </div>
          </div>
          <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <h2 className="text-sm font-medium mb-3">Recent gifts (Stripe)</h2>
            {personGiving.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No giving records</p>
            ) : (
              personGiving.slice(0, 10).map(g => (
                <div key={g.id} className="flex justify-between py-2 border-b border-gray-100 dark:border-dark-700 last:border-0 text-sm">
                  <span className="text-gray-700 dark:text-dark-300 capitalize">{g.fund} · {g.date}</span>
                  <span className="font-medium tabular-nums">${g.amount.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'route' && (
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 max-w-lg">
          <h2 className="text-sm font-medium mb-1">Override impact route</h2>
          <p className="text-xs text-gray-500 mb-4">Staff override — logged in activity feed</p>
          <div className="space-y-3">
            <label className="block text-xs">
              Cause / fund
              <select
                value={routeLabel || impactRoute?.route_label || ''}
                onChange={e => {
                  const opt = IMPACT_ROUTE_OPTIONS.find(o => o.label === e.target.value);
                  setRouteLabel(e.target.value);
                  if (opt) setRouteFund(opt.fund);
                }}
                className="block w-full mt-1 px-3 py-2 text-sm border rounded-lg dark:bg-dark-850 dark:border-dark-600"
              >
                <option value="">Select route…</option>
                {IMPACT_ROUTE_OPTIONS.map(o => (
                  <option key={o.label} value={o.label}>{o.label}</option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                const label = routeLabel || impactRoute?.route_label;
                if (!label) return;
                void withBusy(`route-${person.id}`, () => setImpactRoute(person.id, label, routeFund));
              }}
              disabled={busyId === `route-${person.id}` || !(routeLabel || impactRoute?.route_label)}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50"
            >
              Save route override
            </button>
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
          <p className="text-sm text-gray-600 dark:text-dark-300 mb-3">
            Card program events (KYC, issue, freeze, transactions) appear in Portal Activity.
          </p>
          {onViewPortalActivity && (
            <button
              onClick={onViewPortalActivity}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg"
            >
              Open Portal Activity <ExternalLink size={14} />
            </button>
          )}
          {kyc && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
              <p className="section-eyebrow mb-2">KYC record</p>
              <p className="text-sm font-medium">{kyc.full_name}</p>
              <p className="text-xs text-gray-400 capitalize">Status: {kyc.status.replace('_', ' ')}</p>
              {kyc.status === 'rejected' && kyc.rejection_reason && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">Reason: {kyc.rejection_reason}</p>
              )}
            </div>
          )}
        </div>
      )}

      {transferReviewAction && (
        <StaffReasonModal
          title="Mark transfer for review"
          confirmLabel="Mark for review"
          onConfirm={reason => void handleTransferReviewConfirm(reason)}
          onCancel={() => setTransferReviewAction(null)}
        />
      )}
    </div>
  );
}

function TxnRow({ tx }: { tx: { id: string; direction: string; merchant_name: string | null; event_type: string; occurred_at: string; decline_reason: string | null; amount_micro_usd: number } }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-dark-700 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          tx.event_type === 'declined'
            ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
            : tx.direction === 'credit'
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
              : 'bg-gray-100 dark:bg-dark-700 text-gray-500'
        }`}>
          {tx.direction === 'credit' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{tx.merchant_name ?? tx.event_type}</p>
          <p className="text-[11px] text-gray-400">
            {new Date(tx.occurred_at).toLocaleString()} · {tx.event_type}
            {tx.decline_reason ? ` · ${tx.decline_reason}` : ''}
          </p>
        </div>
      </div>
      <span className={`text-sm font-medium tabular-nums flex-shrink-0 ${tx.direction === 'credit' ? 'text-emerald-700' : 'text-gray-900 dark:text-dark-100'}`}>
        {tx.direction === 'credit' ? '+' : '−'}{fmtImpactUsd(tx.amount_micro_usd)}
      </span>
    </div>
  );
}

function TransferRow({ tr, reviewNote }: { tr: { direction: string; transfer_type: string; counterparty_name: string; status: string; initiated_at: string; amount_micro_usd: number }; reviewNote?: string }) {
  return (
    <div className="flex items-center justify-between flex-1 min-w-0">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">
          {tr.direction === 'outbound' ? 'Send' : 'Receive'} · {tr.counterparty_name}
        </p>
        <p className="text-[11px] text-gray-400 capitalize">
          {tr.transfer_type} · {tr.status} · {new Date(tr.initiated_at).toLocaleString()}
        </p>
        {reviewNote && (
          <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">Review: {reviewNote}</p>
        )}
      </div>
      <span className="text-sm font-medium tabular-nums flex-shrink-0 ml-2">
        {tr.direction === 'inbound' ? '+' : '−'}{fmtImpactUsd(tr.amount_micro_usd)}
      </span>
    </div>
  );
}
