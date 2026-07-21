import { Fragment, useMemo } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  Coins,
  CreditCard,
  DollarSign,
  Flag,
  LayoutGrid,
  User,
} from 'lucide-react';
import type { Giving, Person, Pledge, View } from '../../types';
import type { GivingHubTab, GivingNavTarget } from './GivingHub';
import { demoCampaigns, demoFundStreamSplits } from './demoGivingHub';
import { SampleDataNotice } from '../SampleDataNotice';
import { fmtImpactUsd, useImpactCardProgram } from '../../hooks/useImpactCardProgram';

interface GivingOverviewProps {
  giving: Giving[];
  people: Person[];
  pledges: Pledge[];
  onNavigate: (view: GivingNavTarget['view']) => void;
  onGoToTab: (tab: GivingHubTab) => void;
  onNavigateToWallets?: (view: View) => void;
}

const ACCENT_BAR: Record<string, string> = {
  gold: 'bg-amber-500',
  green: 'bg-emerald-600',
  purple: 'bg-violet-600',
  blue: 'bg-blue-600',
};

function StreamPill({ kind, children }: { kind: 'direct' | 'points' | 'campaign' | 'card' | 'member'; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    direct: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    points: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    campaign: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    card: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    member: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${styles[kind]}`}>
      {children}
    </span>
  );
}

export function GivingOverview({ giving, pledges, onNavigate, onGoToTab, onNavigateToWallets }: GivingOverviewProps) {
  const program = useImpactCardProgram();
  const cardSummary = program.data?.summary;

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const mtd = giving.filter(g => new Date(g.date) >= monthStart);
    const source = mtd.length > 0 ? mtd : giving;
    const total = source.reduce((sum, g) => sum + g.amount, 0);
    const avgGift = source.length > 0 ? total / source.length : 0;

    const fundTotals: Record<string, number> = {};
    source.forEach(g => {
      fundTotals[g.fund] = (fundTotals[g.fund] || 0) + g.amount;
    });
    const funds = Object.entries(fundTotals)
      .map(([fund, amount]) => ({ fund, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { total, avgGift, gifts: source.length, funds, isMtd: mtd.length > 0 };
  }, [giving]);

  const maxFund = Math.max(...stats.funds.map(f => f.amount), 1);

  return (
    <div className="space-y-4">
      <SampleDataNotice label="Fund-split, stream-summary, and campaign figures below are illustrative samples — not live" />
      {/* KPI hero cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 bg-stone-100 dark:bg-dark-800 border border-l-[5px] border-gray-200 dark:border-dark-700 border-l-amber-500">
          <p className="text-[11px] font-medium text-gray-500 dark:text-dark-400 flex items-center gap-1.5">
            <DollarSign size={13} className="text-amber-500" /> Total given
          </p>
          <p className="stat-number text-3xl text-slate-900 dark:text-dark-100 mt-2">
            ${Math.round(stats.total).toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-1">
            {stats.gifts} gifts {stats.isMtd ? 'this month' : 'recorded'}
          </p>
        </div>
        <div className="rounded-2xl p-5 bg-stone-100 dark:bg-dark-800 border border-l-[5px] border-gray-200 dark:border-dark-700 border-l-blue-600">
          <p className="text-[11px] font-medium text-gray-500 dark:text-dark-400 flex items-center gap-1.5">
            <Check size={13} className="text-blue-500" /> Average gift
          </p>
          <p className="stat-number text-3xl text-slate-900 dark:text-dark-100 mt-2">
            ${Math.round(stats.avgGift).toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-1">per gift</p>
        </div>
        <div className="rounded-2xl p-5 bg-stone-100 dark:bg-dark-800 border border-l-[5px] border-gray-200 dark:border-dark-700 border-l-emerald-600">
          <p className="text-[11px] font-medium text-gray-500 dark:text-dark-400 flex items-center gap-1.5">
            <LayoutGrid size={13} className="text-emerald-500" /> Funds
          </p>
          <p className="stat-number text-3xl text-slate-900 dark:text-dark-100 mt-2">{stats.funds.length}</p>
          <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-1">active</p>
        </div>
        <div className="rounded-2xl p-5 bg-stone-100 dark:bg-dark-800 border border-l-[5px] border-gray-200 dark:border-dark-700 border-l-indigo-600">
          <p className="text-[11px] font-medium text-gray-500 dark:text-dark-400 flex items-center gap-1.5">
            <CreditCard size={13} className="text-indigo-500" /> Card interchange
          </p>
          <p className="stat-number text-3xl text-slate-900 dark:text-dark-100 mt-2">
            {program.state === 'ready' && cardSummary
              ? fmtImpactUsd(cardSummary.interchange_mtd_micro_usd)
              : '—'}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-1">
            {program.state === 'ready' && cardSummary
              ? `${cardSummary.active_cards} active cards · i2c MTD`
              : 'Impact Card program'}
          </p>
          {onNavigateToWallets && program.state === 'ready' && (
            <button
              onClick={() => onNavigateToWallets('wallets')}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-1 hover:underline"
            >
              Impact Card Accounts →
            </button>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onNavigate('online-giving')}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-950 text-white text-sm font-medium rounded-md transition-colors"
        >
          New gift
        </button>
        <button onClick={() => onNavigate('batch-entry')} className="px-3 py-1.5 text-sm text-gray-700 dark:text-dark-300 hover:bg-stone-200/70 dark:hover:bg-dark-800 rounded-md transition-colors">
          Batch entry
        </button>
        <button onClick={() => onNavigate('pledges')} className="px-3 py-1.5 text-sm text-gray-700 dark:text-dark-300 hover:bg-stone-200/70 dark:hover:bg-dark-800 rounded-md transition-colors">
          Pledges <span className="text-gray-400 ml-0.5">· {pledges.filter(p => p.status === 'active').length}</span>
        </button>
        <button onClick={() => onNavigate('statements')} className="px-3 py-1.5 text-sm text-gray-700 dark:text-dark-300 hover:bg-stone-200/70 dark:hover:bg-dark-800 rounded-md transition-colors">
          Statements
        </button>
        <span className="text-gray-300 dark:text-dark-600">·</span>
        <button onClick={() => onNavigate('donation-tracker')} className="px-3 py-1.5 text-sm text-gray-500 dark:text-dark-400 hover:bg-stone-200/70 dark:hover:bg-dark-800 rounded-md transition-colors">
          Tracker
        </button>
        <button onClick={() => onNavigate('member-stats')} className="px-3 py-1.5 text-sm text-gray-500 dark:text-dark-400 hover:bg-stone-200/70 dark:hover:bg-dark-800 rounded-md transition-colors">
          Member stats
        </button>
      </div>

      {/* How giving flows */}
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
        <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-4">How giving flows through GRACE</h2>
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-end gap-2">
          {[
            { icon: User, label: 'Member gives', sub: 'App · Card · Online', tone: 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800/40 dark:text-blue-400' },
            { icon: Flag, label: 'Campaign bucket', sub: 'Routes to fund', tone: 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800/40 dark:text-amber-400' },
            { icon: Coins, label: 'Fund account', sub: 'Tithe · Missions · Building', tone: 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800/40 dark:text-emerald-400' },
            { icon: Building2, label: 'Settlement', sub: 'Same-day to bank', tone: 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-dark-700 dark:border-dark-600 dark:text-dark-300' },
          ].map(({ icon: Icon, label, sub, tone }, i) => (
            <Fragment key={label}>
              {i > 0 && (
                <ArrowRight size={16} className="text-gray-300 dark:text-dark-600 mb-5" />
              )}
              <div className="text-center">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mx-auto mb-1.5 ${tone}`}>
                  <Icon size={18} />
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-dark-100">{label}</p>
                <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-0.5">{sub}</p>
              </div>
            </Fragment>
          ))}
        </div>
        <div className="mt-4 bg-stone-50 dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-lg p-3 text-xs text-gray-500 dark:text-dark-400">
          <strong className="text-gray-900 dark:text-dark-100">Campaign types route automatically —</strong>{' '}
          Admin campaigns → designated fund · Seasonal → Missions or special fund · Member-approved causes → escrow wallet until goal met, then disbursed.
        </div>
      </div>

      {/* Giving by fund with stream breakdown */}
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Giving by fund</h2>
          <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-dark-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Direct</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-600" /> Points</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600" /> Campaign</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600" /> Card rewards</span>
          </div>
        </div>
        {stats.funds.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-dark-500 text-center py-6">No giving recorded yet</p>
        )}
        <div className="space-y-3">
          {stats.funds.map(({ fund, amount }) => {
            const split = demoFundStreamSplits[fund] || demoFundStreamSplits.other;
            const points = Math.round(amount * split.points);
            const campaign = Math.round(amount * split.campaign);
            const card = Math.round(amount * split.card);
            const direct = amount - points - campaign - card;
            const width = (amount / maxFund) * 100;
            return (
              <div key={fund} className="flex items-center gap-3">
                <span className="w-24 text-sm text-gray-700 dark:text-dark-300 capitalize flex-shrink-0">{fund}</span>
                <div className="flex-1 h-3 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                  <div className="h-full flex rounded-full overflow-hidden" style={{ width: `${width}%` }}>
                    <div className="bg-amber-500 h-full" style={{ width: `${(direct / amount) * 100}%` }} />
                    {points > 0 && <div className="bg-violet-600 h-full" style={{ width: `${(points / amount) * 100}%` }} />}
                    {campaign > 0 && <div className="bg-emerald-600 h-full" style={{ width: `${(campaign / amount) * 100}%` }} />}
                    {card > 0 && <div className="bg-blue-600 h-full" style={{ width: `${(card / amount) * 100}%` }} />}
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                  <StreamPill kind="direct">${direct.toLocaleString()} direct</StreamPill>
                  {points > 0 && <StreamPill kind="points">${points.toLocaleString()} pts</StreamPill>}
                  {campaign > 0 && <StreamPill kind="campaign">${campaign.toLocaleString()} campaign</StreamPill>}
                  {card > 0 && <StreamPill kind="card">${card.toLocaleString()} card</StreamPill>}
                </div>
                <span className="w-20 text-right text-sm font-medium text-gray-900 dark:text-dark-100 flex-shrink-0">
                  ${amount.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stream summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Direct giving', value: '$51,400', sub: 'Card · Online · App', trend: '▲ 11% vs last period', accent: 'border-l-amber-500' },
          { label: 'Points redeemed', value: '$3,840', sub: 'Toward tithe & causes', trend: '▲ 34% vs last period', accent: 'border-l-violet-600' },
          { label: 'Campaign giving', value: '$24,870', sub: 'Admin + Seasonal', trend: '▲ 8% vs last period', accent: 'border-l-emerald-600' },
          { label: 'Member causes', value: '$4,100', sub: 'Peer-approved campaigns', trend: '1 live · 8 pending', accent: 'border-l-rose-500' },
        ].map(card => (
          <div
            key={card.label}
            className={`bg-stone-100 dark:bg-dark-800 rounded-2xl border border-l-[5px] border-gray-200 dark:border-dark-700 ${card.accent} p-5`}
          >
            <p className="section-eyebrow">{card.label}</p>
            <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-2">{card.value}</p>
            <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-1">{card.sub}</p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1">{card.trend}</p>
          </div>
        ))}
      </div>

      {/* Active campaigns preview */}
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Active campaigns</h2>
          <button
            onClick={() => onGoToTab('campaigns')}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
          >
            View all <ArrowRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {demoCampaigns.slice(0, 3).map(c => {
            const pct = Math.min(Math.round((c.raised / c.goal) * 100), 100);
            return (
              <div key={c.id} className={`p-4 bg-gray-50 dark:bg-dark-850 rounded-lg border-t-2 ${ACCENT_BAR[c.accent].replace('bg-', 'border-t-')}`}>
                <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">{c.name}</h3>
                <p className="text-[10px] text-gray-400 dark:text-dark-500 capitalize mb-2">
                  {c.kind} · {c.daysLeft} days left
                </p>
                <div className="h-1.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden mb-1.5">
                  <div className={`h-full rounded-full ${ACCENT_BAR[c.accent]}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-900 dark:text-dark-100">${c.raised.toLocaleString()}</span>
                  <span className="text-gray-400 dark:text-dark-500">of ${(c.goal / 1000).toFixed(0)}K</span>
                  <span className="font-semibold text-gray-700 dark:text-dark-300">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
