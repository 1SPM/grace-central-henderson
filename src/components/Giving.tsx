import { DollarSign, TrendingUp, Repeat, CreditCard, Banknote, Building, Download } from 'lucide-react';
import type { ReactNode } from 'react';
import { Giving as GivingType, Person } from '../types';
import { exportGivingToCSV } from '../utils/csvExport';

interface GivingProps {
  giving: GivingType[];
  people: Person[];
}

const fundColors: Record<string, string> = {
  tithe: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400',
  offering: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
  missions: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400',
  building: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  other: 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300'
};

const methodIcons: Record<string, ReactNode> = {
  cash: <Banknote size={14} />,
  check: <Building size={14} />,
  card: <CreditCard size={14} />,
  online: <TrendingUp size={14} />
};

export function Giving({ giving, people }: GivingProps) {
  const totalThisMonth = giving.reduce((sum, g) => sum + g.amount, 0);
  const byFund = giving.reduce((acc, g) => {
    acc[g.fund] = (acc[g.fund] || 0) + g.amount;
    return acc;
  }, {} as Record<string, number>);

  const recurringCount = giving.filter(g => g.isRecurring).length;
  const recurringTotal = giving.filter(g => g.isRecurring).reduce((sum, g) => sum + g.amount, 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Giving</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">Track generosity and stewardship</p>
        </div>
        <button
          onClick={() => exportGivingToCSV(giving, people)}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
        >
          <Download size={18} />
          Export
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
          <DollarSign className="mb-4 opacity-80" size={24} />
          <p className="text-3xl font-bold">${totalThisMonth.toLocaleString()}</p>
          <p className="text-sm opacity-80 mt-1">Total This Period</p>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/10 rounded-xl flex items-center justify-center mb-4">
            <Repeat className="text-purple-600 dark:text-purple-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">{recurringCount}</p>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">Recurring Gifts</p>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/10 rounded-xl flex items-center justify-center mb-4">
            <TrendingUp className="text-blue-600 dark:text-blue-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">${recurringTotal.toLocaleString()}</p>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">Monthly Recurring</p>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/10 rounded-xl flex items-center justify-center mb-4">
            <DollarSign className="text-amber-600 dark:text-amber-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">{giving.length}</p>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">Total Transactions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Fund */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">By Fund</h2>
          <div className="space-y-3">
            {Object.entries(byFund).map(([fund, amount]) => (
              <div key={fund} className="flex items-center justify-between">
                <span className={`text-sm px-3 py-1 rounded-full ${fundColors[fund]}`}>
                  {fund.charAt(0).toUpperCase() + fund.slice(1)}
                </span>
                <span className="font-semibold text-gray-900 dark:text-dark-100">${amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">Recent Transactions</h2>
          <div className="space-y-3">
            {giving.slice(0, 8).map((gift) => {
              const person = people.find(p => p.id === gift.personId);
              return (
                <div key={gift.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-dark-700 last:border-0">
                  <div className="flex items-center gap-3">
                    {person && (
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {person.firstName[0]}{person.lastName[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-dark-100 text-sm">
                        {person ? `${person.firstName} ${person.lastName}` : 'Anonymous'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-dark-400">
                        {methodIcons[gift.method]}
                        <span>{gift.method}</span>
                        {gift.isRecurring && (
                          <span className="flex items-center gap-1 text-purple-500 dark:text-purple-400">
                            <Repeat size={10} />
                            recurring
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-dark-100">${gift.amount.toLocaleString()}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${fundColors[gift.fund]}`}>
                      {gift.fund}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
