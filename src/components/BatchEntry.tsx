import { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Lock,
  CheckCircle,
  DollarSign,
  Banknote,
  Building,
  FileText,
  Calendar,
  Search,
  X,
  ChevronDown,
  AlertCircle,
  Package,
} from 'lucide-react';
import type { Person, DonationBatch, BatchItem } from '../types';
import { GIVING_FUNDS } from '../lib/services/payments';

interface BatchEntryProps {
  people: Person[];
  batches: DonationBatch[];
  onCreateBatch: (batch: Omit<DonationBatch, 'id'>) => void;
  onAddItem: (item: Omit<BatchItem, 'id'>) => void;
  onRemoveItem: (itemId: string) => void;
  onCloseBatch: (batchId: string) => void;
  onBack?: () => void;
}

export function BatchEntry({
  people,
  batches,
  onCreateBatch,
  onAddItem,
  onRemoveItem,
  onCloseBatch,
  onBack,
}: BatchEntryProps) {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [showNewBatch, setShowNewBatch] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);

  // New batch form
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchName, setBatchName] = useState('');

  // New item form
  const [itemPersonId, setItemPersonId] = useState<string>('');
  const [itemAmount, setItemAmount] = useState('');
  const [itemMethod, setItemMethod] = useState<'cash' | 'check'>('cash');
  const [itemFund, setItemFund] = useState('tithe');
  const [itemCheckNumber, setItemCheckNumber] = useState('');
  const [itemMemo, setItemMemo] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const openBatches = batches.filter((b) => b.status === 'open');
  const closedBatches = batches.filter((b) => b.status !== 'open');

  const filteredPeople = useMemo(() => {
    if (!personSearch) return people.slice(0, 10);
    const search = personSearch.toLowerCase();
    return people.filter(
      (p) =>
        p.firstName.toLowerCase().includes(search) ||
        p.lastName.toLowerCase().includes(search) ||
        p.email.toLowerCase().includes(search)
    ).slice(0, 10);
  }, [people, personSearch]);

  const handleCreateBatch = () => {
    const name = batchName || `Collection - ${new Date(batchDate).toLocaleDateString()}`;
    onCreateBatch({
      batchDate,
      batchName: name,
      status: 'open',
      totalCash: 0,
      totalChecks: 0,
      totalAmount: 0,
      checkCount: 0,
    });
    setShowNewBatch(false);
    setBatchName('');
  };

  const handleAddItem = () => {
    if (!selectedBatchId || !itemAmount) return;

    onAddItem({
      batchId: selectedBatchId,
      personId: itemPersonId || undefined,
      amount: parseFloat(itemAmount),
      method: itemMethod,
      fund: itemFund,
      checkNumber: itemMethod === 'check' ? itemCheckNumber : undefined,
      memo: itemMemo || undefined,
    });

    // Reset form
    setItemPersonId('');
    setItemAmount('');
    setItemCheckNumber('');
    setItemMemo('');
    setPersonSearch('');
    setShowAddItem(false);
  };

  const handleSelectPerson = (person: Person) => {
    setItemPersonId(person.id);
    setPersonSearch(`${person.firstName} ${person.lastName}`);
    setShowPersonDropdown(false);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Batch Entry</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            Enter cash and check donations from services
          </p>
        </div>
        <div className="flex gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
            >
              Back to Giving
            </button>
          )}
          <button
            onClick={() => setShowNewBatch(true)}
            className="px-4 py-2.5 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            New Batch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Batch List */}
        <div className="lg:col-span-1 space-y-4">
          {/* Open Batches */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-3 flex items-center gap-2">
              <Package className="text-green-500" size={18} />
              Open Batches
            </h3>
            {openBatches.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-dark-400 text-center py-4">
                No open batches. Create one to start entering donations.
              </p>
            ) : (
              <div className="space-y-2">
                {openBatches.map((batch) => (
                  <button
                    key={batch.id}
                    onClick={() => setSelectedBatchId(batch.id)}
                    className={`w-full p-3 rounded-xl text-left transition-all ${
                      selectedBatchId === batch.id
                        ? 'bg-green-50 dark:bg-green-500/10 border-2 border-green-500'
                        : 'bg-gray-50 dark:bg-dark-800 border-2 border-transparent hover:border-gray-200 dark:hover:border-dark-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 dark:text-dark-100 text-sm truncate">
                        {batch.batchName}
                      </span>
                      <span className="text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                        Open
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-400">
                      <span>{new Date(batch.batchDate).toLocaleDateString()}</span>
                      <span className="font-semibold text-gray-900 dark:text-dark-100">
                        ${batch.totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Closed Batches */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-3 flex items-center gap-2">
              <Lock className="text-gray-400" size={18} />
              Recent Closed
            </h3>
            {closedBatches.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-dark-400 text-center py-4">
                No closed batches yet.
              </p>
            ) : (
              <div className="space-y-2">
                {closedBatches.slice(0, 5).map((batch) => (
                  <div
                    key={batch.id}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-dark-800"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-700 dark:text-dark-300 text-sm truncate">
                        {batch.batchName}
                      </span>
                      <CheckCircle className="text-gray-400" size={14} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-400">
                      <span>{new Date(batch.batchDate).toLocaleDateString()}</span>
                      <span className="font-semibold">${batch.totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Batch Details & Entry */}
        <div className="lg:col-span-2">
          {selectedBatch ? (
            <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden">
              {/* Batch Header */}
              <div className="p-6 border-b border-gray-200 dark:border-dark-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                      {selectedBatch.batchName}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-dark-400 flex items-center gap-2">
                      <Calendar size={14} />
                      {new Date(selectedBatch.batchDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddItem(true)}
                      className="px-4 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Add Item
                    </button>
                    <button
                      onClick={() => onCloseBatch(selectedBatch.id)}
                      className="px-4 py-2 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors flex items-center gap-2"
                    >
                      <Lock size={16} />
                      Close Batch
                    </button>
                  </div>
                </div>

                {/* Batch Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-500/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                      <Banknote size={16} />
                      <span className="text-sm font-medium">Cash</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-dark-100">
                      ${selectedBatch.totalCash.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                      <Building size={16} />
                      <span className="text-sm font-medium">Checks ({selectedBatch.checkCount})</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-dark-100">
                      ${selectedBatch.totalChecks.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                      <DollarSign size={16} />
                      <span className="text-sm font-medium">Total</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-dark-100">
                      ${selectedBatch.totalAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-4">
                  Donations ({selectedBatch.items?.length || 0})
                </h3>
                {!selectedBatch.items || selectedBatch.items.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="mx-auto text-gray-300 dark:text-dark-600 mb-4" size={48} />
                    <p className="text-gray-500 dark:text-dark-400">
                      No donations added yet. Click "Add Item" to start.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedBatch.items.map((item) => {
                      const person = people.find((p) => p.id === item.personId);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-800 rounded-xl"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                item.method === 'cash'
                                  ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                                  : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {item.method === 'cash' ? <Banknote size={18} /> : <Building size={18} />}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-dark-100">
                                {person ? `${person.firstName} ${person.lastName}` : 'Anonymous'}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-400">
                                <span className="capitalize">{item.method}</span>
                                {item.checkNumber && <span>#{item.checkNumber}</span>}
                                <span>•</span>
                                <span className="capitalize">{item.fund}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-gray-900 dark:text-dark-100">
                              ${item.amount.toLocaleString()}
                            </span>
                            <button
                              onClick={() => onRemoveItem(item.id)}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-12 text-center">
              <Package className="mx-auto text-gray-300 dark:text-dark-600 mb-4" size={64} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-2">
                No Batch Selected
              </h3>
              <p className="text-gray-500 dark:text-dark-400 mb-6">
                Select an open batch from the list or create a new one to start entering donations.
              </p>
              <button
                onClick={() => setShowNewBatch(true)}
                className="px-6 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors inline-flex items-center gap-2"
              >
                <Plus size={18} />
                Create New Batch
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Batch Modal */}
      {showNewBatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Create New Batch
              </h3>
              <button
                onClick={() => setShowNewBatch(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Batch Date
                </label>
                <input
                  type="date"
                  value={batchDate}
                  onChange={(e) => setBatchDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Batch Name (optional)
                </label>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g., Sunday Morning Service"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewBatch(false)}
                className="flex-1 py-3 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBatch}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 flex items-center justify-center gap-2"
              >
                <Save size={18} />
                Create Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItem && selectedBatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Add Donation
              </h3>
              <button
                onClick={() => setShowAddItem(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Person Search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Donor (optional)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={personSearch}
                    onChange={(e) => {
                      setPersonSearch(e.target.value);
                      setShowPersonDropdown(true);
                      if (!e.target.value) setItemPersonId('');
                    }}
                    onFocus={() => setShowPersonDropdown(true)}
                    placeholder="Search by name..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                  />
                </div>
                {showPersonDropdown && personSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredPeople.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 dark:text-dark-400 text-center">
                        No matching people found
                      </div>
                    ) : (
                      filteredPeople.map((person) => (
                        <button
                          key={person.id}
                          onClick={() => handleSelectPerson(person)}
                          className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-3"
                        >
                          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                            {person.firstName[0]}{person.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-dark-100 text-sm">
                              {person.firstName} {person.lastName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-dark-400">{person.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Amount *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="number"
                    value={itemAmount}
                    onChange={(e) => setItemAmount(e.target.value)}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                  />
                </div>
              </div>

              {/* Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setItemMethod('cash')}
                    className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition-all ${
                      itemMethod === 'cash'
                        ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                        : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-dark-400'
                    }`}
                  >
                    <Banknote size={18} />
                    Cash
                  </button>
                  <button
                    onClick={() => setItemMethod('check')}
                    className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition-all ${
                      itemMethod === 'check'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                        : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-dark-400'
                    }`}
                  >
                    <Building size={18} />
                    Check
                  </button>
                </div>
              </div>

              {/* Check Number (if check) */}
              {itemMethod === 'check' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    Check Number
                  </label>
                  <input
                    type="text"
                    value={itemCheckNumber}
                    onChange={(e) => setItemCheckNumber(e.target.value)}
                    placeholder="e.g., 1234"
                    className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                  />
                </div>
              )}

              {/* Fund */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Fund
                </label>
                <div className="relative">
                  <select
                    value={itemFund}
                    onChange={(e) => setItemFund(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 appearance-none"
                  >
                    {GIVING_FUNDS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                </div>
              </div>

              {/* Memo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Memo (optional)
                </label>
                <input
                  type="text"
                  value={itemMemo}
                  onChange={(e) => setItemMemo(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
              </div>
            </div>

            {!itemAmount && (
              <div className="flex items-center gap-2 mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-xl text-sm">
                <AlertCircle size={16} />
                Please enter an amount
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddItem(false)}
                className="flex-1 py-3 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={!itemAmount}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Add Donation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
