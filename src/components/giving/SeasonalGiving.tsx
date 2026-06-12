import { useState } from 'react';
import { Check } from 'lucide-react';
import { demoSeasonal, type SeasonalStatus } from './demoGivingHub';

const STATUS_STYLE: Record<SeasonalStatus, { pill: string; label: string }> = {
  completed: { pill: 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-dark-400', label: 'Completed' },
  active: { pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Active now' },
  upcoming: { pill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', label: 'Upcoming' },
  'next-year': { pill: 'bg-gray-100 text-gray-400 dark:bg-dark-700 dark:text-dark-500', label: 'Next year' },
};

export function SeasonalGiving() {
  const [enabled, setEnabled] = useState<string[]>(demoSeasonal.filter(s => s.status === 'active').map(s => s.id));

  const toggle = (id: string) =>
    setEnabled(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  return (
    <div className="space-y-4">
      <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
        <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Seasonal giving calendar</h2>
        <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
          Grace AI auto-suggests campaigns for each liturgical and community season — enable with one click and the
          campaign appears in the member app for its date window.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {demoSeasonal.map(season => {
          const style = STATUS_STYLE[season.status];
          const isEnabled = enabled.includes(season.id);
          const canToggle = season.status === 'upcoming' || season.status === 'next-year';
          return (
            <div
              key={season.id}
              className={`bg-stone-100 dark:bg-dark-800 rounded-xl border p-4 flex flex-col ${
                season.status === 'active'
                  ? 'border-emerald-300 dark:border-emerald-800'
                  : 'border-gray-200 dark:border-dark-700'
              } ${season.status === 'next-year' ? 'opacity-70' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl leading-none">{season.emoji}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${style.pill}`}>{style.label}</span>
              </div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">{season.name}</h3>
              <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-0.5">{season.dates}</p>
              <p className="text-[11px] text-gray-500 dark:text-dark-400 mt-1.5 flex-1">
                {season.status === 'completed' && season.raised !== undefined
                  ? `Raised $${season.raised.toLocaleString()}`
                  : season.description}
              </p>
              <div className="mt-3">
                {season.status === 'completed' && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-dark-500">
                    <Check size={12} /> Closed &amp; settled
                  </span>
                )}
                {season.status === 'active' && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    <Check size={12} /> Live in member app
                  </span>
                )}
                {canToggle && (
                  <button
                    onClick={() => toggle(season.id)}
                    className={`w-full py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      isEnabled
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                        : 'border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-850'
                    }`}
                  >
                    {isEnabled ? '✓ Enabled' : 'Enable'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
