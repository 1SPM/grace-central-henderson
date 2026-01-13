import { useState, useMemo } from 'react';
import {
  X,
  DollarSign,
  Search,
  Banknote,
  Building,
  CreditCard,
  TrendingUp,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import type { Person, Giving } from '../types';
import { GIVING_FUNDS } from '../lib/services/payments';

interface QuickDonationFormProps {
  people: Person[];
  onSave: (donation: Omit<Giving, 'id'>) => void;
  onClose: () => void;
  defaultPersonId?: string;
}

export function QuickDonationForm({
  people,
  onSave,
  onClose,
  defaultPersonId,
}: QuickDonationFormProps) {
  const [personId, setPersonId] = useState(defaultPersonId || '');
  const [personSearch, setPersonSearch] = useState(() => {
    if (defaultPersonId) {
      const person = people.find((p) => p.id === defaultPersonId);
      return person ? `${person.firstName} ${person.lastName}` : '';
    }
    return '';
  });
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [amount, setAmount] = useState('');
  const [fund, setFund] = useState('tithe');
  const [method, setMethod] = useState<'cash' | 'check' | 'card' | 'online'>('cash');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkNumber, setCheckNumber] = useState('');
  const [note, setNote] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const filteredPeople = useMemo(() => {
    if (!personSearch) return people.slice(0, 8);
    const search = personSearch.toLowerCase();
    return people
      .filter(
        (p) =>
          p.firstName.toLowerCase().includes(search) ||
          p.lastName.toLowerCase().includes(search) ||
          p.email.toLowerCase().includes(search)
      )
      .slice(0, 8);
  }, [people, personSearch]);

  const handleSelectPerson = (person: Person) => {
    setPersonId(person.id);
    setPersonSearch(`${person.firstName} ${person.lastName}`);
    setShowPersonDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) return;

    onSave({
      personId: personId || '',
      amount: parseFloat(amount),
      fund: fund as Giving['fund'],
      method,
      date,
      isRecurring,
      note: note || undefined,
    });

    onClose();
  };

  const methodOptions = [
    { id: 'cash', label: 'Cash', icon: <Banknote size={16} /> },
    { id: 'check', label: 'Check', icon: <Building size={16} /> },
    { id: 'card', label: 'Card', icon: <CreditCard size={16} /> },
    { id: 'online', label: 'Online', icon: <TrendingUp size={16} /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600 dark:text-green-400" size={18} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
              Quick Donation
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Person Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Donor
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={personSearch}
                onChange={(e) => {
                  setPersonSearch(e.target.value);
                  setShowPersonDropdown(true);
                  if (!e.target.value) setPersonId('');
                }}
                onFocus={() => setShowPersonDropdown(true)}
                placeholder="Search by name (optional)..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm"
              />
            </div>
            {showPersonDropdown && personSearch && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredPeople.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500 dark:text-dark-400 text-center">
                    No matching people
                  </div>
                ) : (
                  filteredPeople.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleSelectPerson(person)}
                      className="w-full p-2 text-left hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-2"
                    >
                      <div className="w-7 h-7 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {person.firstName[0]}{person.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-dark-100 text-sm">
                          {person.firstName} {person.lastName}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Amount and Date Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                Amount *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  required
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Method
            </label>
            <div className="grid grid-cols-4 gap-2">
              {methodOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMethod(opt.id as typeof method)}
                  className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 text-xs font-medium transition-all ${
                    method === opt.id
                      ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                      : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-dark-400'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Check Number (if check) */}
          {method === 'check' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                Check Number
              </label>
              <input
                type="text"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="e.g., 1234"
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm"
              />
            </div>
          )}

          {/* Fund Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Fund
            </label>
            <div className="relative">
              <select
                value={fund}
                onChange={(e) => setFund(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm appearance-none"
              >
                {GIVING_FUNDS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note..."
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm"
            />
          </div>

          {/* Recurring Toggle */}
          <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
            />
            <span className="text-sm text-gray-700 dark:text-dark-300">
              Mark as recurring donation
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!amount || parseFloat(amount) <= 0}
              className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Save Donation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
