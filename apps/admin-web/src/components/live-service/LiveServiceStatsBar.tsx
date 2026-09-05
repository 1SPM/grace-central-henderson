import type { LiveServiceStats } from '../../hooks/useLiveServiceOps';

interface LiveServiceStatsBarProps {
  stats: LiveServiceStats;
}

export function LiveServiceStatsBar({ stats }: LiveServiceStatsBarProps) {
  const cards = [
    { label: 'WATCHING NOW', value: stats.watchingNow.toLocaleString() },
    { label: 'CURRENT SERIES', value: stats.currentSeries },
    { label: 'GIFTS THIS SERVICE', value: stats.giftsThisService.toLocaleString() },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map(card => (
        <div
          key={card.label}
          className="bg-stone-100 dark:bg-dark-800 rounded-xl px-5 py-4 border border-gray-200 dark:border-dark-700"
        >
          <div className="text-2xl font-bold text-gray-900 dark:text-dark-100 tabular-nums">
            {card.value}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-dark-400 mt-1">
            {card.label}
          </div>
        </div>
      ))}
    </div>
  );
}
