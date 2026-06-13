/**
 * Financial Hub dashboard.
 *
 * Reads from /api/financial-hub/summary (the Sprint 4 ledger view).
 * PostHog-flag-gated by FLAGS.FINANCIAL_HUB — when disabled, renders a
 * "Coming soon" stub so the route exists for testing without exposing
 * the demo to all tenants.
 *
 * Visual style matches the existing GivingDashboard: serif H1,
 * stone-100 card backgrounds, custom-rolled charts (no chart lib).
 */

import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, RefreshCw, Calendar as CalendarIcon, AlertCircle, CreditCard, ChevronRight } from 'lucide-react';
import { FLAGS, flagEnabled } from '../lib/observability/featureFlags';
import { useFinancialHub, defaultRange, isoDate, type FinancialHubTimelinePoint } from '../hooks/useFinancialHub';
import { fmtImpactUsd, useImpactCardProgram } from '../hooks/useImpactCardProgram';
import { ImpactCardMonitoring } from './financial/ImpactCardMonitoring';
import type { View } from '../types';

interface FinancialHubProps {
  onBack?: () => void;
  onNavigate?: (view: View) => void;
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function fmtCount(n: number): string {
  return n.toLocaleString();
}

function fmtPercent(p: number | null | undefined): string {
  if (p === null || p === undefined) return '—';
  if (!Number.isFinite(p)) return '∞';
  const sign = p > 0 ? '+' : '';
  return `${sign}${(p * 100).toFixed(1)}%`;
}

function rangePresets(): Array<{ label: string; days: number }> {
  return [
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
    { label: '1y', days: 365 },
  ];
}

export function FinancialHub({ onBack, onNavigate }: FinancialHubProps) {
  const flagOn = flagEnabled(FLAGS.FINANCIAL_HUB);

  const [range, setRange] = useState(defaultRange(30));
  const [compare, setCompare] = useState(true);

  const { data, isLoading, error, refetch } = useFinancialHub({
    from: range.from,
    to: range.to,
    compare,
  });

  if (!flagOn) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-stone-100 dark:bg-dark-800 border border-stone-200 dark:border-dark-700 rounded-xl p-8 text-center">
          <h1 className="serif text-2xl text-slate-900 dark:text-dark-100 mb-2">Financial Hub</h1>
          <p className="text-sm text-gray-500 dark:text-dark-400 mb-4">
            The unified giving + reconciliation dashboard. Coming soon.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-lg hover:bg-stone-200/70 dark:hover:bg-dark-700 transition-colors"
            >
              Back to dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="serif text-3xl text-slate-900 dark:text-dark-100 leading-none">Financial Hub</h1>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1.5">
            Giving trends, fund allocation, and reconciliation health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-dark-600 text-gray-600 dark:text-dark-300 rounded-lg hover:bg-stone-100 dark:hover:bg-dark-800 transition-colors flex items-center gap-1.5"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* ---- Range picker ---- */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {rangePresets().map((p) => {
          const preset = defaultRange(p.days);
          const active = preset.from === range.from && preset.to === range.to;
          return (
            <button
              key={p.label}
              onClick={() => setRange(preset)}
              className={
                active
                  ? 'px-3 py-1.5 bg-slate-900 hover:bg-slate-950 text-white text-sm font-medium rounded-md transition-colors'
                  : 'px-3 py-1.5 text-sm text-gray-700 dark:text-dark-300 hover:bg-stone-200/70 dark:hover:bg-dark-800 rounded-md transition-colors'
              }
            >
              Last {p.label}
            </button>
          );
        })}

        <div className="flex items-center gap-2 ml-2">
          <CalendarIcon className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
            max={range.to}
            className="px-2 py-1.5 text-sm border border-gray-200 dark:border-dark-600 rounded-md bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-300"
          />
          <span className="text-gray-400">→</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
            min={range.from}
            max={isoDate(new Date())}
            className="px-2 py-1.5 text-sm border border-gray-200 dark:border-dark-600 rounded-md bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-300"
          />
        </div>

        <label className="ml-3 flex items-center gap-1.5 text-sm text-gray-600 dark:text-dark-400 cursor-pointer">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            className="rounded border-gray-300"
          />
          Compare to prior period
        </label>
      </div>

      {/* ---- Body ---- */}
      {isLoading && !data && <LoadingPanel />}
      {error && <ErrorPanel message={error} onRetry={refetch} />}
      {data && (
        <>
          <KpiRow data={data} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2">
              <TimelineCard timeline={data.timeline} />
            </div>
            <div>
              <FundBreakdownCard funds={data.funds} />
            </div>
          </div>
          <SourceBreakdownCard summary={data.summary} />
        </>
      )}

      <ImpactCardSummaryCard onNavigate={onNavigate} />
    </div>
  );
}

