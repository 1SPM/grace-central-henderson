import { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Repeat,
  Users,
  Download,
  FileText,
  Package,
  Target,
  ArrowUpRight,
  Calendar,
  BarChart3,
  PieChart,
  CreditCard,
  Banknote,
  Building,
  Heart,
  ChevronRight,
} from 'lucide-react';
import type { Giving, Person, Campaign, Pledge, GivingAnalytics } from '../types';
import { exportGivingToCSV } from '../utils/exportCsv';

interface GivingDashboardProps {
  giving: Giving[];
  people: Person[];
  campaigns?: Campaign[];
  pledges?: Pledge[];
  onNavigate: (view: 'online-giving' | 'batch-entry' | 'pledges' | 'statements') => void;
}

const fundColors: Record<string, { bg: string; text: string; chart: string }> = {
  tithe: { bg: 'bg-green-100 dark:bg-green-500/15', text: 'text-green-700 dark:text-green-400', chart: '#22c55e' },
  offering: { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400', chart: '#3b82f6' },
  missions: { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400', chart: '#a855f7' },
  building: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', chart: '#f59e0b' },
  benevolence: { bg: 'bg-pink-100 dark:bg-pink-500/15', text: 'text-pink-700 dark:text-pink-400', chart: '#ec4899' },
  youth: { bg: 'bg-cyan-100 dark:bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-400', chart: '#06b6d4' },
  other: { bg: 'bg-gray-100 dark:bg-dark-700', text: 'text-gray-700 dark:text-dark-300', chart: '#6b7280' },
};

const methodIcons: Record<string, React.ReactNode> = {
  cash: <Banknote size={14} />,
  check: <Building size={14} />,
  card: <CreditCard size={14} />,
  online: <TrendingUp size={14} />,
};

export function GivingDashboard({
  giving,
  people,
  campaigns = [],
  pledges = [],
  onNavigate,
}: GivingDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  // Calculate analytics
  const analytics: GivingAnalytics = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;

    // Filter by period
    const getPeriodStart = () => {
      const date = new Date();
      switch (selectedPeriod) {
        case 'week':
          date.setDate(date.getDate() - 7);
          break;
        case 'month':
          date.setMonth(date.getMonth() - 1);
          break;
        case 'quarter':
          date.setMonth(date.getMonth() - 3);
          break;
        case 'year':
          date.setFullYear(date.getFullYear() - 1);
          break;
      }
      return date;
    };

    const periodStart = getPeriodStart();
    const periodGiving = giving.filter(g => new Date(g.date) >= periodStart);

    // Current year vs last year
    const currentYearGiving = giving.filter(g => new Date(g.date).getFullYear() === currentYear);
    const lastYearGiving = giving.filter(g => new Date(g.date).getFullYear() === lastYear);
    const currentYearTotal = currentYearGiving.reduce((sum, g) => sum + g.amount, 0);
    const lastYearTotal = lastYearGiving.reduce((sum, g) => sum + g.amount, 0);

    // Total
    const totalGiving = periodGiving.reduce((sum, g) => sum + g.amount, 0);

    // Monthly average
    const monthsInPeriod = selectedPeriod === 'week' ? 0.25 :
                          selectedPeriod === 'month' ? 1 :
                          selectedPeriod === 'quarter' ? 3 : 12;
    const monthlyAverage = monthsInPeriod > 0 ? totalGiving / monthsInPeriod : totalGiving;

    // Year over year change
    const yearOverYearChange = lastYearTotal > 0
      ? ((currentYearTotal - lastYearTotal) / lastYearTotal) * 100
      : 0;

    // Recurring
    const recurringGiving = periodGiving.filter(g => g.isRecurring);
    const recurringTotal = recurringGiving.reduce((sum, g) => sum + g.amount, 0);
    const recurringCount = recurringGiving.length;

    // Top funds
    const fundTotals: Record<string, number> = {};
    periodGiving.forEach(g => {
      fundTotals[g.fund] = (fundTotals[g.fund] || 0) + g.amount;
    });
    const topFunds = Object.entries(fundTotals)
      .map(([fund, amount]) => ({
        fund,
        amount,
        percentage: totalGiving > 0 ? (amount / totalGiving) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Monthly trend
    const monthlyTotals: Record<string, number> = {};
    periodGiving.forEach(g => {
      const month = new Date(g.date).toLocaleString('default', { month: 'short', year: '2-digit' });
      monthlyTotals[month] = (monthlyTotals[month] || 0) + g.amount;
    });
    const monthlyTrend = Object.entries(monthlyTotals)
      .map(([month, amount]) => ({ month, amount }))
      .slice(-12);

    // Donor stats
    const uniqueDonors = new Set(periodGiving.map(g => g.personId).filter(Boolean));
    const previousPeriodDonors = new Set(
      giving
        .filter(g => {
          const date = new Date(g.date);
          const prevPeriodStart = new Date(periodStart);
          prevPeriodStart.setMonth(prevPeriodStart.getMonth() - monthsInPeriod);
          return date >= prevPeriodStart && date < periodStart;
        })
        .map(g => g.personId)
        .filter(Boolean)
    );
    const returningDonors = [...uniqueDonors].filter(d => previousPeriodDonors.has(d as string));
    const donorRetention = previousPeriodDonors.size > 0
      ? (returningDonors.length / previousPeriodDonors.size) * 100
      : 0;

    const averageGiftSize = periodGiving.length > 0 ? totalGiving / periodGiving.length : 0;
    const newDonorCount = [...uniqueDonors].filter(d => !previousPeriodDonors.has(d as string)).length;

    return {
      totalGiving,
      monthlyAverage,
      yearOverYearChange,
      recurringTotal,
      recurringCount,
      topFunds,
      monthlyTrend,
      donorRetention,
      averageGiftSize,
      newDonorCount,
    };
  }, [giving, selectedPeriod]);

  // Recent transactions
  const recentTransactions = useMemo(() => {
    return [...giving]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [giving]);

  // Active campaigns
  const activeCampaigns = campaigns.filter(c => c.isActive).slice(0, 3);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Giving Dashboard</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">Track generosity and stewardship</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as typeof selectedPeriod)}
            className="px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-300 font-medium"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Last Year</option>
          </select>
          <button
            onClick={() => exportGivingToCSV(giving, people)}
            className="px-4 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors flex items-center gap-2"
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => onNavigate('online-giving')}
          className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl text-white text-left hover:from-green-600 hover:to-emerald-700 transition-all group"
        >
          <Heart className="mb-2" size={24} />
          <p className="font-semibold">Online Giving</p>
          <p className="text-sm opacity-80">Accept donations</p>
          <ArrowUpRight className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity" size={18} />
        </button>
        <button
          onClick={() => onNavigate('batch-entry')}
          className="p-4 bg-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-2xl text-left hover:border-gray-300 dark:hover:border-dark-600 transition-all group relative"
        >
          <Package className="mb-2 text-blue-500" size={24} />
          <p className="font-semibold text-gray-900 dark:text-dark-100">Batch Entry</p>
          <p className="text-sm text-gray-500 dark:text-dark-400">Cash & checks</p>
          <ChevronRight className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" size={18} />
        </button>
        <button
          onClick={() => onNavigate('pledges')}
          className="p-4 bg-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-2xl text-left hover:border-gray-300 dark:hover:border-dark-600 transition-all group relative"
        >
          <Target className="mb-2 text-purple-500" size={24} />
          <p className="font-semibold text-gray-900 dark:text-dark-100">Pledges</p>
          <p className="text-sm text-gray-500 dark:text-dark-400">{pledges.filter(p => p.status === 'active').length} active</p>
          <ChevronRight className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" size={18} />
        </button>
        <button
          onClick={() => onNavigate('statements')}
          className="p-4 bg-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-2xl text-left hover:border-gray-300 dark:hover:border-dark-600 transition-all group relative"
        >
          <FileText className="mb-2 text-amber-500" size={24} />
          <p className="font-semibold text-gray-900 dark:text-dark-100">Statements</p>
          <p className="text-sm text-gray-500 dark:text-dark-400">Tax receipts</p>
          <ChevronRight className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" size={18} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
          <DollarSign className="mb-4 opacity-80" size={24} />
          <p className="text-3xl font-bold">${analytics.totalGiving.toLocaleString()}</p>
          <p className="text-sm opacity-80 mt-1">Total This Period</p>
        </div>

        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/10 rounded-xl flex items-center justify-center">
              <BarChart3 className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <div className={`flex items-center gap-1 text-sm font-medium ${
              analytics.yearOverYearChange >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {analytics.yearOverYearChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {Math.abs(analytics.yearOverYearChange).toFixed(1)}%
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">
            ${analytics.monthlyAverage.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">Monthly Average</p>
        </div>

        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/10 rounded-xl flex items-center justify-center mb-4">
            <Repeat className="text-purple-600 dark:text-purple-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">
            ${analytics.recurringTotal.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
            {analytics.recurringCount} Recurring Gifts
          </p>
        </div>

        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/10 rounded-xl flex items-center justify-center mb-4">
            <Users className="text-amber-600 dark:text-amber-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">
            {analytics.newDonorCount}
          </p>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
            New Donors • {analytics.donorRetention.toFixed(0)}% Retention
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fund Breakdown */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-2">
              <PieChart size={20} className="text-gray-400" />
              By Fund
            </h2>
          </div>
          <div className="space-y-4">
            {analytics.topFunds.map(({ fund, amount, percentage }) => {
              const colors = fundColors[fund] || fundColors.other;
              return (
                <div key={fund}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm px-3 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                      {fund.charAt(0).toUpperCase() + fund.slice(1)}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-dark-100">
                      ${amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: colors.chart,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
              Recent Transactions
            </h2>
            <span className="text-sm text-gray-500 dark:text-dark-400">
              {giving.length} total
            </span>
          </div>
          <div className="space-y-3">
            {recentTransactions.map((gift) => {
              const person = people.find((p) => p.id === gift.personId);
              const colors = fundColors[gift.fund] || fundColors.other;
              return (
                <div
                  key={gift.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-dark-700 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {person ? (
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {person.firstName[0]}{person.lastName[0]}
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center">
                        <DollarSign className="text-gray-400" size={18} />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-dark-100">
                        {person ? `${person.firstName} ${person.lastName}` : 'Anonymous'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-dark-400">
                        {methodIcons[gift.method]}
                        <span className="capitalize">{gift.method}</span>
                        <span>•</span>
                        <span>{new Date(gift.date).toLocaleDateString()}</span>
                        {gift.isRecurring && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-purple-500 dark:text-purple-400">
                              <Repeat size={10} />
                              recurring
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-dark-100">
                      ${gift.amount.toLocaleString()}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                      {gift.fund}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Campaigns */}
      {activeCampaigns.length > 0 && (
        <div className="mt-6 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-2">
              <Target size={20} className="text-purple-500" />
              Active Campaigns
            </h2>
            <button
              onClick={() => onNavigate('pledges')}
              className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium flex items-center gap-1"
            >
              View All
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeCampaigns.map((campaign) => {
              const campaignPledges = pledges.filter((p) => p.campaignId === campaign.id);
              const totalGiven = campaignPledges.reduce((sum, p) => sum + (p.totalGiven || 0), 0);
              const percentage = campaign.goalAmount
                ? Math.min((totalGiven / campaign.goalAmount) * 100, 100)
                : 0;

              return (
                <div
                  key={campaign.id}
                  className="p-4 bg-gray-50 dark:bg-dark-800 rounded-xl"
                >
                  <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-2">
                    {campaign.name}
                  </h3>
                  {campaign.goalAmount && (
                    <>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-500 dark:text-dark-400">
                          ${totalGiven.toLocaleString()} / ${campaign.goalAmount.toLocaleString()}
                        </span>
                        <span className="font-medium text-purple-600 dark:text-purple-400">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </>
                  )}
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-dark-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {campaign.endDate
                        ? `Ends ${new Date(campaign.endDate).toLocaleDateString()}`
                        : 'Ongoing'}
                    </span>
                    <span>{campaignPledges.length} pledges</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Trend Chart (simplified) */}
      {analytics.monthlyTrend.length > 0 && (
        <div className="mt-6 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-500" />
            Monthly Trend
          </h2>
          <div className="flex items-end justify-between gap-2 h-40">
            {analytics.monthlyTrend.map(({ month, amount }) => {
              const maxAmount = Math.max(...analytics.monthlyTrend.map((t) => t.amount));
              const height = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;

              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-gradient-to-t from-green-500 to-emerald-400 rounded-t-lg transition-all duration-500"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  />
                  <span className="text-xs text-gray-500 dark:text-dark-400">{month}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
