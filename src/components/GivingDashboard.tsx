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
  ArrowRight,
  Calendar,
  BarChart3,
  CreditCard,
  Banknote,
  Building,
  Heart,
  ShoppingBasket,
  Search,
  UserCheck,
} from 'lucide-react';
import type { Giving, Person, Campaign, Pledge, GivingAnalytics } from '../types';
import { exportGivingToCSV } from '../utils/csvExport';

interface GivingDashboardProps {
  giving: Giving[];
  people: Person[];
  campaigns?: Campaign[];
  pledges?: Pledge[];
  onNavigate: (view: 'online-giving' | 'batch-entry' | 'pledges' | 'statements' | 'charity-baskets' | 'donation-tracker' | 'member-stats') => void;
}

const fundColors: Record<string, { bg: string; text: string; bar: string }> = {
  tithe: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500' },
  offering: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', bar: 'bg-blue-500' },
  missions: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', bar: 'bg-purple-500' },
  building: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-500' },
  benevolence: { bg: 'bg-pink-50 dark:bg-pink-500/10', text: 'text-pink-700 dark:text-pink-400', bar: 'bg-pink-500' },
  youth: { bg: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-400', bar: 'bg-cyan-500' },
  other: { bg: 'bg-gray-50 dark:bg-dark-700', text: 'text-gray-700 dark:text-dark-300', bar: 'bg-gray-400' },
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
      .slice(0, 8);
  }, [giving]);

  // Active campaigns
  const activeCampaigns = campaigns.filter(c => c.isActive).slice(0, 3);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-dark-100">Giving</h1>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-0.5">Track donations and stewardship</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as typeof selectedPeriod)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-300"
          >
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="quarter">Last quarter</option>
            <option value="year">Last year</option>
          </select>
          <button
            onClick={() => exportGivingToCSV(giving, people)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-dark-600 text-gray-600 dark:text-dark-300 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors flex items-center gap-1.5"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Quick Actions - Clean grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => onNavigate('online-giving')}
          className="group p-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white text-left transition-colors"
        >
          <Heart className="mb-3" size={20} />
          <p className="font-medium text-sm">Online Giving</p>
          <p className="text-xs text-indigo-200 mt-0.5">Accept donations</p>
        </button>
        <button
          onClick={() => onNavigate('batch-entry')}
          className="group p-4 bg-white dark:bg-dark-800 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors border border-gray-200 dark:border-dark-700"
        >
          <Package className="mb-3 text-gray-400" size={20} />
          <p className="font-medium text-sm text-gray-900 dark:text-dark-100">Batch Entry</p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">Cash & checks</p>
        </button>
        <button
          onClick={() => onNavigate('pledges')}
          className="group p-4 bg-white dark:bg-dark-800 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors border border-gray-200 dark:border-dark-700"
        >
          <Target className="mb-3 text-gray-400" size={20} />
          <p className="font-medium text-sm text-gray-900 dark:text-dark-100">Pledges</p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">{pledges.filter(p => p.status === 'active').length} active</p>
        </button>
        <button
          onClick={() => onNavigate('statements')}
          className="group p-4 bg-white dark:bg-dark-800 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors border border-gray-200 dark:border-dark-700"
        >
          <FileText className="mb-3 text-gray-400" size={20} />
          <p className="font-medium text-sm text-gray-900 dark:text-dark-100">Statements</p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">Tax receipts</p>
        </button>
      </div>

      {/* Secondary Actions */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => onNavigate('charity-baskets')}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors whitespace-nowrap"
        >
          <ShoppingBasket size={14} className="text-orange-500" />
          <span className="text-gray-700 dark:text-dark-300">Charity Baskets</span>
        </button>
        <button
          onClick={() => onNavigate('donation-tracker')}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors whitespace-nowrap"
        >
          <Search size={14} className="text-indigo-500" />
          <span className="text-gray-700 dark:text-dark-300">Donation Tracker</span>
        </button>
        <button
          onClick={() => onNavigate('member-stats')}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors whitespace-nowrap"
        >
          <UserCheck size={14} className="text-teal-500" />
          <span className="text-gray-700 dark:text-dark-300">Member Stats</span>
        </button>
      </div>

      {/* Stats Grid - Clean cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="text-emerald-600 dark:text-emerald-400" size={16} />
            </div>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
            ${analytics.totalGiving.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">Total this period</p>
        </div>

        <div className="p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="text-blue-600 dark:text-blue-400" size={16} />
            </div>
            <span className={`text-xs font-medium flex items-center gap-0.5 ${
              analytics.yearOverYearChange >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {analytics.yearOverYearChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(analytics.yearOverYearChange).toFixed(1)}%
            </span>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
            ${analytics.monthlyAverage.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">Monthly average</p>
        </div>

        <div className="p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-500/10 rounded-lg flex items-center justify-center mb-3">
            <Repeat className="text-purple-600 dark:text-purple-400" size={16} />
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
            ${analytics.recurringTotal.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">{analytics.recurringCount} recurring</p>
        </div>

        <div className="p-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
          <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/10 rounded-lg flex items-center justify-center mb-3">
            <Users className="text-amber-600 dark:text-amber-400" size={16} />
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
            {analytics.newDonorCount}
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">New donors · {analytics.donorRetention.toFixed(0)}% retention</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fund Breakdown */}
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-4">By Fund</h2>
          <div className="space-y-3">
            {analytics.topFunds.slice(0, 5).map(({ fund, amount, percentage }) => {
              const colors = fundColors[fund] || fundColors.other;
              return (
                <div key={fund}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-700 dark:text-dark-300 capitalize">{fund}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                      ${amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colors.bar}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Recent Transactions</h2>
            <button
              onClick={() => onNavigate('donation-tracker')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              View all
              <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-1">
            {recentTransactions.map((gift) => {
              const person = people.find((p) => p.id === gift.personId);
              const colors = fundColors[gift.fund] || fundColors.other;
              return (
                <div
                  key={gift.id}
                  className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-dark-700 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {person ? (
                      <div className="w-8 h-8 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-dark-300">
                        {person.firstName[0]}{person.lastName[0]}
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center">
                        <DollarSign className="text-gray-400" size={14} />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                        {person ? `${person.firstName} ${person.lastName}` : 'Anonymous'}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-dark-500">
                        {methodIcons[gift.method]}
                        <span>{new Date(gift.date).toLocaleDateString()}</span>
                        {gift.isRecurring && (
                          <span className="text-purple-500 dark:text-purple-400 flex items-center gap-0.5">
                            <Repeat size={10} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                      ${gift.amount.toLocaleString()}
                    </p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
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
        <div className="mt-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100">Active Campaigns</h2>
            <button
              onClick={() => onNavigate('pledges')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              View all
              <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {activeCampaigns.map((campaign) => {
              const campaignPledges = pledges.filter((p) => p.campaignId === campaign.id);
              const totalGiven = campaignPledges.reduce((sum, p) => sum + (p.totalGiven || 0), 0);
              const percentage = campaign.goalAmount
                ? Math.min((totalGiven / campaign.goalAmount) * 100, 100)
                : 0;

              return (
                <div
                  key={campaign.id}
                  className="p-4 bg-gray-50 dark:bg-dark-850 rounded-lg"
                >
                  <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-2">
                    {campaign.name}
                  </h3>
                  {campaign.goalAmount && (
                    <>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-gray-500 dark:text-dark-400">
                          ${totalGiven.toLocaleString()} / ${campaign.goalAmount.toLocaleString()}
                        </span>
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </>
                  )}
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-dark-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
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

      {/* Monthly Trend */}
      {analytics.monthlyTrend.length > 1 && (
        <div className="mt-4 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <h2 className="text-sm font-medium text-gray-900 dark:text-dark-100 mb-4">Monthly Trend</h2>
          <div className="flex items-end justify-between gap-1 h-32">
            {analytics.monthlyTrend.map(({ month, amount }) => {
              const maxAmount = Math.max(...analytics.monthlyTrend.map((t) => t.amount));
              const height = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;

              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className="w-full relative">
                    <div
                      className="w-full bg-indigo-500 hover:bg-indigo-600 rounded transition-all cursor-default"
                      style={{ height: `${Math.max(height, 4)}px` }}
                    />
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block">
                      <div className="bg-gray-900 dark:bg-dark-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        ${amount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-dark-500">{month}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
