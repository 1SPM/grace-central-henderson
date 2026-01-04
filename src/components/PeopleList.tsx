import { useState } from 'react';
import { Search, UserPlus, ChevronRight } from 'lucide-react';
import { Person, MemberStatus } from '../types';
import { STATUS_COLORS } from '../constants';

interface PeopleListProps {
  people: Person[];
  onViewPerson: (id: string) => void;
  onAddPerson: () => void;
}

const statusLabels: Record<MemberStatus, string> = {
  visitor: 'Visitor',
  regular: 'Regular',
  member: 'Member',
  leader: 'Leader',
  inactive: 'Inactive'
};

export function PeopleList({ people, onViewPerson, onAddPerson }: PeopleListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'all'>('all');

  const filtered = people.filter((person) => {
    const matchesSearch =
      `${person.firstName} ${person.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      person.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || person.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: people.length,
    visitor: people.filter(p => p.status === 'visitor').length,
    regular: people.filter(p => p.status === 'regular').length,
    member: people.filter(p => p.status === 'member').length,
    leader: people.filter(p => p.status === 'leader').length,
    inactive: people.filter(p => p.status === 'inactive').length,
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">People</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{people.length} total people in your congregation</p>
        </div>
        <button
          onClick={onAddPerson}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          <UserPlus size={18} />
          Add Person
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'visitor', 'regular', 'member', 'leader', 'inactive'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === status
                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {status === 'all' ? 'All' : statusLabels[status]} ({statusCounts[status]})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* People Grid */}
      <div className="grid grid-cols-1 gap-3">
        {filtered.map((person) => (
          <button
            key={person.id}
            onClick={() => onViewPerson(person.id)}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm transition-all group text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-lg">
                {person.firstName[0]}{person.lastName[0]}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{person.firstName} {person.lastName}</p>
                <p className="text-sm text-gray-400">{person.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {person.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md">
                  {tag}
                </span>
              ))}
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[person.status]}`}>
                {statusLabels[person.status]}
              </span>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No people found matching your criteria</p>
        </div>
      )}
    </div>
  );
}
