import { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Award,
  ChevronRight,
  ArrowLeft,
  BarChart3,
  Repeat,
  Search,
} from 'lucide-react';
import type { Person, Giving, DonationStats } from '../types';

interface MemberDonationStatsProps {
  people: Person[];
  giving: Giving[];
  onViewPerson?: (personId: string) => void;
  onBack?: () => void;
}

const FUND_COLORS: Record<string, string> = {
  tithe: 'bg-green-500',
  offering: 'bg-blue-500',
  missions: 'bg-purple-500',
  building: 'bg-amber-500',
  benevolence: 'bg-pink-500',
  youth: 'bg-cyan-500',
  other: 'bg-gray-500',
};

export function MemberDonationStats({
  people,
  giving,
  onViewPerson,
  onBack,
}: MemberDonationStatsProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'total' | 'recent' | 'name' | 'streak'>('total');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  // Calculate stats for each person
  const memberStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    return people.map((person) => {
      const personGiving = giving.filter((g) => g.personId === person.id);

      if (personGiving.length === 0) {
        return {
          person,
          stats: null,
        };
      }

      const thisYearGiving = personGiving.filter(
        (g) => new Date(g.date).getFullYear() === currentYear
      );
      const lastYearGiving = personGiving.filter(
        (g) => new Date(g.date).getFullYear() === lastYear
      );

      const totalLifetime = personGiving.reduce((sum, g) => sum + g.amount, 0);
      const totalThisYear = thisYearGiving.reduce((sum, g) => sum + g.amount, 0);
      const totalLastYear = lastYearGiving.reduce((sum, g) => sum + g.amount, 0);
      const averageGift = totalLifetime / personGiving.length;
      const largestGift = Math.max(...personGiving.map((g) => g.amount));

      // Sort by date to find first and last
      const sortedGiving = [...personGiving].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const firstGiftDate = sortedGiving[0]?.date;
      const lastGiftDate = sortedGiving[sortedGiving.length - 1]?.date;

      // Find preferred method and fund
      const methodCounts: Record<string, number> = {};
      const fundCounts: Record<string, number> = {};
      personGiving.forEach((g) => {
        methodCounts[g.method] = (methodCounts[g.method] || 0) + 1;
        fundCounts[g.fund] = (fundCounts[g.fund] || 0) + g.amount;
      });
      const preferredMethod = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const preferredFund = Object.entries(fundCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

      // Year over year change
      const yearOverYearChange =
        totalLastYear > 0
          ? ((totalThisYear - totalLastYear) / totalLastYear) * 100
          : totalThisYear > 0
          ? 100
          : 0;

      // Monthly giving for the last 12 months
      const monthlyGiving: { month: string; amount: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        const monthNum = date.getMonth();

        const monthAmount = personGiving
          .filter((g) => {
            const gDate = new Date(g.date);
            return gDate.getMonth() === monthNum && gDate.getFullYear() === year;
          })
          .reduce((sum, g) => sum + g.amount, 0);

        monthlyGiving.push({ month: `${month} ${year}`, amount: monthAmount });
      }

      // Fund breakdown
      const fundBreakdown = Object.entries(fundCounts).map(([fund, amount]) => ({
        fund,
        amount,
        percentage: (amount / totalLifetime) * 100,
      }));

      // Calculate giving streak (consecutive months)
      let streak = 0;
      for (let i = monthlyGiving.length - 1; i >= 0; i--) {
        if (monthlyGiving[i].amount > 0) {
          streak++;
        } else {
          break;
        }
      }

      const stats: DonationStats = {
        personId: person.id,
        totalLifetime,
        totalThisYear,
        totalLastYear,
        averageGift,
        largestGift,
        giftCount: personGiving.length,
        firstGiftDate,
        lastGiftDate,
        preferredMethod,
        preferredFund,
        yearOverYearChange,
        monthlyGiving,
        fundBreakdown,
        givingStreak: streak,
        basketContributions: 0, // Would be calculated from basket data
      };

      return { person, stats };
    });
  }, [people, giving]);

  // Filter and sort members
  const filteredMembers = useMemo(() => {
    const filtered = memberStats.filter((m) => {
      if (!m.stats) return false; // Only show members with giving history
      const fullName = `${m.person.firstName} ${m.person.lastName}`.toLowerCase();
      return fullName.includes(search.toLowerCase());
    });

    // Sort
    filtered.sort((a, b) => {
      if (!a.stats || !b.stats) return 0;
      switch (sortBy) {
        case 'total':
          return b.stats.totalLifetime - a.stats.totalLifetime;
        case 'recent':
          return new Date(b.stats.lastGiftDate || 0).getTime() - new Date(a.stats.lastGiftDate || 0).getTime();
        case 'name':
          return `${a.person.firstName} ${a.person.lastName}`.localeCompare(
            `${b.person.firstName} ${b.person.lastName}`
          );
        case 'streak':
          return b.stats.givingStreak - a.stats.givingStreak;
        default:
          return 0;
      }
    });

    return filtered;
  }, [memberStats, search, sortBy]);

  // Overall stats
  const overallStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const thisYearGiving = giving.filter((g) => new Date(g.date).getFullYear() === currentYear);

    const totalDonors = new Set(giving.map((g) => g.personId)).size;
    const newDonorsThisYear = new Set(
      thisYearGiving
        .filter((g) => {
          const firstGift = giving
            .filter((og) => og.personId === g.personId)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
          return firstGift && new Date(firstGift.date).getFullYear() === currentYear;
        })
        .map((g) => g.personId)
    ).size;

    const avgPerDonor = totalDonors > 0
      ? giving.reduce((sum, g) => sum + g.amount, 0) / totalDonors
      : 0;

    const topDonor = filteredMembers[0];

    return {
      totalDonors,
      newDonorsThisYear,
      avgPerDonor,
      topDonor: topDonor?.person,
      topDonorAmount: topDonor?.stats?.totalLifetime || 0,
    };
  }, [giving, filteredMembers]);

  // Selected member detail view
  const selectedMemberData = useMemo(() => {
    if (!selectedMember) return null;
    return memberStats.find((m) => m.person.id === selectedMember);
  }, [selectedMember, memberStats]);

  if (selectedMemberData && selectedMemberData.stats) {
    const { person, stats } = selectedMemberData;
    const maxMonthlyAmount = Math.max(...stats.monthlyGiving.map((m) => m.amount), 1);

    return (
      <div className="p-8">
        <button
          onClick={() => setSelectedMember(null)}
          className="inline-flex items-center gap-2 text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200 mb-6"
        >
          <ArrowLeft size={18} />
          Back to Members
        </button>

        {/* Member Header */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 mb-6">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center text-white font-bold text-xl">
              {person.firstName[0]}{person.lastName[0]}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                {person.firstName} {person.lastName}
              </h1>
              <p className="text-gray-500 dark:text-dark-400 mt-1">
                Member since {stats.firstGiftDate ? new Date(stats.firstGiftDate).toLocaleDateString() : 'N/A'}
              </p>
              <div className="flex items-center gap-4 mt-3">
                {stats.givingStreak > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
                    <Award size={14} />
                    {stats.givingStreak} month streak
                  </span>
                )}
                {stats.yearOverYearChange > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                    <TrendingUp size={14} />
                    +{stats.yearOverYearChange.toFixed(0)}% YoY
                  </span>
                )}
              </div>
            </div>
            {onViewPerson && (
              <button
                onClick={() => onViewPerson(person.id)}
                className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg"
              >
                View Profile
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white">
            <p className="text-sm opacity-80">Lifetime Total</p>
            <p className="text-2xl font-bold mt-1">${stats.totalLifetime.toLocaleString()}</p>
            <p className="text-xs opacity-70 mt-1">{stats.giftCount} gifts</p>
          </div>
          <div className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
            <p className="text-sm text-gray-500 dark:text-dark-400">This Year</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-dark-100 mt-1">
              ${stats.totalThisYear.toLocaleString()}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {stats.yearOverYearChange >= 0 ? (
                <TrendingUp size={12} className="text-green-500" />
              ) : (
                <TrendingDown size={12} className="text-red-500" />
              )}
              <span className={`text-xs ${stats.yearOverYearChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.yearOverYearChange >= 0 ? '+' : ''}{stats.yearOverYearChange.toFixed(0)}% vs last year
              </span>
            </div>
          </div>
          <div className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
            <p className="text-sm text-gray-500 dark:text-dark-400">Average Gift</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-dark-100 mt-1">
              ${stats.averageGift.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
              Largest: ${stats.largestGift.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
            <p className="text-sm text-gray-500 dark:text-dark-400">Last Gift</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-dark-100 mt-1">
              {stats.lastGiftDate ? new Date(stats.lastGiftDate).toLocaleDateString() : 'N/A'}
            </p>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-1 capitalize">
              Via {stats.preferredMethod}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Monthly Giving Chart */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">
              Monthly Giving (Last 12 Months)
            </h2>
            <div className="h-48 flex items-end gap-1">
              {stats.monthlyGiving.map((month, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-green-500 rounded-t transition-all hover:bg-green-600"
                    style={{ height: `${(month.amount / maxMonthlyAmount) * 100}%`, minHeight: month.amount > 0 ? '4px' : '0' }}
                    title={`${month.month}: $${month.amount.toLocaleString()}`}
                  />
                  <span className="text-[10px] text-gray-400 mt-1 rotate-45 origin-left">
                    {month.month.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Fund Breakdown */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">
              Giving by Fund
            </h2>
            <div className="space-y-3">
              {stats.fundBreakdown.map((fund) => (
                <div key={fund.fund}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-dark-300 capitalize">
                      {fund.fund}
                    </span>
                    <span className="text-sm text-gray-900 dark:text-dark-100">
                      ${fund.amount.toLocaleString()} ({fund.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${FUND_COLORS[fund.fund] || FUND_COLORS.other} rounded-full`}
                      style={{ width: `${fund.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Member Donation Statistics</h1>
            <p className="text-gray-500 dark:text-dark-400 mt-1">
              Detailed giving analytics for each member
            </p>
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-5">
          <DollarSign className="text-indigo-600 dark:text-indigo-400 mb-2" size={24} />
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{overallStats.totalDonors}</p>
          <p className="text-sm text-gray-600 dark:text-dark-300">Total Donors</p>
        </div>
        <div className="bg-green-50 dark:bg-green-500/10 rounded-xl p-5">
          <TrendingUp className="text-green-600 dark:text-green-400 mb-2" size={24} />
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{overallStats.newDonorsThisYear}</p>
          <p className="text-sm text-gray-600 dark:text-dark-300">New This Year</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-5">
          <BarChart3 className="text-purple-600 dark:text-purple-400 mb-2" size={24} />
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">
            ${overallStats.avgPerDonor.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-sm text-gray-600 dark:text-dark-300">Avg per Donor</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-5">
          <Award className="text-amber-600 dark:text-amber-400 mb-2" size={24} />
          <p className="text-lg font-bold text-gray-900 dark:text-dark-100">
            {overallStats.topDonor ? `${overallStats.topDonor.firstName} ${overallStats.topDonor.lastName[0]}.` : 'N/A'}
          </p>
          <p className="text-sm text-gray-600 dark:text-dark-300">
            Top Donor (${overallStats.topDonorAmount.toLocaleString()})
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="total">Sort by Total Given</option>
          <option value="recent">Sort by Most Recent</option>
          <option value="streak">Sort by Giving Streak</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* Members List */}
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-dark-800">
            <tr>
              <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase">
                Member
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase">
                Lifetime
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase">
                This Year
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase">
                YoY Change
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase">
                Streak
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase">
                Last Gift
              </th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
            {filteredMembers.map(({ person, stats }) => {
              if (!stats) return null;
              return (
                <tr
                  key={person.id}
                  className="hover:bg-gray-50 dark:hover:bg-dark-800 cursor-pointer"
                  onClick={() => setSelectedMember(person.id)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                        {person.firstName[0]}{person.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-dark-100">
                          {person.firstName} {person.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-dark-400">
                          {stats.giftCount} gifts
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-gray-900 dark:text-dark-100">
                      ${stats.totalLifetime.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-gray-700 dark:text-dark-200">
                      ${stats.totalThisYear.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center gap-1 ${
                      stats.yearOverYearChange >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stats.yearOverYearChange >= 0 ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )}
                      {stats.yearOverYearChange >= 0 ? '+' : ''}
                      {stats.yearOverYearChange.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {stats.givingStreak > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Repeat size={14} />
                        {stats.givingStreak}mo
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-gray-500 dark:text-dark-400 text-sm">
                      {stats.lastGiftDate ? new Date(stats.lastGiftDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight size={16} className="text-gray-400" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="mx-auto text-gray-300 dark:text-dark-600 mb-3" size={48} />
            <p className="text-gray-500 dark:text-dark-400">
              {search ? 'No members found matching your search' : 'No donation records found'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
