import { useState, useMemo } from 'react';
import { Search, UserPlus, ChevronRight, Download, Check, X, Filter, Tag, UserCog, Upload } from 'lucide-react';
import { Person, MemberStatus } from '../types';
import { STATUS_COLORS } from '../constants';
import { exportPeopleToCSV } from '../utils/exportCsv';
import { ViewToggle } from './ViewToggle';
import { ProfileCompletenessBadge } from './ProfileCompleteness';
import { SavedFilters, SavedFilter } from './SavedFilters';
import { useToast } from './Toast';

interface PeopleListProps {
  people: Person[];
  onViewPerson: (id: string) => void;
  onAddPerson: () => void;
  onBulkUpdateStatus?: (ids: string[], status: MemberStatus) => void;
  onBulkAddTag?: (ids: string[], tag: string) => void;
  onImportCSV?: (people: Partial<Person>[]) => void;
}

const statusLabels: Record<MemberStatus, string> = {
  visitor: 'Visitor',
  regular: 'Regular',
  member: 'Member',
  leader: 'Leader',
  inactive: 'Inactive'
};

export function PeopleList({
  people,
  onViewPerson,
  onAddPerson,
  onBulkUpdateStatus,
  onBulkAddTag,
  onImportCSV
}: PeopleListProps) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkAction, setBulkAction] = useState<'status' | 'tag' | null>(null);
  const [newTag, setNewTag] = useState('');
  const [newStatus, setNewStatus] = useState<MemberStatus>('member');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [importError, setImportError] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    const saved = localStorage.getItem('peopleViewMode');
    return (saved as 'card' | 'table') || 'card';
  });

  // Save view mode preference
  const handleViewModeChange = (mode: 'card' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('peopleViewMode', mode);
  };

  // Advanced filters
  const [tagFilter, setTagFilter] = useState<string>('');
  const [hasEmailFilter, setHasEmailFilter] = useState<boolean | null>(null);
  const [hasPhoneFilter, setHasPhoneFilter] = useState<boolean | null>(null);

  // Current filters object for saving
  const currentFilters = {
    status: statusFilter !== 'all' ? statusFilter : undefined,
    tag: tagFilter || undefined,
    hasEmail: hasEmailFilter ?? undefined,
    hasPhone: hasPhoneFilter ?? undefined,
    search: search || undefined,
  };

  // Apply a saved filter
  const handleApplyFilter = (filters: SavedFilter['filters']) => {
    if (filters.status) {
      setStatusFilter(filters.status);
    } else {
      setStatusFilter('all');
    }
    setTagFilter(filters.tag || '');
    setHasEmailFilter(filters.hasEmail ?? null);
    setHasPhoneFilter(filters.hasPhone ?? null);
    setSearch(filters.search || '');
    toast.success(`Filter applied`);
  };

  // Memoize all unique tags
  const allTags = useMemo(() =>
    Array.from(new Set(people.flatMap(p => p.tags))).sort(),
    [people]
  );

  // Memoize filtered people list
  const filtered = useMemo(() => people.filter((person) => {
    const matchesSearch =
      `${person.firstName} ${person.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      person.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || person.status === statusFilter;
    const matchesTag = !tagFilter || person.tags.includes(tagFilter);
    const matchesEmail = hasEmailFilter === null || (hasEmailFilter ? person.email : !person.email);
    const matchesPhone = hasPhoneFilter === null || (hasPhoneFilter ? person.phone : !person.phone);
    return matchesSearch && matchesStatus && matchesTag && matchesEmail && matchesPhone;
  }), [people, search, statusFilter, tagFilter, hasEmailFilter, hasPhoneFilter]);

  // Memoize status counts (single pass through people array)
  const statusCounts = useMemo(() => {
    const counts = {
      all: people.length,
      visitor: 0,
      regular: 0,
      member: 0,
      leader: 0,
      inactive: 0,
    };
    people.forEach(p => {
      counts[p.status]++;
    });
    return counts;
  }, [people]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setShowBulkActions(false);
    setBulkAction(null);
  };

  const handleBulkStatusUpdate = () => {
    if (onBulkUpdateStatus && selectedIds.size > 0) {
      onBulkUpdateStatus(Array.from(selectedIds), newStatus);
      toast.success(`Updated ${selectedIds.size} people to ${statusLabels[newStatus]}`);
      clearSelection();
    }
  };

  const handleBulkAddTag = () => {
    if (onBulkAddTag && selectedIds.size > 0 && newTag.trim()) {
      onBulkAddTag(Array.from(selectedIds), newTag.trim());
      toast.success(`Added tag "${newTag}" to ${selectedIds.size} people`);
      setNewTag('');
      clearSelection();
    }
  };

  const handleExportSelected = () => {
    const selectedPeople = people.filter(p => selectedIds.has(p.id));
    exportPeopleToCSV(selectedPeople);
    toast.success(`Exported ${selectedPeople.length} people to CSV`);
  };

  const handleImportCSV = () => {
    try {
      setImportError('');
      const lines = importData.trim().split('\n');
      if (lines.length < 2) {
        setImportError('CSV must have a header row and at least one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredFields = ['firstname', 'lastname'];
      const hasRequired = requiredFields.every(f => headers.includes(f));

      if (!hasRequired) {
        setImportError('CSV must include firstName and lastName columns');
        return;
      }

      const imported: Partial<Person>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) continue;

        const person: Partial<Person> = {
          tags: [],
          smallGroups: []
        };

        headers.forEach((header, idx) => {
          const value = values[idx];
          switch (header) {
            case 'firstname':
              person.firstName = value;
              break;
            case 'lastname':
              person.lastName = value;
              break;
            case 'email':
              person.email = value;
              break;
            case 'phone':
              person.phone = value;
              break;
            case 'status':
              if (['visitor', 'regular', 'member', 'leader', 'inactive'].includes(value.toLowerCase())) {
                person.status = value.toLowerCase() as MemberStatus;
              }
              break;
            case 'tags':
              person.tags = value.split(';').map(t => t.trim()).filter(Boolean);
              break;
          }
        });

        if (person.firstName && person.lastName) {
          if (!person.status) person.status = 'visitor';
          imported.push(person);
        }
      }

      if (imported.length === 0) {
        setImportError('No valid records found in CSV');
        return;
      }

      if (onImportCSV) {
        onImportCSV(imported);
        toast.success(`Imported ${imported.length} people successfully`);
        setShowImportModal(false);
        setImportData('');
      }
    } catch {
      setImportError('Failed to parse CSV. Please check the format.');
    }
  };

  const clearAdvancedFilters = () => {
    setTagFilter('');
    setHasEmailFilter(null);
    setHasPhoneFilter(null);
  };

  const hasActiveAdvancedFilters = tagFilter || hasEmailFilter !== null || hasPhoneFilter !== null;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">People</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">{people.length} total people in your congregation</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle view={viewMode} onViewChange={handleViewModeChange} />
          {onImportCSV && (
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
            >
              <Upload size={18} />
              Import
            </button>
          )}
          <button
            onClick={() => {
              exportPeopleToCSV(people);
              toast.success(`Exported ${people.length} people to CSV`);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
          >
            <Download size={18} />
            Export
          </button>
          <button
            onClick={onAddPerson}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            <UserPlus size={18} />
            Add Person
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-indigo-700 dark:text-indigo-400 font-medium">
                {selectedIds.size} selected
              </span>
              <button
                onClick={clearSelection}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-2">
              {!showBulkActions ? (
                <>
                  <button
                    onClick={() => { setShowBulkActions(true); setBulkAction('status'); }}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-dark-800 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
                  >
                    <UserCog size={16} />
                    Change Status
                  </button>
                  <button
                    onClick={() => { setShowBulkActions(true); setBulkAction('tag'); }}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-dark-800 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
                  >
                    <Tag size={16} />
                    Add Tag
                  </button>
                  <button
                    onClick={handleExportSelected}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-dark-800 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
                  >
                    <Download size={16} />
                    Export Selected
                  </button>
                </>
              ) : bulkAction === 'status' ? (
                <div className="flex items-center gap-2">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as MemberStatus)}
                    className="px-3 py-2 border border-indigo-200 dark:border-indigo-500/30 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkStatusUpdate}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => { setShowBulkActions(false); setBulkAction(null); }}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : bulkAction === 'tag' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Enter tag name..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="px-3 py-2 border border-indigo-200 dark:border-indigo-500/30 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm"
                  />
                  <button
                    onClick={handleBulkAddTag}
                    disabled={!newTag.trim()}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => { setShowBulkActions(false); setBulkAction(null); }}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              showAdvancedFilters || hasActiveAdvancedFilters
                ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                : 'text-gray-500 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800'
            }`}
          >
            <Filter size={16} />
            Filters
            {hasActiveAdvancedFilters && (
              <span className="w-2 h-2 bg-indigo-600 rounded-full" />
            )}
          </button>
          <SavedFilters
            currentFilters={currentFilters}
            onApplyFilter={handleApplyFilter}
          />
          <div className="flex flex-wrap gap-2">
            {(['all', 'visitor', 'regular', 'member', 'leader', 'inactive'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === status
                    ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                    : 'text-gray-500 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800'
                }`}
              >
                {status === 'all' ? 'All' : statusLabels[status]} ({statusCounts[status]})
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-[150px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">Tag</label>
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm"
                >
                  <option value="">Any tag</option>
                  {allTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[150px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">Has Email</label>
                <select
                  value={hasEmailFilter === null ? '' : hasEmailFilter ? 'yes' : 'no'}
                  onChange={(e) => setHasEmailFilter(e.target.value === '' ? null : e.target.value === 'yes')}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm"
                >
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="min-w-[150px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-dark-400 mb-1">Has Phone</label>
                <select
                  value={hasPhoneFilter === null ? '' : hasPhoneFilter ? 'yes' : 'no'}
                  onChange={(e) => setHasPhoneFilter(e.target.value === '' ? null : e.target.value === 'yes')}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm"
                >
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              {hasActiveAdvancedFilters && (
                <button
                  onClick={clearAdvancedFilters}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-5"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* People List */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 gap-3">
          {/* Select All Header */}
          {filtered.length > 0 && (onBulkUpdateStatus || onBulkAddTag) && (
            <div className="flex items-center gap-3 px-4 py-2 text-sm text-gray-500 dark:text-dark-400">
              <button
                onClick={selectAll}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedIds.size === filtered.length && filtered.length > 0
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-gray-300 dark:border-dark-600 hover:border-indigo-400'
                }`}
              >
                {selectedIds.size === filtered.length && filtered.length > 0 && <Check size={14} />}
              </button>
              <span>
                {selectedIds.size === filtered.length && filtered.length > 0
                  ? 'Deselect all'
                  : `Select all ${filtered.length} people`}
              </span>
            </div>
          )}

          {filtered.map((person) => (
            <div
              key={person.id}
              className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-4 flex items-center justify-between hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-4">
                {(onBulkUpdateStatus || onBulkAddTag) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(person.id); }}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedIds.has(person.id)
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-gray-300 dark:border-dark-600 hover:border-indigo-400'
                    }`}
                  >
                    {selectedIds.has(person.id) && <Check size={14} />}
                  </button>
                )}
                <button
                  onClick={() => onViewPerson(person.id)}
                  className="flex items-center gap-4 text-left"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-lg">
                    {person.firstName[0]}{person.lastName[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-dark-100">{person.firstName} {person.lastName}</p>
                    <p className="text-sm text-gray-400 dark:text-dark-400">{person.email || 'No email'}</p>
                  </div>
                </button>
              </div>
              <button
                onClick={() => onViewPerson(person.id)}
                className="flex items-center gap-3"
              >
                <ProfileCompletenessBadge person={person} />
                {person.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="hidden sm:inline text-xs bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300 px-2 py-1 rounded-md">
                    {tag}
                  </span>
                ))}
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[person.status]}`}>
                  {statusLabels[person.status]}
                </span>
                <ChevronRight size={18} className="text-gray-300 dark:text-dark-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
              <tr>
                {(onBulkUpdateStatus || onBulkAddTag) && (
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={selectAll}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedIds.size === filtered.length && filtered.length > 0
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-gray-300 dark:border-dark-600 hover:border-indigo-400'
                      }`}
                    >
                      {selectedIds.size === filtered.length && filtered.length > 0 && <Check size={14} />}
                    </button>
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider hidden lg:table-cell">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider hidden sm:table-cell">Profile</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
              {filtered.map((person) => (
                <tr
                  key={person.id}
                  className="hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors cursor-pointer"
                  onClick={() => onViewPerson(person.id)}
                >
                  {(onBulkUpdateStatus || onBulkAddTag) && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleSelect(person.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedIds.has(person.id)
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-gray-300 dark:border-dark-600 hover:border-indigo-400'
                        }`}
                      >
                        {selectedIds.has(person.id) && <Check size={14} />}
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                        {person.firstName[0]}{person.lastName[0]}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-dark-100">
                        {person.firstName} {person.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-dark-400 hidden md:table-cell">
                    {person.email || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-dark-400 hidden lg:table-cell">
                    {person.phone || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[person.status]}`}>
                      {statusLabels[person.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <ProfileCompletenessBadge person={person} />
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={16} className="text-gray-300 dark:text-dark-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 dark:text-dark-400">No people found matching your criteria</p>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Import from CSV</h2>
              <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                Paste CSV data with columns: firstName, lastName, email, phone, status, tags
              </p>
            </div>
            <div className="p-4">
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder={`firstName,lastName,email,phone,status,tags
John,Doe,john@example.com,555-1234,visitor,Youth;Volunteer
Jane,Smith,jane@example.com,555-5678,member,Women's Ministry`}
                rows={8}
                className="w-full px-4 py-3 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {importError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{importError}</p>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex gap-3">
              <button
                onClick={() => { setShowImportModal(false); setImportData(''); setImportError(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={handleImportCSV}
                disabled={!importData.trim()}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
