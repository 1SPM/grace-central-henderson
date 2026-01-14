import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, User, CheckSquare, Heart } from 'lucide-react';
import { Person, Task, PrayerRequest } from '../types';

interface GlobalSearchProps {
  people: Person[];
  tasks: Task[];
  prayers: PrayerRequest[];
  onSelectPerson: (id: string) => void;
  onSelectTask: () => void;
  onSelectPrayer: () => void;
  onClose: () => void;
}

type SearchResult = {
  type: 'person' | 'task' | 'prayer';
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
};

export function GlobalSearch({
  people,
  tasks,
  prayers,
  onSelectPerson,
  onSelectTask,
  onSelectPrayer,
  onClose
}: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Memoize person lookup map for O(1) access
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search people
    people.forEach((person) => {
      const fullName = `${person.firstName} ${person.lastName}`.toLowerCase();
      if (
        fullName.includes(q) ||
        person.email.toLowerCase().includes(q) ||
        person.phone.includes(q) ||
        person.tags.some(t => t.toLowerCase().includes(q))
      ) {
        searchResults.push({
          type: 'person',
          id: person.id,
          title: `${person.firstName} ${person.lastName}`,
          subtitle: person.email || person.status,
          icon: <User size={16} className="text-indigo-500 dark:text-indigo-400" />
        });
      }
    });

    // Search tasks (using personMap for O(1) lookup)
    tasks.forEach((task) => {
      if (
        task.title.toLowerCase().includes(q) ||
        task.description?.toLowerCase().includes(q)
      ) {
        const person = task.personId ? personMap.get(task.personId) : undefined;
        searchResults.push({
          type: 'task',
          id: task.id,
          title: task.title,
          subtitle: person ? `${person.firstName} ${person.lastName}` : task.category,
          icon: <CheckSquare size={16} className="text-amber-500 dark:text-amber-400" />
        });
      }
    });

    // Search prayers (using personMap for O(1) lookup)
    prayers.forEach((prayer) => {
      if (prayer.content.toLowerCase().includes(q)) {
        const person = prayer.personId ? personMap.get(prayer.personId) : undefined;
        searchResults.push({
          type: 'prayer',
          id: prayer.id,
          title: prayer.content.slice(0, 50) + (prayer.content.length > 50 ? '...' : ''),
          subtitle: person ? `${person.firstName} ${person.lastName}` : 'Prayer request',
          icon: <Heart size={16} className="text-red-500 dark:text-red-400" />
        });
      }
    });

    setResults(searchResults.slice(0, 10));
  }, [query, people, tasks, prayers, personMap]);

  const handleSelect = (result: SearchResult) => {
    switch (result.type) {
      case 'person':
        onSelectPerson(result.id);
        break;
      case 'task':
        onSelectTask();
        break;
      case 'prayer':
        onSelectPrayer();
        break;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-20 px-4">
      <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-dark-700">
          <Search size={20} className="text-gray-400 dark:text-dark-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, tasks, prayers..."
            className="flex-1 bg-transparent text-gray-900 dark:text-dark-100 text-lg focus:outline-none placeholder:text-gray-400 dark:placeholder:text-dark-500"
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
          >
            <X size={20} className="text-gray-400 dark:text-dark-400" />
          </button>
        </div>

        {results.length > 0 && (
          <div className="max-h-96 overflow-y-auto p-2">
            {results.map((result, index) => (
              <button
                key={`${result.type}-${result.id}-${index}`}
                onClick={() => handleSelect(result)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-gray-100 dark:bg-dark-700 rounded-lg flex items-center justify-center">
                  {result.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-dark-100 truncate">
                    {result.title}
                  </p>
                  <p className="text-sm text-gray-400 dark:text-dark-400 truncate">{result.subtitle}</p>
                </div>
                <span className="text-xs text-gray-400 dark:text-dark-500 capitalize">{result.type}</span>
              </button>
            ))}
          </div>
        )}

        {query && results.length === 0 && (
          <div className="p-8 text-center text-gray-400 dark:text-dark-400">
            No results found for "{query}"
          </div>
        )}

        {!query && (
          <div className="p-8 text-center text-gray-400 dark:text-dark-400">
            <p className="text-sm">Start typing to search across people, tasks, and prayers</p>
            <p className="text-xs mt-2">Tip: Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-dark-700 rounded">Ctrl+K</kbd> to open search</p>
          </div>
        )}
      </div>
    </div>
  );
}
