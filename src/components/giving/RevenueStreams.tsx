import { Repeat, ChevronRight } from 'lucide-react';
import {
  demoRecurring,
  demoRevenueStreams,
  type StreamKind,
} from './demoGivingHub';
import { fmtImpactUsd, useImpactCardProgram } from '../../hooks/useImpactCardProgram';
import type { View } from '../../types';

const KIND_PILL: Record<StreamKind, string> = {
  direct: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  points: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  campaign: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  seasonal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  member: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
};

interface RevenueStreamsProps {
  onNavigateToWallets?: (view: View) => void;
}

export function RevenueStreams({ onNavigateToWallets }: RevenueStreamsProps) {
  const program = useImpactCardProgram();
  const summary = program.data?.summary;

  const spendMtd = summary?.spend_mtd_micro_usd ?? 0;
  const interchangeMtd = summary?.interchange_mtd_micro_usd ?? 0;
  const rewardsPoolAllocation = Math.round(interchangeMtd * 0.5);
  const netToChurch = interchangeMtd - rewardsPoolAllocation;

  const totalMtd = demoRevenueStreams.reduce((sum, s) => sum + s.mtdVolume, 0)
    + (program.state === 'ready' ? spendMtd / 1_000_000 : 0);

  return (
    <div className="space-y-4">
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">All revenue streams — full audit</h2>
          <span className="text-xs text-gray-500 dark:text-dark-400">
            MTD total <strong className="text-gray-900 dark:text-dark-100">${Math.round(totalMtd).toLocaleString()}</strong>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-500 border-b border-gray-200 dark:border-dark-700">
                <th className="px-5 py-2 font-medium">Stream</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium text-right">MTD volume</th>
                <th className="px-3 py-2 font-medium text-right">Avg gift</th>
                <th className="px-3 py-2 font-medium text-right">Donors</th>
                <th className="px-3 py-2 font-medium">Routes to</th>
                <th className="px-3 py-2 font-medium">Settlement</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {demoRevenueStreams.map(s => (
                <tr key={s.id} className="border-b border-gray-100 dark:border-dark-700 last:border-0">
                  <td className="px-5 py-2.5">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${KIND_PILL[s.kind]}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-dark-300 text-xs">{s.source}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-900 dark:text-dark-100 tabular-nums">
                    ${s.mtdVolume.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600 dark:text-dark-300 tabular-nums">${s.avgGift}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600 dark:text-dark-300 tabular-nums">{s.donors}</td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-dark-300 text-xs">{s.routesTo}</td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-dark-400 text-xs">{s.settlement}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        s.status === 'Live'
                          ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
              {program.state === 'ready' && spendMtd > 0 && (
                <tr className="border-b border-gray-100 dark:border-dark-700 last:border-0 bg-blue-50/50 dark:bg-blue-900/10">
                  <td className="px-5 py-2.5">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      Card spend
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-dark-300 text-xs">i2c card interchange</td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-900 dark:text-dark-100 tabular-nums">
                    {fmtImpactUsd(spendMtd)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-400 dark:text-dark-500">—</td>
                  <td className="px-3 py-2.5 text-right text-gray-400 dark:text-dark-500">—</td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-dark-300 text-xs">Interchange → ledger</td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-dark-400 text-xs">i2c settlement</td>
                  <td className="px-5 py-2.5">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Live
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100 flex items-center gap-1.5">
              <Repeat size={14} className="text-gray-400" /> Recurring giving
            </h2>
            <span className="text-xs text-gray-500 dark:text-dark-400">
              {demoRecurring.length} active schedules
            </span>
          </div>
          <div className="space-y-1">
            {demoRecurring.map(r => (
              <div
                key={r.name}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-dark-700 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{r.name}</p>
                  <p className="text-[11px] text-gray-400 dark:text-dark-500">
                    {r.frequency} · {r.fund} · next {r.nextDate}
                  </p>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-dark-100 tabular-nums">
                  ${r.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Interchange revenue</h2>
            {onNavigateToWallets && program.state === 'ready' && (
              <button
                onClick={() => onNavigateToWallets('wallets')}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-0.5 hover:underline"
              >
                Impact Card Accounts <ChevronRight size={12} />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-dark-400 mb-4">
            i2cInc merchant program — card spend generates interchange credited to the church ledger
          </p>
          {program.state === 'ready' ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-dark-300">Card spend (MTD)</span>
                <span className="font-medium text-gray-900 dark:text-dark-100 tabular-nums">
                  {fmtImpactUsd(spendMtd)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-dark-300">Interchange to church (MTD)</span>
                <span className="font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {fmtImpactUsd(interchangeMtd)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200 dark:border-dark-700">
                <span className="text-violet-700 dark:text-violet-300">→ Rewards pool allocation (est.)</span>
                <span className="font-medium text-violet-700 dark:text-violet-300 tabular-nums">
                  −{fmtImpactUsd(rewardsPoolAllocation)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-dark-700">
                <span className="text-sm font-medium text-gray-900 dark:text-dark-100">Net to church</span>
                <span className="stat-number text-lg text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {fmtImpactUsd(netToChurch)}
                </span>
              </div>
            </div>
          ) : program.state === 'gated' ? (
            <p className="text-sm text-indigo-700 dark:text-indigo-300">{program.gateMessage}</p>
          ) : (
            <p className="text-sm text-gray-400 dark:text-dark-500">Sign in to view live interchange data</p>
          )}
        </div>
      </div>
    </div>
  );
}
