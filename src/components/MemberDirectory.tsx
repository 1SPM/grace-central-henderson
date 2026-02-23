import { useState, useMemo } from 'react';
import { Search, Mail, Phone, Users, MapPin, Calendar, ArrowLeft } from 'lucide-react';
import type { Person } from '../types';

interface MemberDirectoryProps {
  people: Person[];
  onBack?: () => void;
  onViewPerson?: (id: string) => void;
}

export function MemberDirectory({ people, onBack, onViewPerson }: MemberDirectoryProps) {
  const [search, setSearch] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  // Only show members and leaders (not visitors, regulars, or inactive)
  const members = useMemo(() =>
    people.filter(p => p.status === 'member' || p.status === 'leader'),
    [people]
  );

  // Filter by search and letter
  const filtered = useMemo(() => {
    let result = members;

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchLower) ||
        p.email?.toLowerCase().includes(searchLower)
      );
    }

    if (selectedLetter) {
      result = result.filter(p =>
        p.lastName.toUpperCase().startsWith(selectedLetter)
      );
    }

    return result.sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
    );
  }, [members, search, selectedLetter]);

  // Get alphabet for filter
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const usedLetters = useMemo(() =>
    new Set(members.map(p => p.lastName[0]?.toUpperCase())),
    [members]
  );

  // Group by letter for display
  const groupedMembers = useMemo(() => {
    const groups: Record<string, Person[]> = {};
    filtered.forEach(person => {
      const letter = person.lastName[0]?.toUpperCase() || '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(person);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              Member Directory
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {members.length} members in our church family
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Alphabet Filter */}
      <div className="flex flex-wrap gap-1 mb-6">
        <button
          onClick={() => setSelectedLetter(null)}
          className={`px-2 py-1 text-sm rounded font-medium transition-colors ${
            selectedLetter === null
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All
        </button>
        {alphabet.map(letter => (
          <button
            key={letter}
            onClick={() => setSelectedLetter(letter)}
            disabled={!usedLetters.has(letter)}
            className={`px-2 py-1 text-sm rounded font-medium transition-colors ${
              selectedLetter === letter
                ? 'bg-indigo-600 text-white'
                : usedLetters.has(letter)
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  : 'bg-gray-50 dark:bg-gray-900 text-gray-300 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            {letter}
          </button>
        ))}
      </div>

      {/* Directory Listing */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No members found matching your search.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedMembers).sort().map(([letter, letterMembers]) => (
            <div key={letter}>
              <h2 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-3 sticky top-0 bg-gray-50 dark:bg-gray-900 py-1">
                {letter}
              </h2>
              <div className="grid gap-3">
                {letterMembers.map(person => (
                  <div
                    key={person.id}
                    onClick={() => onViewPerson?.(person.id)}
                    className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4 ${
                      onViewPerson ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                      {person.firstName[0]}{person.lastName[0]}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {person.firstName} {person.lastName}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                        {person.email && (
                          <a
                            href={`mailto:${person.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[180px]">{person.email}</span>
                          </a>
                        )}
                        {person.phone && (
                          <a
                            href={`tel:${person.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {person.phone}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="hidden sm:flex flex-col items-end text-xs text-gray-400 dark:text-gray-500">
                      {person.city && person.state && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {person.city}, {person.state}
                        </span>
                      )}
                      {person.joinDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Member since {new Date(person.joinDate).getFullYear()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
