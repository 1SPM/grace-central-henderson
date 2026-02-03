import { useState, useMemo } from 'react';
import {
  DollarSign,
  Search,
  Filter,
  Download,
  TrendingUp,
  Users,
  Repeat,
  CreditCard,
  Banknote,
  Building2,
  Globe,
  ArrowLeft,
  ChevronDown,
  BarChart3,
  Target,
  Calendar,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import type { Giving, Person, DonationTrackerFilters, DonationGoal } from '../types';

interface DonationTrackerProps {
  giving: Giving[];
  people: Person[];
  goals?: DonationGoal[];
  onBack?: () => void;
  onViewMemberStats?: () => void;
  onViewPerson?: (personId: string) => void;
  onAddGoal?: () => void;
}

// Sample goals for demo - in production these would come from database
const SAMPLE_GOALS: DonationGoal[] = [
  {
    id: '1',
    name: '2026 Building Fund',
    description: 'New sanctuary construction fund',
    targetAmount: 500000,
    currentAmount: 325000,
    startDate: '2025-01-01',
    endDate: '2026-12-31',
    fund: 'building',
    isPublic: true,
    status: 'active',
    createdAt: '2025-01-01',
  },
  {
    id: '2',
    name: 'Mission Trip - Guatemala',
    description: 'Summer mission trip to Guatemala',
    targetAmount: 25000,
    currentAmount: 18500,
    startDate: '2026-01-01',
    endDate: '2026-06-01',
    fund: 'missions',
    isPublic: true,
    status: 'active',
    createdAt: '2026-01-01',
  },
  {
    id: '3',
    name: 'Youth Camp Scholarships',
    description: 'Help send youth to summer camp',
    targetAmount: 8000,
    currentAmount: 8000,
    startDate: '2026-01-01',
    endDate: '2026-05-01',
    fund: 'youth',
    isPublic: true,
    status: 'completed',
    createdAt: '2026-01-01',
  },
];

const METHOD_ICONS: Record<string, React.ReactNode> = {
  cash: <Banknote size={14} />,
  check: <Building2 size={14} />,
  card: <CreditCard size={14} />,
  online: <Globe size={14} />,
};

const FUND_COLORS: Record<string, { bg: string; text: string }> = {
  tithe: { bg: 'bg-green-100 dark:bg-green-500/15', text: 'text-green-700 dark:text-green-400' },
  offering: { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400' },
  missions: { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400' },
  building: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400' },
  benevolence: { bg: 'bg-pink-100 dark:bg-pink-500/15', text: 'text-pink-700 dark:text-pink-400' },
  youth: { bg: 'bg-cyan-100 dark:bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-400' },
  other: { bg: 'bg-gray-100 dark:bg-gray-500/15', text: 'text-gray-700 dark:text-gray-400' },
};

export function DonationTracker({
  giving,
  people,
  goals = SAMPLE_GOALS,
  onBack,
  onViewMemberStats,
  onViewPerson,
  onAddGoal,
}: DonationTrackerProps) {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DonationTrackerFilters>({});
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all' | 'custom'>('30d');
  const [showGoals, setShowGoals] = useState(true);

  // Filter and sort goals
  const activeGoals = useMemo(() => {
    return goals
      .filter(g => g.status === 'active')
      .sort((a, b) => {
        // Sort by percentage complete descending
        const aPercent = a.currentAmount / a.targetAmount;
        const bPercent = b.currentAmount / b.targetAmount;
        return bPercent - aPercent;
      });
  }, [goals]);

  const completedGoals = useMemo(() => {
    return goals.filter(g => g.status === 'completed');
  }, [goals]);

  // Calculate date range
  const dateFilter = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      case '90d':
        return new Date(now.setDate(now.getDate() - 90));
      case '1y':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      case 'all':
        return null;
      case 'custom':
        return filters.dateFrom ? new Date(filters.dateFrom) : null;
      default:
        return null;
    }
  }, [dateRange, filters.dateFrom]);

  // Filter donations
  const filteredDonations = useMemo(() => {
    return giving.filter((g) => {
      // Date filter
      if (dateFilter && new Date(g.date) < dateFilter) return false;
      if (filters.dateTo && new Date(g.date) > new Date(filters.dateTo)) return false;

      // Search
      if (search) {
        const person = people.find((p) => p.id === g.personId);
        const personName = person ? `${person.firstName} ${person.lastName}`.toLowerCase() : '';
        const matchesSearch =
          personName.includes(search.toLowerCase()) ||
          g.fund.toLowerCase().includes(search.toLowerCase()) ||
          g.amount.toString().includes(search);
        if (!matchesSearch) return false;
      }

      // Other filters
      if (filters.fund && g.fund !== filters.fund) return false;
      if (filters.method && g.method !== filters.method) return false;
      if (filters.personId && g.personId !== filters.personId) return false;
      if (filters.minAmount && g.amount < filters.minAmount) return false;
      if (filters.maxAmount && g.amount > filters.maxAmount) return false;
      if (filters.isRecurring !== undefined && g.isRecurring !== filters.isRecurring) return false;

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [giving, search, filters, dateFilter, people]);

  // Calculate stats for filtered period
  const stats = useMemo(() => {
    const total = filteredDonations.reduce((sum, g) => sum + g.amount, 0);
    const count = filteredDonations.length;
    const average = count > 0 ? total / count : 0;
    const recurring = filteredDonations.filter((g) => g.isRecurring).length;
    const uniqueDonors = new Set(filteredDonations.map((g) => g.personId)).size;

    // By fund
    const byFund: Record<string, number> = {};
    filteredDonations.forEach((g) => {
      byFund[g.fund] = (byFund[g.fund] || 0) + g.amount;
    });

    // By method
    const byMethod: Record<string, number> = {};
    filteredDonations.forEach((g) => {
      byMethod[g.method] = (byMethod[g.method] || 0) + g.amount;
    });

    // Daily trend (last 30 days)
    const dailyTrend: { date: string; amount: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayAmount = filteredDonations
        .filter((g) => g.date === dateStr)
        .reduce((sum, g) => sum + g.amount, 0);
      dailyTrend.push({ date: dateStr, amount: dayAmount });
    }

    return { total, count, average, recurring, uniqueDonors, byFund, byMethod, dailyTrend };
  }, [filteredDonations]);

  const getPersonName = (personId: string) => {
    const person = people.find((p) => p.id === personId);
    return person ? `${person.firstName} ${person.lastName}` : 'Anonymous';
  };

  const clearFilters = () => {
    setFilters({});
    setSearch('');
    setDateRange('30d');
  };

  const hasActiveFilters = search || Object.keys(filters).length > 0 || dateRange !== '30d';

  const maxDailyAmount = Math.max(...stats.dailyTrend.map((d) => d.amount), 1);

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Donation Tracker</h1>
            <p className="text-gray-500 dark:text-dark-400 mt-1">
              Track, search, and analyze all donation records
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {onViewMemberStats && (
            <button
              onClick={onViewMemberStats}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg"
            >
              <Users size={16} />
              Member Stats
            </button>
          )}
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-dark-700 text-sm font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 rounded-lg">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white">
          <DollarSign className="mb-2 opacity-80" size={20} />
          <p className="text-2xl font-bold">${stats.total.toLocaleString()}</p>
          <p className="text-sm opacity-80">Total Donations</p>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <BarChart3 className="text-blue-500 mb-2" size={20} />
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{stats.count}</p>
          <p className="text-sm text-gray-500 dark:text-dark-400">Transactions</p>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <TrendingUp className="text-purple-500 mb-2" size={20} />
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">
            ${stats.average.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-sm text-gray-500 dark:text-dark-400">Avg. Donation</p>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <Users className="text-indigo-500 mb-2" size={20} />
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{stats.uniqueDonors}</p>
          <p className="text-sm text-gray-500 dark:text-dark-400">Unique Donors</p>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <Repeat className="text-amber-500 mb-2" size={20} />
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{stats.recurring}</p>
          <p className="text-sm text-gray-500 dark:text-dark-400">Recurring</p>
        </div>
      </div>

      {/* Donation Goals Section */}
      {(activeGoals.length > 0 || completedGoals.length > 0) && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowGoals(!showGoals)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-dark-100 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <Target size={18} />
              Fundraising Goals ({activeGoals.length} active)
              <ChevronDown size={16} className={`transition-transform ${showGoals ? 'rotate-180' : ''}`} />
            </button>
            {onAddGoal && (
              <button
                onClick={onAddGoal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg"
              >
                <Plus size={14} />
                New Goal
              </button>
            )}
          </div>

          {showGoals && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeGoals.map((goal) => {
                const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                const remaining = goal.targetAmount - goal.currentAmount;
                const daysLeft = goal.endDate
                  ? Math.max(0, Math.ceil((new Date(goal.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                  : null;
                const fundColor = FUND_COLORS[goal.fund || 'other'] || FUND_COLORS.other;

                return (
                  <div
                    key={goal.id}
                    className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-dark-100">{goal.name}</h4>
                        {goal.description && (
                          <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">{goal.description}</p>
                        )}
                      </div>
                      {goal.fund && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${fundColor.bg} ${fundColor.text}`}>
                          {goal.fund}
                        </span>
                      )}
                    </div>

                    <div className="mb-3">
                      <div className="flex items-end justify-between mb-1.5">
                        <span className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                          ${goal.currentAmount.toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-dark-400">
                          of ${goal.targetAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            percentage >= 100
                              ? 'bg-green-500'
                              : percentage >= 75
                              ? 'bg-emerald-500'
                              : percentage >= 50
                              ? 'bg-blue-500'
                              : percentage >= 25
                              ? 'bg-amber-500'
                              : 'bg-indigo-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {percentage.toFixed(0)}% complete
                      </span>
                      <div className="flex items-center gap-3 text-gray-500 dark:text-dark-400">
                        {remaining > 0 && (
                          <span>${remaining.toLocaleString()} to go</span>
                        )}
                        {daysLeft !== null && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {daysLeft === 0 ? 'Ends today' : `${daysLeft}d left`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Show completed goals summary */}
              {completedGoals.length > 0 && (
                <div className="bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-green-500/20 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="text-green-600 dark:text-green-400" size={18} />
                    <h4 className="font-semibold text-green-800 dark:text-green-400">
                      {completedGoals.length} Goal{completedGoals.length !== 1 ? 's' : ''} Completed
                    </h4>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-400/80">
                    Total raised: ${completedGoals.reduce((sum, g) => sum + g.currentAmount, 0).toLocaleString()}
                  </p>
                  <div className="mt-3 space-y-1">
                    {completedGoals.slice(0, 3).map((goal) => (
                      <div key={goal.id} className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400/70">
                        <CheckCircle2 size={12} />
                        <span>{goal.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Daily Trend */}
        <div className="col-span-2 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100 mb-4">Daily Donations (Last 30 Days)</h3>
          <div className="h-32 flex items-end gap-0.5">
            {stats.dailyTrend.map((day, i) => (
              <div
                key={i}
                className="flex-1 bg-green-500 hover:bg-green-600 rounded-t transition-all cursor-pointer"
                style={{
                  height: `${(day.amount / maxDailyAmount) * 100}%`,
                  minHeight: day.amount > 0 ? '2px' : '0',
                }}
                title={`${new Date(day.date).toLocaleDateString()}: $${day.amount.toLocaleString()}`}
              />
            ))}
          </div>
        </div>

        {/* By Fund */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100 mb-4">By Fund</h3>
          <div className="space-y-2">
            {Object.entries(stats.byFund)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([fund, amount]) => {
                const percentage = (amount / stats.total) * 100;
                const colors = FUND_COLORS[fund] || FUND_COLORS.other;
                return (
                  <div key={fund}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600 dark:text-dark-300 capitalize">{fund}</span>
                      <span className="text-xs text-gray-500">${amount.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors.bg.includes('green') ? 'bg-green-500' : colors.bg.includes('blue') ? 'bg-blue-500' : colors.bg.includes('purple') ? 'bg-purple-500' : colors.bg.includes('amber') ? 'bg-amber-500' : 'bg-gray-500'} rounded-full`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4 mb-6">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, fund, or amount..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-800 rounded-lg p-1">
            {(['7d', '30d', '90d', '1y', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  dateRange === range
                    ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 shadow-sm'
                    : 'text-gray-600 dark:text-dark-400 hover:text-gray-900'
                }`}
              >
                {range === '7d' ? '7D' : range === '30d' ? '30D' : range === '90d' ? '90D' : range === '1y' ? '1Y' : 'All'}
              </button>
            ))}
          </div>

          {/* More Filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              showFilters
                ? 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400'
                : 'text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800'
            }`}
          >
            <Filter size={16} />
            Filters
            <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-dark-300"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700 grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">Fund</label>
              <select
                value={filters.fund || ''}
                onChange={(e) => setFilters({ ...filters, fund: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm"
              >
                <option value="">All Funds</option>
                <option value="tithe">Tithe</option>
                <option value="offering">Offering</option>
                <option value="missions">Missions</option>
                <option value="building">Building</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">Method</label>
              <select
                value={filters.method || ''}
                onChange={(e) => setFilters({ ...filters, method: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm"
              >
                <option value="">All Methods</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">Min Amount</label>
              <input
                type="number"
                placeholder="$0"
                value={filters.minAmount || ''}
                onChange={(e) => setFilters({ ...filters, minAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">Max Amount</label>
              <input
                type="number"
                placeholder="No limit"
                value={filters.maxAmount || ''}
                onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-lg text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Donations Table */}
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-dark-100">
            Donations ({filteredDonations.length})
          </h3>
        </div>

        {filteredDonations.length === 0 ? (
          <div className="text-center py-16">
            <DollarSign className="mx-auto text-gray-300 dark:text-dark-600 mb-3" size={48} />
            <p className="text-gray-500 dark:text-dark-400">No donations found</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-800">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase">
                    Date
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase">
                    Donor
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase">
                    Amount
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase">
                    Fund
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase">
                    Method
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 dark:text-dark-400 uppercase">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                {filteredDonations.slice(0, 50).map((donation) => {
                  const fundColors = FUND_COLORS[donation.fund] || FUND_COLORS.other;
                  return (
                    <tr key={donation.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900 dark:text-dark-100">
                          {new Date(donation.date).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {donation.personId ? (
                          <button
                            onClick={() => onViewPerson?.(donation.personId!)}
                            className="text-sm font-medium text-gray-900 dark:text-dark-100 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            {getPersonName(donation.personId)}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400 italic">Anonymous</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-gray-900 dark:text-dark-100">
                          ${donation.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${fundColors.bg} ${fundColors.text}`}>
                          {donation.fund}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-dark-300 capitalize">
                          {METHOD_ICONS[donation.method]}
                          {donation.method}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {donation.isRecurring ? (
                          <span className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                            <Repeat size={12} />
                            Recurring
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">One-time</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredDonations.length > 50 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-dark-700 text-center">
            <p className="text-sm text-gray-500 dark:text-dark-400">
              Showing 50 of {filteredDonations.length} donations. Export to see all.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
