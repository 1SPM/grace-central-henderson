import { useState, useEffect } from 'react';
import { Bookmark, Plus, Check, Trash2 } from 'lucide-react';
import { MemberStatus } from '../types';

export interface SavedFilter {
  id: string;
  name: string;
  filters: {
    status?: MemberStatus | 'all';
    tag?: string;
    hasEmail?: boolean | null;
    hasPhone?: boolean | null;
    search?: string;
  };
  createdAt: string;
}

interface SavedFiltersProps {
  currentFilters: SavedFilter['filters'];
  onApplyFilter: (filters: SavedFilter['filters']) => void;
}

const STORAGE_KEY = 'grace-crm-saved-filters';

export function SavedFilters({ currentFilters, onApplyFilter }: SavedFiltersProps) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Load saved filters from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSavedFilters(JSON.parse(stored));
      } catch {
        setSavedFilters([]);
      }
    }
  }, []);

  // Save to localStorage
  const saveToStorage = (filters: SavedFilter[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    setSavedFilters(filters);
  };

  const handleSaveFilter = () => {
    if (!newFilterName.trim()) return;

    const newFilter: SavedFilter = {
      id: `filter-${Date.now()}`,
      name: newFilterName.trim(),
      filters: currentFilters,
      createdAt: new Date().toISOString(),
    };

    saveToStorage([...savedFilters, newFilter]);
    setNewFilterName('');
    setShowSaveModal(false);
  };

  const handleDeleteFilter = (id: string) => {
    saveToStorage(savedFilters.filter((f) => f.id !== id));
  };

  const handleApplyFilter = (filter: SavedFilter) => {
    onApplyFilter(filter.filters);
    setIsOpen(false);
  };

  const hasActiveFilters =
    currentFilters.status !== 'all' ||
    currentFilters.tag ||
    currentFilters.hasEmail !== null ||
    currentFilters.hasPhone !== null ||
    currentFilters.search;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          isOpen
            ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
            : 'text-gray-500 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800'
        }`}
      >
        <Bookmark size={16} />
        Saved
        {savedFilters.length > 0 && (
          <span className="bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded-full">
            {savedFilters.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 shadow-lg z-50 overflow-hidden">
            <div className="p-3 border-b border-gray-100 dark:border-dark-700">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900 dark:text-dark-100">Saved Filters</h3>
                {hasActiveFilters && (
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} />
                    Save Current
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {savedFilters.length > 0 ? (
                <div className="p-2 space-y-1">
                  {savedFilters.map((filter) => (
                    <div
                      key={filter.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-800 group"
                    >
                      <button
                        onClick={() => handleApplyFilter(filter)}
                        className="flex-1 text-left"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                          {filter.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-dark-400">
                          {Object.entries(filter.filters)
                            .filter(([_, v]) => v && v !== 'all')
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ') || 'All people'}
                        </p>
                      </button>
                      <button
                        onClick={() => handleDeleteFilter(filter.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-dark-400">
                  No saved filters yet.
                  {hasActiveFilters && (
                    <button
                      onClick={() => setShowSaveModal(true)}
                      className="block w-full mt-2 text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Save current filter
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Save Filter
              </h2>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                Filter Name
              </label>
              <input
                type="text"
                value={newFilterName}
                onChange={(e) => setNewFilterName(e.target.value)}
                placeholder="e.g., New Visitors, Active Members"
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <div className="mt-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                <p className="text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">
                  Current Filters:
                </p>
                <p className="text-sm text-gray-700 dark:text-dark-300">
                  {Object.entries(currentFilters)
                    .filter(([_, v]) => v && v !== 'all')
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ') || 'All people'}
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex gap-3">
              <button
                onClick={() => { setShowSaveModal(false); setNewFilterName(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFilter}
                disabled={!newFilterName.trim()}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Check size={16} />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
