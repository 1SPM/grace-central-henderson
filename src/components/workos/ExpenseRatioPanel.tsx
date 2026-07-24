/**
 * Program vs. general & administrative expense ratio panel — a standard
 * nonprofit transparency metric — plus a small form to log an expense.
 */
import { useState } from 'react';
import { PieChart, Lock } from 'lucide-react';
import { useExpenses } from '../../hooks/useExpenses';

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function ExpenseRatioPanel() {
  const { ratio, isLoading, error, forbidden, record } = useExpenses();
  const [functionalCategory, setFunctionalCategory] = useState<'program' | 'g_and_a'>('program');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (forbidden) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4 sm:p-6 mt-4 text-sm text-gray-500 dark:text-dark-400 flex items-center gap-2">
        <Lock size={14} /> Expense tracking requires finance.expenses.view.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const amountNum = Number(amount);
    if (!category.trim() || !amount || Number.isNaN(amountNum) || amountNum <= 0) {
      setSubmitError('Category and a positive amount are required.');
      return;
    }
    setSubmitting(true);
    try {
      await record({ functional_category: functionalCategory, category: category.trim(), amount: amountNum });
      setCategory('');
      setAmount('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not record the expense.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4 sm:p-6 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <PieChart size={16} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Program vs. G&A expense ratio</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-dark-400 mb-3">The share of recorded expenses directly attributable to ministry programs, vs. general &amp; administrative overhead.</p>

      {error && <p className="text-sm text-brand-600 dark:text-brand-400 mb-3">{error}</p>}

      {isLoading || !ratio ? (
        <div className="h-16 rounded-lg bg-gray-100 dark:bg-dark-800 animate-pulse mb-4" />
      ) : (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg border border-gray-200 dark:border-dark-700 p-2">
            <p className="text-xs text-gray-500 dark:text-dark-400">Program</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">{formatUsd(ratio.program_total)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-dark-700 p-2">
            <p className="text-xs text-gray-500 dark:text-dark-400">G&amp;A</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">{formatUsd(ratio.g_and_a_total)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-dark-700 p-2">
            <p className="text-xs text-gray-500 dark:text-dark-400">Program ratio</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">
              {ratio.program_ratio === null ? 'Not yet computed' : `${(ratio.program_ratio * 100).toFixed(0)}%`}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={e => void handleSubmit(e)} className="flex flex-wrap items-end gap-2">
        <select value={functionalCategory} onChange={e => setFunctionalCategory(e.target.value as 'program' | 'g_and_a')} className="rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-2 py-1.5 text-xs text-gray-700 dark:text-dark-200">
          <option value="program">Program</option>
          <option value="g_and_a">G&amp;A</option>
        </select>
        <input
          type="text" placeholder="Category (e.g. Facilities)"
          value={category} onChange={e => setCategory(e.target.value)}
          className="flex-1 min-w-[10rem] rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-2 py-1.5 text-xs text-gray-700 dark:text-dark-200"
        />
        <input
          type="number" min="0.01" step="0.01" placeholder="Amount ($)"
          value={amount} onChange={e => setAmount(e.target.value)}
          className="w-32 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-2 py-1.5 text-xs text-gray-700 dark:text-dark-200"
        />
        <button type="submit" disabled={submitting} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">
          {submitting ? 'Recording…' : 'Record'}
        </button>
      </form>
      {submitError && <p className="text-xs text-brand-600 dark:text-brand-400 mt-2">{submitError}</p>}
    </div>
  );
}