// ============================================
// Subcomponents
// ============================================

function LoadingPanel() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 bg-stone-100 dark:bg-dark-800 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-900 dark:text-red-200">Failed to load</p>
        <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">{message}</p>
        <button
          onClick={onRetry}
          className="mt-2 text-sm text-red-800 dark:text-red-200 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function KpiRow({ data }: { data: NonNullable<ReturnType<typeof useFinancialHub>['data']> }) {
  const cmp = data.comparison;
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <KpiCard
        label="Net giving"
        value={fmtUsd(data.summary.netUsd)}
        delta={cmp ? cmp.deltaPercent : null}
        subtitle={cmp ? `vs ${fmtUsd(cmp.prior.netUsd)} prior` : 'Window total'}
        accent="emerald"
      />
      <KpiCard
        label="Gross received"
        value={fmtUsd(data.summary.grossUsd)}
        subtitle={`${fmtUsd(data.summary.feeUsd)} fees · ${fmtUsd(data.summary.refundUsd)} refunds`}
        accent="slate"
      />
      <KpiCard
        label="Donations"
        value={fmtCount(data.summary.donationCount)}
        delta={cmp && cmp.prior.donationCount > 0 ? (cmp.deltaDonationCount / cmp.prior.donationCount) : null}
        subtitle={cmp ? `vs ${fmtCount(cmp.prior.donationCount)} prior` : 'Gift count'}
        accent="sky"
      />
      <KpiCard
        label="Unique donors"
        value={fmtCount(data.summary.uniqueDonors)}
        subtitle="Window unique"
        accent="amber"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  delta,
  accent,
}: {
  label: string;
  value: string;
  subtitle?: string;
  delta?: number | null;
  accent: 'emerald' | 'slate' | 'sky' | 'amber';
}) {
  const accentBg: Record<typeof accent, string> = {
    emerald: 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/10',
    slate: 'bg-gradient-to-br from-stone-50 to-slate-50 dark:from-slate-500/10 dark:to-stone-500/10',
    sky: 'bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-500/10 dark:to-blue-500/10',
    amber: 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10',
  };

  return (
    <div className={`${accentBg[accent]} border border-stone-200/60 dark:border-dark-700 rounded-xl p-4`}>
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-dark-400">{label}</div>
      <div className="serif text-2xl text-slate-900 dark:text-dark-100 mt-1.5 leading-tight">{value}</div>
      {delta !== undefined && delta !== null && (
        <div className={`text-xs mt-2 inline-flex items-center gap-0.5 ${delta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
          {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {fmtPercent(delta)}
        </div>
      )}
      {subtitle && <div className="text-xs text-gray-500 dark:text-dark-400 mt-1.5">{subtitle}</div>}
    </div>
  );
}

function TimelineCard({ timeline }: { timeline: FinancialHubTimelinePoint[] }) {
  const max = useMemo(() => Math.max(1, ...timeline.map((p) => p.creditUsd)), [timeline]);
  return (
    <div className="bg-white dark:bg-dark-850 border border-stone-200/60 dark:border-dark-700 rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-700 dark:text-dark-200 mb-1">Daily giving</h3>
      <p className="text-xs text-gray-500 dark:text-dark-400 mb-4">Credits per day; hover for breakdown</p>
      <div className="flex items-end gap-px h-40">
        {timeline.map((p) => {
          const heightPct = (p.creditUsd / max) * 100;
          const hasActivity = p.creditUsd > 0 || p.refundUsd > 0 || p.feeUsd > 0;
          return (
            <div
              key={p.date}
              className="flex-1 flex flex-col-reverse min-w-0 group relative"
              title={`${p.date}: ${fmtUsd(p.creditUsd)} (net ${fmtUsd(p.netUsd)})`}
            >
              <div
                className={
                  hasActivity
                    ? 'bg-emerald-500/70 hover:bg-emerald-600 dark:bg-emerald-500/50 dark:hover:bg-emerald-400 rounded-t-sm transition-colors'
                    : 'bg-stone-100 dark:bg-dark-800'
                }
                style={{ height: `${Math.max(heightPct, hasActivity ? 4 : 1)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-dark-500 mt-2">
        <span>{timeline[0]?.date ?? ''}</span>
        <span>{timeline[Math.floor(timeline.length / 2)]?.date ?? ''}</span>
        <span>{timeline[timeline.length - 1]?.date ?? ''}</span>
      </div>
    </div>
  );
}

function FundBreakdownCard({ funds }: { funds: { fund: string; creditUsd: number; count: number; percentOfTotal: number }[] }) {
  if (funds.length === 0) {
    return (
      <div className="bg-white dark:bg-dark-850 border border-stone-200/60 dark:border-dark-700 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-700 dark:text-dark-200 mb-1">By fund</h3>
        <p className="text-xs text-gray-500 dark:text-dark-400">No giving in this period.</p>
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-dark-850 border border-stone-200/60 dark:border-dark-700 rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-700 dark:text-dark-200 mb-4">By fund</h3>
      <div className="space-y-3">
        {funds.map((f) => (
          <div key={f.fund}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-gray-700 dark:text-dark-300 capitalize">{f.fund}</span>
              <span className="text-sm font-medium text-slate-900 dark:text-dark-100">{fmtUsd(f.creditUsd)}</span>
            </div>
            <div className="h-2 bg-stone-100 dark:bg-dark-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-700 dark:bg-slate-400"
                style={{ width: `${Math.max(f.percentOfTotal * 100, 2)}%` }}
              />
            </div>
            <div className="text-[11px] text-gray-500 dark:text-dark-500 mt-0.5">
              {(f.percentOfTotal * 100).toFixed(1)}% · {fmtCount(f.count)} gifts
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImpactCardSummaryCard({ onNavigate }: { onNavigate?: (view: View) => void }) {
  const program = useImpactCardProgram();

  if (program.state === 'loading' || program.state === 'unavailable') return null;

  if (program.state === 'gated') {
    return (
      <div className="mt-6 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-medium text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
              <CreditCard size={16} /> Impact Card Accounts
            </h3>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
              {program.gateMessage || 'The GRACE Impact Card program requires the Enterprise plan.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const summary = program.data?.summary;
  if (!summary) return null;

  return (
    <div className="mt-6 bg-stone-100 dark:bg-dark-800 border border-stone-200 dark:border-dark-700 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 flex items-center gap-2">
            <CreditCard size={16} className="text-indigo-600 dark:text-indigo-400" /> Impact Card Accounts
          </h3>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
            i2cInc merchant program — card usage and interchange revenue
          </p>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate('wallets')}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
          >
            Open Impact Card Accounts <ChevronRight size={14} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Active cards', value: String(summary.active_cards) },
          { label: 'Pending KYC', value: String(summary.pending_kyc) },
          { label: 'Card spend (MTD)', value: fmtImpactUsd(summary.spend_mtd_micro_usd) },
          { label: 'Interchange (MTD)', value: fmtImpactUsd(summary.interchange_mtd_micro_usd) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-dark-850 rounded-lg border border-stone-200/60 dark:border-dark-700 p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-dark-400">{label}</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-dark-100 mt-1">{value}</p>
          </div>
        ))}
      </div>
      {program.data && (
        <div className="mt-4">
          <ImpactCardMonitoring data={program.data} compact />
        </div>
      )}
    </div>
  );
}

function SourceBreakdownCard({ summary }: { summary: { bySource: Record<string, { creditUsd: number; debitUsd: number; count: number }> } }) {
  const sources = Object.entries(summary.bySource);
  if (sources.length === 0) return null;
  return (
    <div className="mt-6 bg-white dark:bg-dark-850 border border-stone-200/60 dark:border-dark-700 rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-700 dark:text-dark-200 mb-4">By processor</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-dark-400 border-b border-stone-200 dark:border-dark-700">
            <th className="pb-2 font-normal">Source</th>
            <th className="pb-2 font-normal text-right">Credits</th>
            <th className="pb-2 font-normal text-right">Debits</th>
            <th className="pb-2 font-normal text-right">Net</th>
            <th className="pb-2 font-normal text-right">Events</th>
          </tr>
        </thead>
        <tbody>
          {sources.map(([src, vals]) => (
            <tr key={src} className="border-b border-stone-100 dark:border-dark-800 last:border-0">
              <td className="py-2.5 capitalize text-slate-900 dark:text-dark-100">{src}</td>
              <td className="py-2.5 text-right text-emerald-700 dark:text-emerald-400">{fmtUsd(vals.creditUsd)}</td>
              <td className="py-2.5 text-right text-gray-600 dark:text-dark-400">{fmtUsd(vals.debitUsd)}</td>
              <td className="py-2.5 text-right font-medium text-slate-900 dark:text-dark-100">{fmtUsd(vals.creditUsd - vals.debitUsd)}</td>
              <td className="py-2.5 text-right text-gray-500 dark:text-dark-500">{fmtCount(vals.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
