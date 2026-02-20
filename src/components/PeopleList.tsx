import { useState, useMemo, useEffect } from 'react';
import { Search, UserPlus, ChevronRight, Download, Check, X, Filter, Tag, UserCog, Upload, ChevronLeft, ArrowUpDown } from 'lucide-react';
import { Person, MemberStatus } from '../types';
import { STATUS_COLORS } from '../constants';
import { exportPeopleToCSV } from '../utils/csvExport';
import { ViewToggle } from './ViewToggle';
import { ProfileCompletenessBadge } from './ProfileCompleteness';
import { SavedFilters, SavedFilter } from './SavedFilters';
import { useToast } from './Toast';
import { CSVImportWizard } from './CSVImportWizard';

type SortOption = 'name-asc' | 'name-desc' | 'status' | 'newest' | 'oldest';

interface PeopleListProps {
  people: Person[];
  onViewPerson: (id: string) => void;
  onAddPerson: () => void;
  onBulkUpdateStatus?: (ids: string[], status: MemberStatus) => void;
  onBulkAddTag?: (ids: string[], tag: string) => void;
  onImportCSV?: (people: Partial<Person>[]) => Promise<void>;
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
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    const saved = localStorage.getItem('peopleViewMode');
    return (saved as 'card' | 'table') || 'card';
  });

  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem('peopleSortBy');
    return (saved as SortOption) || 'name-asc';
  });

  // Save sort preference
  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    localStorage.setItem('peopleSortBy', sort);
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('peoplePageSize');
    return saved ? parseInt(saved) : 25;
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

  // Memoize filtered and sorted people list
  const filtered = useMemo(() => {
    const statusOrder: Record<MemberStatus, number> = {
      leader: 0,
      member: 1,
      regular: 2,
      visitor: 3,
      inactive: 4,
    };

    const result = people.filter((person) => {
      const matchesSearch =
        `${person.firstName} ${person.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        person.email.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || person.status === statusFilter;
      const matchesTag = !tagFilter || person.tags.includes(tagFilter);
      const matchesEmail = hasEmailFilter === null || (hasEmailFilter ? person.email : !person.email);
      const matchesPhone = hasPhoneFilter === null || (hasPhoneFilter ? person.phone : !person.phone);
      return matchesSearch && matchesStatus && matchesTag && matchesEmail && matchesPhone;
    });

    // Sort the results
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        case 'name-desc':
          return `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`);
        case 'status':
          return statusOrder[a.status] - statusOrder[b.status];
        case 'newest':
          return new Date(b.joinDate || 0).getTime() - new Date(a.joinDate || 0).getTime();
        case 'oldest':
          return new Date(a.joinDate || 0).getTime() - new Date(b.joinDate || 0).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [people, search, statusFilter, tagFilter, hasEmailFilter, hasPhoneFilter, sortBy]);

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedPeople = useMemo(() =>
    filtered.slice(startIndex, endIndex),
    [filtered, startIndex, endIndex]
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, tagFilter, hasEmailFilter, hasPhoneFilter]);

  // Save page size preference
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    localStorage.setItem('peoplePageSize', size.toString());
  };

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
    const pageIds = paginatedPeople.map(p => p.id);
    const allPageSelected = pageIds.every(id => selectedIds.has(id));
    if (allPageSelected) {
      // Deselect current page
      const newSelected = new Set(selectedIds);
      pageIds.forEach(id => newSelected.delete(id));
      setSelectedIds(newSelected);
    } else {
      // Select current page
      setSelectedIds(new Set([...selectedIds, ...pageIds]));
    }
  };

  const isAllPageSelected = paginatedPeople.length > 0 && paginatedPeople.every(p => selectedIds.has(p.id));

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

  const clearAdvancedFilters = () => {
    setTagFilter('');
    setHasEmailFilter(null);
    setHasPhoneFilter(null);
  };

  const hasActiveAdvancedFilters = tagFilter || hasEmailFilter !== null || hasPhoneFilter !== null;

  const sortLabels: Record<SortOption, string> = {
    'name-asc': 'Name (A-Z)',
    'name-desc': 'Name (Z-A)',
    'status': 'Status',
    'newest': 'Newest First',
    'oldest': 'Oldest First',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">People</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">{people.length} total people in your congregation</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as SortOption)}
              className="appearance-none pl-9 pr-8 py-2.5 border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-dark-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <ViewToggle view={viewMode} onViewChange={handleViewModeChange} />
          {onImportCSV && (
            <button
              onClick={() => setShowImportWizard(true)}
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
          {paginatedPeople.length > 0 && (onBulkUpdateStatus || onBulkAddTag) && (
            <div className="flex items-center gap-3 px-4 py-2 text-sm text-gray-500 dark:text-dark-400">
              <button
                onClick={selectAll}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  isAllPageSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-gray-300 dark:border-dark-600 hover:border-indigo-400'
                }`}
              >
                {isAllPageSelected && <Check size={14} />}
              </button>
              <span>
                {isAllPageSelected
                  ? `Deselect page (${paginatedPeople.length})`
                  : `Select page (${paginatedPeople.length})`}
                {selectedIds.size > 0 && ` • ${selectedIds.size} total selected`}
              </span>
            </div>
          )}

          {paginatedPeople.map((person) => (
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
                  {person.photo ? (
                    <img
                      src={person.photo}
                      alt={`${person.firstName} ${person.lastName}`}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-lg ${person.photo ? 'hidden' : ''}`}>
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
                        isAllPageSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-gray-300 dark:border-dark-600 hover:border-indigo-400'
                      }`}
                    >
                      {isAllPageSelected && <Check size={14} />}
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
              {paginatedPeople.map((person) => (
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
                      {person.photo ? (
                        <img
                          src={person.photo}
                          alt={`${person.firstName} ${person.lastName}`}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-sm ${person.photo ? 'hidden' : ''}`}>
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

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-dark-400">
            <span>
              Showing {startIndex + 1}-{Math.min(endIndex, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                className="px-2 py-1 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-dark-300 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 text-gray-700 dark:text-dark-300 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-700 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-700 dark:text-dark-300 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-dark-300 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 dark:text-dark-400">No people found matching your criteria</p>
        </div>
      )}

      {/* Import CSV Wizard */}
      {showImportWizard && onImportCSV && (
        <CSVImportWizard
          onImport={onImportCSV}
          onClose={() => setShowImportWizard(false)}
        />
      )}
    </div>
  );
}
