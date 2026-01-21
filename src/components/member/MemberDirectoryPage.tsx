import { useState, useMemo } from 'react';
import { Search, Mail, Phone, MapPin, Users } from 'lucide-react';
import type { Person } from '../../types';

interface MemberDirectoryPageProps {
  people: Person[];
}

export function MemberDirectoryPage({ people }: MemberDirectoryPageProps) {
  const [search, setSearch] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  // Only show members and leaders (not visitors or inactive)
  const members = useMemo(() =>
    people.filter(p => p.status === 'member' || p.status === 'leader' || p.status === 'regular'),
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
    <div className="p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          Church Directory
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {members.length} members
        </p>
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
            className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
          />
        </div>
      </div>

      {/* Alphabet Filter - Scrollable */}
      <div className="mb-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 pb-2">
          <button
            onClick={() => setSelectedLetter(null)}
            className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors flex-shrink-0 ${
              selectedLetter === null
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-dark-400'
            }`}
          >
            All
          </button>
          {alphabet.map(letter => (
            usedLetters.has(letter) && (
              <button
                key={letter}
                onClick={() => setSelectedLetter(letter === selectedLetter ? null : letter)}
                className={`w-8 h-8 text-sm rounded-full font-medium transition-colors flex-shrink-0 ${
                  selectedLetter === letter
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-dark-400'
                }`}
              >
                {letter}
              </button>
            )
          ))}
        </div>
      </div>

      {/* Directory Listing */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No members found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedMembers).sort().map(([letter, letterMembers]) => (
            <div key={letter}>
              <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-2 sticky top-0 bg-gray-50 dark:bg-dark-900 py-1 z-10">
                {letter}
              </h3>
              <div className="space-y-2">
                {letterMembers.map(person => (
                  <MemberCard key={person.id} person={person} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({ person }: { person: Person }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      onClick={() => setShowDetails(!showDetails)}
      className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-3 active:scale-[0.99] transition-transform cursor-pointer"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-11 h-11 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
          {person.firstName[0]}{person.lastName[0]}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white">
            {person.firstName} {person.lastName}
          </h4>
          {person.city && person.state && (
            <p className="text-xs text-gray-500 dark:text-dark-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {person.city}, {person.state}
            </p>
          )}
        </div>
      </div>

      {/* Expanded Contact Info */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-dark-700 space-y-2">
          {person.email && (
            <a
              href={`mailto:${person.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 py-2 px-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg"
            >
              <Mail className="w-4 h-4" />
              {person.email}
            </a>
          )}
          {person.phone && (
            <a
              href={`tel:${person.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 py-2 px-3 bg-green-50 dark:bg-green-500/10 rounded-lg"
            >
              <Phone className="w-4 h-4" />
              {person.phone}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
