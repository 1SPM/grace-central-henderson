import { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Gift,
  ShoppingBasket,
  Calendar,
  Check,
  X,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Heart,
  Home,
  Baby,
  BookOpen,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import type { CharityBasket, BasketItem, Person, BasketType, BasketStatus, ItemCategory } from '../types';

interface CharityBasketsProps {
  baskets: CharityBasket[];
  people: Person[];
  onCreateBasket: (basket: Omit<CharityBasket, 'id' | 'createdAt' | 'items' | 'totalValue'>) => void;
  onUpdateBasket: (id: string, updates: Partial<CharityBasket>) => void;
  onDeleteBasket: (id: string) => void;
  onAddItem: (basketId: string, item: Omit<BasketItem, 'id' | 'basketId' | 'donatedAt'>) => void;
  onRemoveItem: (basketId: string, itemId: string) => void;
  onDistributeBasket: (basketId: string) => void;
  onBack?: () => void;
}

const BASKET_TYPES: { value: BasketType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'food', label: 'Food Pantry', icon: <ShoppingBasket size={16} />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400' },
  { value: 'holiday', label: 'Holiday', icon: <Gift size={16} />, color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
  { value: 'emergency', label: 'Emergency', icon: <AlertCircle size={16} />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  { value: 'school', label: 'School Supplies', icon: <BookOpen size={16} />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' },
  { value: 'baby', label: 'Baby Care', icon: <Baby size={16} />, color: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400' },
  { value: 'household', label: 'Household', icon: <Home size={16} />, color: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400' },
  { value: 'other', label: 'Other', icon: <Sparkles size={16} />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400' },
];

const ITEM_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'hygiene', label: 'Hygiene' },
  { value: 'household', label: 'Household' },
  { value: 'school', label: 'School' },
  { value: 'baby', label: 'Baby' },
  { value: 'gift', label: 'Gift' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG: Record<BasketStatus, { label: string; color: string; icon: React.ReactNode }> = {
  collecting: { label: 'Collecting', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400', icon: <Clock size={14} /> },
  ready: { label: 'Ready', color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400', icon: <CheckCircle2 size={14} /> },
  distributed: { label: 'Distributed', color: 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400', icon: <Check size={14} /> },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400', icon: <X size={14} /> },
};

export function CharityBaskets({
  baskets,
  people,
  onCreateBasket,
  onUpdateBasket,
  onAddItem,
  onRemoveItem,
  onDistributeBasket,
  onBack,
}: CharityBasketsProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<BasketType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<BasketStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBasket, setSelectedBasket] = useState<CharityBasket | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  // New basket form state
  const [newBasket, setNewBasket] = useState<{
    name: string;
    type: BasketType;
    description: string;
    recipientId: string;
    recipientName: string;
    targetDate: string;
    notes: string;
  }>({
    name: '',
    type: 'food',
    description: '',
    recipientId: '',
    recipientName: '',
    targetDate: '',
    notes: '',
  });

  // New item form state
  const [newItem, setNewItem] = useState<{
    name: string;
    category: ItemCategory;
    quantity: number;
    unit: string;
    estimatedValue: string;
    donorId: string;
    donorName: string;
    notes: string;
  }>({
    name: '',
    category: 'food',
    quantity: 1,
    unit: 'items',
    estimatedValue: '',
    donorId: '',
    donorName: '',
    notes: '',
  });

  // Filter baskets
  const filteredBaskets = useMemo(() => {
    return baskets.filter((basket) => {
      const matchesSearch =
        basket.name.toLowerCase().includes(search.toLowerCase()) ||
        basket.recipientName?.toLowerCase().includes(search.toLowerCase()) ||
        basket.description?.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'all' || basket.type === filterType;
      const matchesStatus = filterStatus === 'all' || basket.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [baskets, search, filterType, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const collecting = baskets.filter((b) => b.status === 'collecting').length;
    const ready = baskets.filter((b) => b.status === 'ready').length;
    const distributed = baskets.filter((b) => b.status === 'distributed').length;
    const totalValue = baskets.reduce((sum, b) => sum + b.totalValue, 0);
    const totalItems = baskets.reduce((sum, b) => sum + b.items.length, 0);
    return { collecting, ready, distributed, totalValue, totalItems };
  }, [baskets]);

  const handleCreateBasket = () => {
    if (!newBasket.name.trim()) return;

    onCreateBasket({
      name: newBasket.name,
      type: newBasket.type,
      description: newBasket.description || undefined,
      recipientId: newBasket.recipientId || undefined,
      recipientName: newBasket.recipientName || undefined,
      targetDate: newBasket.targetDate || undefined,
      notes: newBasket.notes || undefined,
      status: 'collecting',
      createdBy: 'Current User',
    });

    setNewBasket({
      name: '',
      type: 'food',
      description: '',
      recipientId: '',
      recipientName: '',
      targetDate: '',
      notes: '',
    });
    setShowCreateModal(false);
  };

  const handleAddItem = () => {
    if (!selectedBasket || !newItem.name.trim()) return;

    onAddItem(selectedBasket.id, {
      name: newItem.name,
      category: newItem.category,
      quantity: newItem.quantity,
      unit: newItem.unit || undefined,
      estimatedValue: newItem.estimatedValue ? parseFloat(newItem.estimatedValue) : undefined,
      donorId: newItem.donorId || undefined,
      donorName: newItem.donorName || undefined,
      notes: newItem.notes || undefined,
    });

    setNewItem({
      name: '',
      category: 'food',
      quantity: 1,
      unit: 'items',
      estimatedValue: '',
      donorId: '',
      donorName: '',
      notes: '',
    });
    setShowAddItemModal(false);
  };

  const getRecipientName = (basket: CharityBasket) => {
    if (basket.recipientId) {
      const person = people.find((p) => p.id === basket.recipientId);
      return person ? `${person.firstName} ${person.lastName}` : 'Unknown';
    }
    return basket.recipientName || 'Unassigned';
  };

  const getBasketTypeConfig = (type: BasketType) => {
    return BASKET_TYPES.find((t) => t.value === type) || BASKET_TYPES[6];
  };

  // Basket detail view
  if (selectedBasket) {
    const typeConfig = getBasketTypeConfig(selectedBasket.type);
    const statusConfig = STATUS_CONFIG[selectedBasket.status];

    return (
      <div className="p-8">
        <button
          onClick={() => setSelectedBasket(null)}
          className="inline-flex items-center gap-2 text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200 mb-6"
        >
          <ArrowLeft size={18} />
          Back to Baskets
        </button>

        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${typeConfig.color}`}>
                {typeConfig.icon}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">{selectedBasket.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                    {statusConfig.icon}
                    {statusConfig.label}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeConfig.color}`}>
                    {typeConfig.label}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedBasket.status === 'collecting' && (
                <button
                  onClick={() => onUpdateBasket(selectedBasket.id, { status: 'ready' })}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  Mark Ready
                </button>
              )}
              {selectedBasket.status === 'ready' && (
                <button
                  onClick={() => onDistributeBasket(selectedBasket.id)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Distribute
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-dark-400">Recipient</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-dark-100 mt-1">
                {getRecipientName(selectedBasket)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-dark-400">Items</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-dark-100 mt-1">
                {selectedBasket.items.length}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-dark-400">Total Value</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-dark-100 mt-1">
                ${selectedBasket.totalValue.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-dark-400">Target Date</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-dark-100 mt-1">
                {selectedBasket.targetDate
                  ? new Date(selectedBasket.targetDate).toLocaleDateString()
                  : 'Not set'}
              </p>
            </div>
          </div>

          {selectedBasket.description && (
            <p className="text-gray-600 dark:text-dark-300 mb-4">{selectedBasket.description}</p>
          )}
        </div>

        {/* Items List */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Basket Items</h2>
            {selectedBasket.status === 'collecting' && (
              <button
                onClick={() => setShowAddItemModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <Plus size={16} />
                Add Item
              </button>
            )}
          </div>

          {selectedBasket.items.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto text-gray-300 dark:text-dark-600 mb-3" size={48} />
              <p className="text-gray-500 dark:text-dark-400">No items in this basket yet</p>
              {selectedBasket.status === 'collecting' && (
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="mt-3 text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:text-indigo-700"
                >
                  Add the first item
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {selectedBasket.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-800 rounded-xl"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium text-gray-900 dark:text-dark-100">{item.name}</p>
                      <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-dark-700 text-gray-600 dark:text-dark-300 rounded">
                        {item.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-dark-400">
                      <span>Qty: {item.quantity} {item.unit}</span>
                      {item.estimatedValue && <span>Value: ${item.estimatedValue}</span>}
                      {(item.donorId || item.donorName) && (
                        <span>
                          Donated by:{' '}
                          {item.donorId
                            ? people.find((p) => p.id === item.donorId)?.firstName || 'Member'
                            : item.donorName}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedBasket.status === 'collecting' && (
                    <button
                      onClick={() => onRemoveItem(selectedBasket.id, item.id)}
                      className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Item Modal */}
        {showAddItemModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-lg">
              <div className="p-6 border-b border-gray-200 dark:border-dark-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Add Item</h2>
                  <button
                    onClick={() => setShowAddItemModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="e.g., Canned vegetables"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Category
                    </label>
                    <select
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value as ItemCategory })}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {ITEM_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                      placeholder="e.g., cans, boxes"
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Est. Value ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newItem.estimatedValue}
                      onChange={(e) => setNewItem({ ...newItem, estimatedValue: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    Donated By
                  </label>
                  <select
                    value={newItem.donorId}
                    onChange={(e) => setNewItem({ ...newItem, donorId: e.target.value, donorName: '' })}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select member or enter name below</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.firstName} {person.lastName}
                      </option>
                    ))}
                  </select>
                  {!newItem.donorId && (
                    <input
                      type="text"
                      value={newItem.donorName}
                      onChange={(e) => setNewItem({ ...newItem, donorName: e.target.value })}
                      placeholder="Or enter donor name"
                      className="w-full mt-2 px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={!newItem.name.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>
        )}
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Charity Baskets</h1>
            <p className="text-gray-500 dark:text-dark-400 mt-1">
              Create and manage care baskets for families in need
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
        >
          <Plus size={18} />
          New Basket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4">
          <Clock className="text-blue-600 dark:text-blue-400 mb-2" size={20} />
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{stats.collecting}</p>
          <p className="text-sm text-gray-600 dark:text-dark-300">Collecting</p>
        </div>
        <div className="bg-green-50 dark:bg-green-500/10 rounded-xl p-4">
          <CheckCircle2 className="text-green-600 dark:text-green-400 mb-2" size={20} />
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{stats.ready}</p>
          <p className="text-sm text-gray-600 dark:text-dark-300">Ready</p>
        </div>
        <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
          <Heart className="text-gray-500 dark:text-dark-400 mb-2" size={20} />
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{stats.distributed}</p>
          <p className="text-sm text-gray-600 dark:text-dark-300">Distributed</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-4">
          <Package className="text-purple-600 dark:text-purple-400 mb-2" size={20} />
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{stats.totalItems}</p>
          <p className="text-sm text-gray-600 dark:text-dark-300">Total Items</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4">
          <Gift className="text-amber-600 dark:text-amber-400 mb-2" size={20} />
          <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">${stats.totalValue.toLocaleString()}</p>
          <p className="text-sm text-gray-600 dark:text-dark-300">Total Value</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search baskets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as BasketType | 'all')}
          className="px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Types</option>
          {BASKET_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as BasketStatus | 'all')}
          className="px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Status</option>
          <option value="collecting">Collecting</option>
          <option value="ready">Ready</option>
          <option value="distributed">Distributed</option>
        </select>
      </div>

      {/* Baskets Grid */}
      {filteredBaskets.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700">
          <ShoppingBasket className="mx-auto text-gray-300 dark:text-dark-600 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100 mb-2">No baskets found</h3>
          <p className="text-gray-500 dark:text-dark-400 mb-4">
            {search || filterType !== 'all' || filterStatus !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first charity basket to get started'}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus size={16} />
            Create Basket
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBaskets.map((basket) => {
            const typeConfig = getBasketTypeConfig(basket.type);
            const statusConfig = STATUS_CONFIG[basket.status];

            return (
              <button
                key={basket.id}
                onClick={() => setSelectedBasket(basket)}
                className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 text-left hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeConfig.color}`}>
                    {typeConfig.icon}
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                    {statusConfig.icon}
                    {statusConfig.label}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-dark-100 mb-1">{basket.name}</h3>
                <p className="text-sm text-gray-500 dark:text-dark-400 mb-4">
                  For: {getRecipientName(basket)}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-dark-400">
                    {basket.items.length} items
                  </span>
                  <span className="font-medium text-gray-900 dark:text-dark-100">
                    ${basket.totalValue.toLocaleString()}
                  </span>
                </div>
                {basket.targetDate && (
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500 dark:text-dark-400">
                    <Calendar size={12} />
                    Target: {new Date(basket.targetDate).toLocaleDateString()}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Create Basket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Create Charity Basket</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Basket Name *
                </label>
                <input
                  type="text"
                  value={newBasket.name}
                  onChange={(e) => setNewBasket({ ...newBasket, name: e.target.value })}
                  placeholder="e.g., Smith Family Holiday Basket"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Basket Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {BASKET_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setNewBasket({ ...newBasket, type: type.value })}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors ${
                        newBasket.type === type.value
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                          : 'border-gray-200 dark:border-dark-700 hover:border-gray-300'
                      }`}
                    >
                      <span className={type.color.split(' ')[0] + ' p-1.5 rounded-lg'}>
                        {type.icon}
                      </span>
                      <span className="text-xs font-medium text-gray-700 dark:text-dark-300">
                        {type.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newBasket.description}
                  onChange={(e) => setNewBasket({ ...newBasket, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Recipient
                </label>
                <select
                  value={newBasket.recipientId}
                  onChange={(e) => setNewBasket({ ...newBasket, recipientId: e.target.value, recipientName: '' })}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select member or enter name below</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.firstName} {person.lastName}
                    </option>
                  ))}
                </select>
                {!newBasket.recipientId && (
                  <input
                    type="text"
                    value={newBasket.recipientName}
                    onChange={(e) => setNewBasket({ ...newBasket, recipientName: e.target.value })}
                    placeholder="Or enter recipient name (for external recipients)"
                    className="w-full mt-2 px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  value={newBasket.targetDate}
                  onChange={(e) => setNewBasket({ ...newBasket, targetDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={newBasket.notes}
                  onChange={(e) => setNewBasket({ ...newBasket, notes: e.target.value })}
                  placeholder="Any special instructions or notes..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBasket}
                disabled={!newBasket.name.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Create Basket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
