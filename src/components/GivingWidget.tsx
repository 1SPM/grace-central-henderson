import { useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  ArrowRight,
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
    tithe: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    offering: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
    missions: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400',
    building: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
    benevolence: 'bg-pink-50 dark:bg-pink-500/10 text-pink-700 dark:text-pink-400',
    youth: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
    other: 'bg-gray-50 dark:bg-dark-700 text-gray-600 dark:text-dark-300',
  };

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Giving Overview</h2>
        <button
          onClick={onViewGiving}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
        >
          View details
          <ArrowRight size={12} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">This Month</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-dark-100 mt-0.5">
            ${stats.thisMonthTotal.toLocaleString()}
          </p>
          {stats.percentChange !== 0 && (
            <div className={`flex items-center gap-0.5 mt-1 text-xs ${
              stats.percentChange >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {stats.percentChange >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              <span>{stats.percentChange >= 0 ? '+' : ''}{stats.percentChange.toFixed(0)}%</span>
            </div>
          )}
        </div>
        <div className="p-3 bg-gray-50 dark:bg-dark-850 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-dark-400">Year to Date</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-dark-100 mt-0.5">
            ${stats.ytdTotal.toLocaleString()}
          </p>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-dark-850 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-dark-400">Donors</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Users size={14} className="text-indigo-500" />
            <p className="text-lg font-semibold text-gray-900 dark:text-dark-100">
              {stats.uniqueDonorsThisMonth}
            </p>
          </div>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-dark-850 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-dark-400">Recurring</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Repeat size={14} className="text-purple-500" />
            <p className="text-lg font-semibold text-gray-900 dark:text-dark-100">
              {stats.recurringCount}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {stats.recentGiving.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-dark-400 mb-2">Recent Gifts</p>
          <div className="space-y-1">
            {stats.recentGiving.map((gift) => (
              <div
                key={gift.id}
                className="flex items-center justify-between py-2 px-2.5 bg-gray-50 dark:bg-dark-850 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                    ${gift.amount.toLocaleString()}
                  </span>
                  {gift.isRecurring && (
                    <Repeat size={10} className="text-purple-500" />
                  )}
                  <span className="text-xs text-gray-400 dark:text-dark-500">
                    {new Date(gift.date).toLocaleDateString()}
                  </span>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded ${fundColors[gift.fund] || fundColors.other}`}>
                  {gift.fund}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {giving.length === 0 && (
        <div className="text-center py-6">
          <DollarSign className="mx-auto text-gray-300 dark:text-dark-600 mb-2" size={24} />
          <p className="text-gray-400 dark:text-dark-500 text-sm">No giving records yet</p>
          <button
            onClick={onViewGiving}
            className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium"
          >
            Start tracking donations
          </button>
        </div>
      )}
    </div>
  );
}
