/**
 * Church-wide Impact Card monitoring — enrollment funnel, float, alerts, reconciliation.
 */

import { AlertTriangle, CreditCard, Scale, TrendingUp, Wallet } from 'lucide-react';
import type { AdminCardData } from '../../lib/services/impactCard';
import { fmtImpactUsd } from '../../hooks/useImpactCardProgram';

interface ImpactCardMonitoringProps {
  data: AdminCardData;
  compact?: boolean;
}

export function ImpactCardMonitoring({ data, compact }: ImpactCardMonitoringProps) {
  const summary = data.summary;
  const kycApproved = data.kyc_queue.filter(k => k.status === 'approved').length;
  const enrolled = data.accounts?.length ?? 0;

  const alerts: { level: 'warn' | 'info'; message: string }[] = [];
  if (summary.decline_count_mtd >= 5) {
    alerts.push({ level: 'warn', message: `${summary.decline_count_mtd} declined transactions MTD — review for fraud patterns` });
  }
  if (summary.failed_transfers > 0) {
    alerts.push({ level: 'warn', message: `${summary.failed_transfers} failed transfer(s) need staff review` });
  }
  if (summary.pending_transfers > 0) {
    alerts.push({ level: 'info', message: `${summary.pending_transfers} transfer(s) in progress` });
  }
  if (Math.abs(summary.reconciliation_delta_micro_usd) > 100_000) {
    alerts.push({
      level: 'warn',
      message: `i2c ledger vs interchange delta ${fmtImpactUsd(Math.abs(summary.reconciliation_delta_micro_usd))} — reconcile in Financial Hub`,
    });
  }
  if (summary.pending_kyc > 0) {
    alerts.push({ level: 'info', message: `${summary.pending_kyc} KYC application(s) awaiting review` });
  }

  const reconOk = Math.abs(summary.reconciliation_delta_micro_usd) <= 100_000;

  if (compact) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total float', value: fmtImpactUsd(summary.total_float_micro_usd ?? 0), icon: Wallet },
          { label: 'Card Impact MTD', value: fmtImpactUsd(summary.impact_mtd_micro_usd ?? summary.interchange_mtd_micro_usd), icon: TrendingUp },
          { label: 'Declines MTD', value: String(summary.decline_count_mtd ?? 0), icon: AlertTriangle },
          { label: 'Reconciliation', value: reconOk ? 'Balanced' : 'Review', icon: Scale },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white dark:bg-dark-850 rounded-lg border border-stone-200/60 dark:border-dark-700 p-3">
            <Icon size={14} className="text-indigo-500 mb-1" />
            <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-dark-400">{label}</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-dark-100 mt-1">{value}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'KYC approved', value: String(kycApproved), sub: `${summary.pending_kyc} pending` },
          { label: 'Accounts funded', value: String(enrolled), sub: `${summary.active_cards} active cards` },
          { label: 'Total float', value: fmtImpactUsd(summary.total_float_micro_usd ?? 0), sub: 'member balances' },
          { label: 'Interchange MTD', value: fmtImpactUsd(summary.interchange_mtd_micro_usd), sub: 'program revenue' },
          { label: 'Card Impact MTD', value: fmtImpactUsd(summary.impact_mtd_micro_usd ?? 0), sub: 'member/cause credits' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <p className="section-eyebrow">{label}</p>
            <p className="stat-number text-2xl text-slate-900 dark:text-dark-100 mt-1.5">{value}</p>
            <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
          <p className="section-eyebrow mb-2 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Alerts
          </p>
          <ul className="space-y-1.5">
            {alerts.map((a, i) => (
              <li
                key={i}
                className={`text-xs px-2.5 py-1.5 rounded-lg ${
                  a.level === 'warn'
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                }`}
              >
                {a.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
        <p className="section-eyebrow mb-3 flex items-center gap-1.5">
          <Scale size={12} /> i2c / ledger reconciliation (MTD)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-dark-400 text-xs">Interchange fees (i2c events)</p>
            <p className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {fmtImpactUsd(summary.interchange_mtd_micro_usd)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-dark-400 text-xs">Ledger net (source=i2c)</p>
            <p className="font-semibold text-slate-900 dark:text-dark-100 tabular-nums">
              {fmtImpactUsd(summary.ledger_i2c_net_mtd_micro_usd ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-dark-400 text-xs">Delta</p>
            <p className={`font-semibold tabular-nums ${reconOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {fmtImpactUsd(summary.reconciliation_delta_micro_usd ?? 0)}
              {reconOk ? ' ✓' : ' — review'}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-3 flex items-center gap-1">
          <CreditCard size={11} />
          Compare with Financial Hub processor table (source: i2c) for full audit trail.
        </p>
      </div>
    </div>
  );
}
