import { useState } from 'react';
import { ArrowRight, Building2, Coins, Flag, Sparkles, User } from 'lucide-react';
import type { CampaignKind } from './demoGivingHub';

const FUNDS = ['Tithe', 'Missions', 'Building', 'Benevolence', 'Youth', 'Other'];

const KIND_OPTIONS: { id: CampaignKind; label: string; detail: string }[] = [
  { id: 'admin', label: 'Admin', detail: 'Church-led drive, routes to a fund' },
  { id: 'seasonal', label: 'Seasonal', detail: 'Calendar-suggested, time-boxed' },
  { id: 'member', label: 'Member', detail: 'Member-submitted, escrow until goal' },
];

const PLACEMENTS = ['App home banner', 'Giving screen', 'Wallet screen', 'Sunday slides', 'Email digest'];

const AI_TIPS = [
  'Campaigns with a specific, visual goal ("12 wells in Kenya") raise 2.3× more than generic asks.',
  'Adding a points-redemption option lifts participation ~18% — members love giving spend rewards.',
  'Pair the launch with a Sunday announcement and an app push within 24 hours for best momentum.',
];

export function CampaignMaker() {
  const [name, setName] = useState('Kenya Missions Trip');
  const [description, setDescription] = useState('Support our team of 12 travelling to Nairobi in September.');
  const [kind, setKind] = useState<CampaignKind>('admin');
  const [goal, setGoal] = useState('30000');
  const [fund, setFund] = useState('Missions');
  const [allowPoints, setAllowPoints] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'members' | 'leaders'>('all');
  const [placements, setPlacements] = useState<string[]>(['App home banner', 'Giving screen']);

  const goalNum = Number(goal) || 0;

  const togglePlacement = (p: string) =>
    setPlacements(prev => (prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]));

  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-dark-100 focus:outline-none focus:ring-2 focus:ring-slate-400';
  const labelCls = 'block text-xs font-medium text-gray-600 dark:text-dark-300 mb-1.5';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Form */}
      <div className="lg:col-span-3 bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 space-y-4">
        <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Create a campaign</h2>

        <div>
          <label className={labelCls}>Campaign name</label>
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="e.g. Building Fund Drive" />
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className={inputCls}
            placeholder="What is this campaign for?"
          />
        </div>

        <div>
          <label className={labelCls}>Campaign type</label>
          <div className="grid grid-cols-3 gap-2">
            {KIND_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setKind(opt.id)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  kind === opt.id
                    ? 'border-slate-900 dark:border-dark-100 bg-white dark:bg-dark-850'
                    : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                }`}
              >
                <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{opt.label}</p>
                <p className="text-[10px] text-gray-500 dark:text-dark-400 mt-0.5">{opt.detail}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Goal amount ($)</label>
            <input value={goal} onChange={e => setGoal(e.target.value.replace(/[^0-9]/g, ''))} className={inputCls} inputMode="numeric" />
          </div>
          <div>
            <label className={labelCls}>Routes to fund</label>
            <select value={fund} onChange={e => setFund(e.target.value)} className={inputCls}>
              {FUNDS.map(f => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-850 rounded-lg cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-dark-100">Accept points redemption</p>
            <p className="text-[11px] text-gray-500 dark:text-dark-400">Members can dedicate card-reward points to this campaign</p>
          </div>
          <input
            type="checkbox"
            checked={allowPoints}
            onChange={e => setAllowPoints(e.target.checked)}
            className="w-4 h-4 accent-slate-900"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Start date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Visibility</label>
          <div className="flex gap-2">
            {(
              [
                { id: 'all', label: 'Everyone' },
                { id: 'members', label: 'Members only' },
                { id: 'leaders', label: 'Leaders only' },
              ] as const
            ).map(v => (
              <button
                key={v.id}
                onClick={() => setVisibility(v.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  visibility === v.id
                    ? 'border-slate-900 dark:border-dark-100 bg-slate-900 text-white dark:bg-dark-100 dark:text-dark-900'
                    : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-dark-300'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Placement</label>
          <div className="flex flex-wrap gap-2">
            {PLACEMENTS.map(p => (
              <label
                key={p}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border cursor-pointer transition-colors ${
                  placements.includes(p)
                    ? 'border-slate-900 dark:border-dark-100 bg-white dark:bg-dark-850 text-gray-900 dark:text-dark-100'
                    : 'border-gray-200 dark:border-dark-600 text-gray-500 dark:text-dark-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={placements.includes(p)}
                  onChange={() => togglePlacement(p)}
                  className="w-3 h-3 accent-slate-900"
                />
                {p}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button className="px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white text-sm font-medium rounded-lg transition-colors">
            Launch campaign
          </button>
          <button className="px-4 py-2 text-sm text-gray-600 dark:text-dark-300 border border-gray-200 dark:border-dark-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-850 transition-colors">
            Save draft
          </button>
        </div>
      </div>

      {/* Right column: preview + routing + AI tips */}
      <div className="lg:col-span-2 space-y-4">
        {/* Member app preview */}
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <p className="section-eyebrow mb-3">Member app preview</p>
          <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Flag size={14} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{name || 'Campaign name'}</p>
                <p className="text-[10px] text-white/60 capitalize">{kind} campaign · {fund} fund</p>
              </div>
            </div>
            <p className="text-xs text-white/80 mb-3">{description || 'Campaign description appears here.'}</p>
            <div className="h-1.5 bg-white/15 rounded-full overflow-hidden mb-1.5">
              <div className="h-full w-1/3 bg-amber-400 rounded-full" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/60 mb-3">
              <span>$0 raised</span>
              <span>Goal ${goalNum.toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 bg-white text-slate-900 text-xs font-semibold rounded-lg">Give now</button>
              {allowPoints && (
                <button className="flex-1 py-1.5 bg-white/10 text-white text-xs font-semibold rounded-lg">Use points</button>
              )}
            </div>
          </div>
        </div>

        {/* Routing chain */}
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <p className="section-eyebrow mb-3">Fund routing</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg font-medium">
              <User size={12} /> Gift
            </span>
            <ArrowRight size={12} className="text-gray-300 dark:text-dark-600" />
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg font-medium">
              <Flag size={12} /> {name ? name.split(' ').slice(0, 2).join(' ') : 'Campaign'}
            </span>
            <ArrowRight size={12} className="text-gray-300 dark:text-dark-600" />
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg font-medium">
              {kind === 'member' ? <Coins size={12} /> : <Building2 size={12} />}
              {kind === 'member' ? 'Escrow' : `${fund} fund`}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-3">
            {kind === 'member'
              ? 'Member campaigns hold funds in escrow until the goal is met, then disburse to the verified recipient.'
              : `Gifts settle same-day into the ${fund} fund account.`}
          </p>
        </div>

        {/* Grace AI tips */}
        <div className="rounded-xl p-5 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/10 border border-indigo-200 dark:border-indigo-800/40">
          <p className="section-eyebrow mb-3 flex items-center gap-1.5">
            <Sparkles size={13} className="text-indigo-500" /> Grace AI suggestions
          </p>
          <ul className="space-y-2.5">
            {AI_TIPS.map(tip => (
              <li key={tip} className="text-xs text-gray-600 dark:text-dark-300 flex gap-2">
                <span className="text-indigo-400 flex-shrink-0">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
