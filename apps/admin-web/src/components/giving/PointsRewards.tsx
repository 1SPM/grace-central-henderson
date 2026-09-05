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
  demoCommunityGiving,
  demoEarnRules,
  demoRedemptionOptions,
} from './demoGivingHub';
import {
  fmtImpactUsd,
  IMPACT_CARD_EARN_RATE,
  IMPACT_CARD_REDEEM_RATE,
  interchangeMicroToPoolUsd,
  spendMicroToEarnedPoints,
  useImpactCardProgram,
} from '../../hooks/useImpactCardProgram';

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
  const program = useImpactCardProgram();
  const summary = program.data?.summary;

  const spendMtd = summary?.spend_mtd_micro_usd ?? 0;
  const interchangeMtd = summary?.interchange_mtd_micro_usd ?? 0;
  const earnedMtdPoints = program.state === 'ready' ? spendMicroToEarnedPoints(spendMtd) : 0;
  const poolUsd = program.state === 'ready' ? interchangeMicroToPoolUsd(interchangeMtd) : 0;
  const poolPoints = Math.round(poolUsd * IMPACT_CARD_REDEEM_RATE);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5 bg-gradient-to-br from-violet-50 to-indigo-100 dark:from-violet-900/20 dark:to-indigo-900/10 border border-violet-200 dark:border-violet-800/40">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-eyebrow">Community points pool</p>
            <p className="stat-number text-3xl text-slate-900 dark:text-dark-100 mt-1.5">
              {program.state === 'ready' ? poolPoints.toLocaleString() : '—'} pts
            </p>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
              {program.state === 'ready'
                ? `≈ ${fmtImpactUsd(interchangeMtd)} redeemable · funded by GRACE Banking card interchange`
                : 'Funded by card interchange when program is active'}
            </p>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-[11px] text-gray-500 dark:text-dark-400">Earned MTD</p>
              <p className="stat-number text-xl text-slate-900 dark:text-dark-100">
                {program.state === 'ready' ? earnedMtdPoints.toLocaleString() : '—'}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-dark-500">
                {IMPACT_CARD_EARN_RATE} pt / $1 card spend · estimated from captures
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-dark-400">Card spend MTD</p>
              <p className="stat-number text-xl text-slate-900 dark:text-dark-100">
                {program.state === 'ready' ? fmtImpactUsd(spendMtd) : '—'}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-dark-500">
                {IMPACT_CARD_REDEEM_RATE} pts = $1 toward giving
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100 p-5 pb-3">Community giving this month</h2>
        {program.state !== 'ready' ? (
          <p className="text-sm text-gray-400 dark:text-dark-500 text-center py-8">
            Community stats available when Impact Card program is active
          </p>
        ) : (
          <div className="px-5 pb-5 space-y-5">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-[11px] text-gray-500 dark:text-dark-400">Members participating</p>
                <p className="stat-number text-xl text-slate-900 dark:text-dark-100">
                  {demoCommunityGiving.participantsThisMonth}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 dark:text-dark-400">Points earned (community)</p>
                <p className="stat-number text-xl text-slate-900 dark:text-dark-100">
                  {demoCommunityGiving.pointsEarnedThisMonth.toLocaleString()}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-dark-400 mb-2">Causes funded</p>
              <div className="space-y-2">
                {demoCommunityGiving.causesFunded.map(c => (
                  <div key={c.cause} className="flex items-center gap-3">
                    <span className="w-28 flex-shrink-0 text-sm text-gray-700 dark:text-dark-300">{c.cause}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-dark-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-500 dark:bg-violet-400"
                        style={{ width: `${c.sharePct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs text-gray-500 dark:text-dark-400 tabular-nums">
                      {c.sharePct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-dark-500 italic">
              Demo aggregate — wire to real Impact Card program totals
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
