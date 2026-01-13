import { useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Repeat,
  CreditCard,
  Banknote,
  Building,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import type { Giving } from '../types';

interface PersonGivingHistoryProps {
  personId: string;
  giving: Giving[];
  onViewAll?: () => void;
  compact?: boolean;
}

const fundColors: Record<string, string> = {
  tithe: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400',
  offering: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
  missions: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400',
  building: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  benevolence: 'bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-400',
  youth: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
  other: 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300',
};

const methodIcons: Record<string, React.ReactNode> = {
  cash: <Banknote size={12} />,
  check: <Building size={12} />,
  card: <CreditCard size={12} />,
  online: <TrendingUp size={12} />,
};

export function PersonGivingHistory({
  personId,
  giving,
  onViewAll,
  compact = false,
}: PersonGivingHistoryProps) {
  // Filter giving for this person
  const personGiving = useMemo(() => {
    return giving
      .filter((g) => g.personId === personId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [giving, personId]);

  // Calculate stats
  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const thisYearGiving = personGiving.filter(
      (g) => new Date(g.date).getFullYear() === currentYear
    );
    const lastYearGiving = personGiving.filter(
      (g) => new Date(g.date).getFullYear() === currentYear - 1
    );

    const totalThisYear = thisYearGiving.reduce((sum, g) => sum + g.amount, 0);
    const totalLastYear = lastYearGiving.reduce((sum, g) => sum + g.amount, 0);
    const totalAllTime = personGiving.reduce((sum, g) => sum + g.amount, 0);
    const recurringCount = personGiving.filter((g) => g.isRecurring).length;

    // By fund
    const byFund: Record<string, number> = {};
    thisYearGiving.forEach((g) => {
      byFund[g.fund] = (byFund[g.fund] || 0) + g.amount;
    });

    return {
      totalThisYear,
      totalLastYear,
      totalAllTime,
      recurringCount,
      giftCount: thisYearGiving.length,
      avgGift: thisYearGiving.length > 0 ? totalThisYear / thisYearGiving.length : 0,
      byFund,
      yearOverYear:
        totalLastYear > 0
          ? ((totalThisYear - totalLastYear) / totalLastYear) * 100
          : 0,
    };
  }, [personGiving]);

  if (personGiving.length === 0) {
    return (
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="text-green-500" size={20} />
          <h3 className="font-semibold text-gray-900 dark:text-dark-100">Giving History</h3>
        </div>
        <div className="text-center py-8">
          <DollarSign className="mx-auto text-gray-300 dark:text-dark-600 mb-2" size={32} />
          <p className="text-gray-500 dark:text-dark-400 text-sm">No giving records yet</p>
        </div>
      </div>
    );
  }

  if (compact) {
    // Compact view for sidebar or small spaces
    return (
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="text-green-500" size={18} />
            <h3 className="font-semibold text-gray-900 dark:text-dark-100 text-sm">Giving</h3>
          </div>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 flex items-center gap-1"
            >
              View All
              <ChevronRight size={14} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 dark:bg-green-500/10 rounded-xl p-3">
            <p className="text-xs text-gray-500 dark:text-dark-400">This Year</p>
            <p className="text-lg font-bold text-gray-900 dark:text-dark-100">
              ${stats.totalThisYear.toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-3">
            <p className="text-xs text-gray-500 dark:text-dark-400">All Time</p>
            <p className="text-lg font-bold text-gray-900 dark:text-dark-100">
              ${stats.totalAllTime.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <DollarSign className="text-green-500" size={20} />
          <h3 className="font-semibold text-gray-900 dark:text-dark-100">Giving History</h3>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 flex items-center gap-1"
          >
            View Full History
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
          <p className="text-xs opacity-80">This Year</p>
          <p className="text-xl font-bold">${stats.totalThisYear.toLocaleString()}</p>
          {stats.yearOverYear !== 0 && (
            <p className={`text-xs mt-1 ${stats.yearOverYear >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {stats.yearOverYear >= 0 ? '↑' : '↓'} {Math.abs(stats.yearOverYear).toFixed(0)}% vs last year
            </p>
          )}
        </div>
        <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-dark-400">All Time</p>
          <p className="text-xl font-bold text-gray-900 dark:text-dark-100">
            ${stats.totalAllTime.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
            {personGiving.length} gifts
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-dark-400">Avg Gift</p>
          <p className="text-xl font-bold text-gray-900 dark:text-dark-100">
            ${stats.avgGift.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
            {stats.giftCount} this year
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-dark-400">Recurring</p>
          <p className="text-xl font-bold text-gray-900 dark:text-dark-100">
            {stats.recurringCount > 0 ? (
              <span className="flex items-center gap-1">
                <Repeat size={16} className="text-purple-500" />
                Yes
              </span>
            ) : (
              'No'
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
            {stats.recurringCount} recurring
          </p>
        </div>
      </div>

      {/* Fund Breakdown */}
      {Object.keys(stats.byFund).length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
            This Year by Fund
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byFund)
              .sort((a, b) => b[1] - a[1])
              .map(([fund, amount]) => (
                <span
                  key={fund}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium ${fundColors[fund] || fundColors.other}`}
                >
                  {fund}: ${amount.toLocaleString()}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-3">
          Recent Gifts
        </p>
        <div className="space-y-2">
          {personGiving.slice(0, 5).map((gift) => (
            <div
              key={gift.id}
              className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-dark-800 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-gray-400 dark:text-dark-500 text-xs">
                  {methodIcons[gift.method]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-dark-100 text-sm">
                      ${gift.amount.toLocaleString()}
                    </span>
                    {gift.isRecurring && (
                      <Repeat size={12} className="text-purple-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-400">
                    <Calendar size={10} />
                    {new Date(gift.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded ${fundColors[gift.fund] || fundColors.other}`}
              >
                {gift.fund}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
