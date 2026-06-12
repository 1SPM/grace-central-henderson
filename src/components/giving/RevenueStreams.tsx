import { Repeat } from 'lucide-react';
import {
  demoInterchange,
  demoRecurring,
  demoRevenueStreams,
  type StreamKind,
} from './demoGivingHub';

const KIND_PILL: Record<StreamKind, string> = {
  direct: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  points: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  campaign: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  seasonal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  member: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

export function RevenueStreams() {
  const totalMtd = demoRevenueStreams.reduce((sum, s) => sum + s.mtdVolume, 0);
  const interchangeTotal = demoInterchange.debit + demoInterchange.credit;
  const netToChurch = interchangeTotal + demoInterchange.accountFees - demoInterchange.rewardsPoolAllocation;

  return (
    <div className="space-y-4">
      {/* Stream audit table */}
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">All revenue streams — full audit</h2>
          <span className="text-xs text-gray-500 dark:text-dark-400">
            MTD total <strong className="text-gray-900 dark:text-dark-100">${totalMtd.toLocaleString()}</strong>
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
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recurring giving */}
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

        {/* Interchange revenue */}
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-1">Interchange revenue</h2>
          <p className="text-xs text-gray-500 dark:text-dark-400 mb-4">
            Card program revenue — funds the rewards pool, remainder to the church
          </p>
          <div className="space-y-2.5">
            {[
              { label: 'Debit interchange (MTD)', value: demoInterchange.debit },
              { label: 'Credit interchange (MTD)', value: demoInterchange.credit },
              { label: 'Account & program fees', value: demoInterchange.accountFees },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-dark-300">{row.label}</span>
                <span className="font-medium text-gray-900 dark:text-dark-100 tabular-nums">
                  ${row.value.toLocaleString()}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200 dark:border-dark-700">
              <span className="text-violet-700 dark:text-violet-300">→ Rewards pool allocation</span>
              <span className="font-medium text-violet-700 dark:text-violet-300 tabular-nums">
                −${demoInterchange.rewardsPoolAllocation.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-dark-700">
              <span className="text-sm font-medium text-gray-900 dark:text-dark-100">Net to church</span>
              <span className="stat-number text-lg text-emerald-700 dark:text-emerald-400 tabular-nums">
                ${netToChurch.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
