import {
  CalendarCheck,
  CreditCard,
  Gift,
  Globe,
  Heart,
  Star,
  UserPlus,
  Wallet,
} from 'lucide-react';
import {
  demoEarnRules,
  demoPoints,
  demoPointsLeaders,
  demoRedemptionOptions,
} from './demoGivingHub';

const EARN_ICONS = {
  debit: Wallet,
  credit: CreditCard,
  attendance: CalendarCheck,
  referral: UserPlus,
} as const;

const REDEEM_ICONS = {
  tithe: Heart,
  cause: Star,
  gift: Gift,
  missions: Globe,
} as const;

export function PointsRewards() {
  return (
    <div className="space-y-4">
      {/* Pool hero */}
      <div className="rounded-xl p-5 bg-gradient-to-br from-violet-50 to-indigo-100 dark:from-violet-900/20 dark:to-indigo-900/10 border border-violet-200 dark:border-violet-800/40">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-eyebrow">Community points pool</p>
            <p className="stat-number text-3xl text-slate-900 dark:text-dark-100 mt-1.5">
              {demoPoints.poolPoints.toLocaleString()} pts
            </p>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
              ≈ ${demoPoints.poolUsd.toLocaleString()} redeemable · funded by card interchange
            </p>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-[11px] text-gray-500 dark:text-dark-400">Earned MTD</p>
              <p className="stat-number text-xl text-slate-900 dark:text-dark-100">
                {demoPoints.earnedMtdPoints.toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-dark-500">{demoPoints.earnRate} card spend</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-dark-400">Redeemed MTD</p>
              <p className="stat-number text-xl text-slate-900 dark:text-dark-100">
                ${demoPoints.redeemedMtdUsd.toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-dark-500">{demoPoints.redeemRate}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Earn rules */}
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-4">How members earn points</h2>
          <div className="space-y-2">
            {demoEarnRules.map(rule => {
              const Icon = EARN_ICONS[rule.icon];
              return (
                <div
                  key={rule.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-850 rounded-lg"
                >
                  <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{rule.title}</p>
                    <p className="text-[11px] text-gray-500 dark:text-dark-400">{rule.detail}</p>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 whitespace-nowrap">
                    {rule.badge}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Redemption options */}
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-4">Redemption options</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {demoRedemptionOptions.map(opt => {
              const Icon = REDEEM_ICONS[opt.icon];
              return (
                <div key={opt.id} className="p-3 bg-gray-50 dark:bg-dark-850 rounded-lg">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mb-2">
                    <Icon size={16} />
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{opt.title}</p>
                  <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-0.5">{opt.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100 p-5 pb-3">Top point earners this month</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-500 border-b border-gray-200 dark:border-dark-700">
                <th className="px-5 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Member</th>
                <th className="px-3 py-2 font-medium text-right">Points</th>
                <th className="px-3 py-2 font-medium text-right">Card spend</th>
                <th className="px-3 py-2 font-medium text-right">Redeemable</th>
                <th className="px-5 py-2 font-medium">Allocation</th>
              </tr>
            </thead>
            <tbody>
              {demoPointsLeaders.map(l => (
                <tr key={l.rank} className="border-b border-gray-100 dark:border-dark-700 last:border-0">
                  <td className="px-5 py-2.5 text-gray-400 dark:text-dark-500">{l.rank}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center text-[10px] font-medium text-gray-600 dark:text-dark-300">
                        {l.initials}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-dark-100">{l.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-violet-700 dark:text-violet-300 tabular-nums">
                    {l.points.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600 dark:text-dark-300 tabular-nums">
                    ${l.cardSpend.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600 dark:text-dark-300 tabular-nums">
                    ${l.redeemable}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-gray-500 dark:text-dark-400">{l.allocation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
