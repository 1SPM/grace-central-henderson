/**
 * Gift-in-kind (donated goods) ledger panel — balance per category plus
 * a small form to log a contribution or distribution.
 */
import { useState } from 'react';
import { Package, Lock } from 'lucide-react';
import { useGiftInKind } from '../../hooks/useGiftInKind';

const CATEGORIES = ['food', 'clothing', 'toys', 'household', 'other'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food', clothing: 'Clothing', toys: 'Toys', household: 'Household', other: 'Other',
};

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function GiftInKindPanel() {
  const { balances, isLoading, error, forbidden, record } = useGiftInKind();
  const [category, setCategory] = useState<string>('food');
  const [transactionType, setTransactionType] = useState<'contribution' | 'distribution'>('contribution');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (forbidden) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4 sm:p-6 mt-4 text-sm text-gray-500 dark:text-dark-400 flex items-center gap-2">
        <Lock size={14} /> Gift-in-kind ledger requires finance.gift_in_kind.view.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const estimatedValue = value ? Number(value) : undefined;
    if (value && (Number.isNaN(estimatedValue) || (estimatedValue ?? 0) < 0)) {
      setSubmitError('Estimated value must be a non-negative number.');
      return;
    }
    setSubmitting(true);
    try {
      await record({ category, transaction_type: transactionType, estimated_value: estimatedValue, description: description || undefined });
      setValue('');
      setDescription('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not record the transaction.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4 sm:p-6 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Package size={16} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Gift-in-kind ledger</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-dark-400 mb-3">Donated food, clothing, toys, and household goods — balance is contributions minus distributions, valued at estimated fair market value.</p>

      {error && <p className="text-sm text-brand-600 dark:text-brand-400 mb-3">{error}</p>}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-dark-800 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {CATEGORIES.map(c => (
            <div key={c} className="rounded-lg border border-gray-200 dark:border-dark-700 p-2">
              <p className="text-xs text-gray-500 dark:text-dark-400">{CATEGORY_LABELS[c]}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">{formatUsd(balances[c] ?? 0)}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={e => void handleSubmit(e)} className="flex flex-wrap items-end gap-2">
        <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-2 py-1.5 text-xs text-gray-700 dark:text-dark-200">
          {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select value={transactionType} onChange={e => setTransactionType(e.target.value as 'contribution' | 'distribution')} className="rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-2 py-1.5 text-xs text-gray-700 dark:text-dark-200">
          <option value="contribution">Contribution</option>
          <option value="distribution">Distribution</option>
        </select>
        <input
          type="number" min="0" step="1" placeholder="Estimated value ($)"
          value={value} onChange={e => setValue(e.target.value)}
          className="w-36 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-2 py-1.5 text-xs text-gray-700 dark:text-dark-200"
        />
        <input
          type="text" placeholder="Description (optional)"
          value={description} onChange={e => setDescription(e.target.value)}
          className="flex-1 min-w-[10rem] rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-2 py-1.5 text-xs text-gray-700 dark:text-dark-200"
        />
        <button type="submit" disabled={submitting} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-50">
          {submitting ? 'Recording…' : 'Record'}
        </button>
      </form>
      {submitError && <p className="text-xs text-brand-600 dark:text-brand-400 mt-2">{submitError}</p>}
    </div>
  );
}
