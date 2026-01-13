import { useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  ChevronRight,
  Repeat,
} from 'lucide-react';
import type { Giving } from '../types';

interface GivingWidgetProps {
  giving: Giving[];
  onViewGiving: () => void;
}

export function GivingWidget({ giving, onViewGiving }: GivingWidgetProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // This month's giving
    const thisMonthGiving = giving.filter((g) => {
      const date = new Date(g.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    // Last month's giving
    const lastMonthGiving = giving.filter((g) => {
      const date = new Date(g.date);
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    });

    const thisMonthTotal = thisMonthGiving.reduce((sum, g) => sum + g.amount, 0);
    const lastMonthTotal = lastMonthGiving.reduce((sum, g) => sum + g.amount, 0);

    // Year to date
    const ytdGiving = giving.filter((g) => new Date(g.date).getFullYear() === currentYear);
    const ytdTotal = ytdGiving.reduce((sum, g) => sum + g.amount, 0);

    // Unique donors this month
    const uniqueDonorsThisMonth = new Set(thisMonthGiving.map((g) => g.personId)).size;

    // Recurring count
    const recurringCount = giving.filter((g) => g.isRecurring).length;

    // Percentage change
    const percentChange = lastMonthTotal > 0
      ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
      : 0;

    // Recent transactions (last 5)
    const recentGiving = [...giving]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return {
      thisMonthTotal,
      lastMonthTotal,
      ytdTotal,
      uniqueDonorsThisMonth,
      recurringCount,
      percentChange,
      recentGiving,
    };
  }, [giving]);

  const fundColors: Record<string, string> = {
    tithe: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400',
    offering: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
    missions: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400',
    building: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
    benevolence: 'bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-400',
    youth: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
    other: 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300',
  };

  return (
    <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-500/10 rounded-xl flex items-center justify-center">
            <DollarSign className="text-green-600 dark:text-green-400" size={20} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Giving Overview</h2>
        </div>
        <button
          onClick={onViewGiving}
          className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium flex items-center gap-1"
        >
          View Details
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
          <p className="text-xs opacity-80">This Month</p>
          <p className="text-xl font-bold">${stats.thisMonthTotal.toLocaleString()}</p>
          {stats.percentChange !== 0 && (
            <div className="flex items-center gap-1 mt-1">
              {stats.percentChange >= 0 ? (
                <TrendingUp size={12} />
              ) : (
                <TrendingDown size={12} />
              )}
              <span className="text-xs">
                {stats.percentChange >= 0 ? '+' : ''}{stats.percentChange.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
        <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-dark-400">Year to Date</p>
          <p className="text-xl font-bold text-gray-900 dark:text-dark-100">
            ${stats.ytdTotal.toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-dark-400">Donors</p>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-indigo-500" />
            <p className="text-xl font-bold text-gray-900 dark:text-dark-100">
              {stats.uniqueDonorsThisMonth}
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">this month</p>
        </div>
        <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-dark-400">Recurring</p>
          <div className="flex items-center gap-2">
            <Repeat size={16} className="text-purple-500" />
            <p className="text-xl font-bold text-gray-900 dark:text-dark-100">
              {stats.recurringCount}
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">active</p>
        </div>
      </div>

      {/* Recent Transactions */}
      {stats.recentGiving.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-dark-300 mb-3">Recent Gifts</p>
          <div className="space-y-2">
            {stats.recentGiving.map((gift) => (
              <div
                key={gift.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-dark-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900 dark:text-dark-100 text-sm">
                    ${gift.amount.toLocaleString()}
                  </span>
                  {gift.isRecurring && (
                    <Repeat size={12} className="text-purple-500" />
                  )}
                  <span className="text-xs text-gray-500 dark:text-dark-400">
                    {new Date(gift.date).toLocaleDateString()}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${fundColors[gift.fund] || fundColors.other}`}>
                  {gift.fund}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {giving.length === 0 && (
        <div className="text-center py-8">
          <DollarSign className="mx-auto text-gray-300 dark:text-dark-600 mb-2\" size={32} />
          <p className="text-gray-500 dark:text-dark-400 text-sm">No giving records yet</p>
          <button
            onClick={onViewGiving}
            className="mt-2 text-sm text-green-600 dark:text-green-400 hover:text-green-700 font-medium"
          >
            Start tracking donations
          </button>
        </div>
      )}
    </div>
  );
}
