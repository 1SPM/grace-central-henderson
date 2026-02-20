import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, User, CheckSquare, Heart, Sparkles, Send, Loader2, RefreshCw, Copy, Check } from 'lucide-react';
import { Person, Task, PrayerRequest } from '../types';
import { generateAIText } from '../lib/services/ai';
import { useAISettings } from '../hooks/useAISettings';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

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

type Mode = 'search' | 'ai';

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
}

const quickAIActions = [
  { label: 'Draft welcome email', prompt: 'Draft a welcome email for first-time visitors' },
  { label: 'Who needs follow-up?', prompt: 'Who hasn\'t been contacted in 2 weeks?' },
  { label: 'Birthdays this week', prompt: 'Who has birthdays this week?' },
  { label: 'Thank donors', prompt: 'Draft thank you for recent donors' },
];

export function GlobalSearch({
  people,
  tasks,
  prayers,
  onSelectPerson,
  onSelectTask,
  onSelectPrayer,
  onClose
}: GlobalSearchProps) {
  const { settings: aiSettings } = useAISettings();
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { copiedId, copy: copyToClipboard } = useCopyToClipboard();
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Memoize person lookup map for O(1) access
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  useEffect(() => {
    if (mode !== 'search' || !query.trim()) {
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

    // Search tasks
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

    // Search prayers
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
  }, [query, people, tasks, prayers, personMap, mode]);

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

  const handleCopy = (text: string, id: string) => {
    copyToClipboard(text, id);
  };

  const processAIQuery = async (userQuery: string) => {
    const lowerQuery = userQuery.toLowerCase();

    // Birthday queries
    if (lowerQuery.includes('birthday')) {
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const upcomingBirthdays = people.filter(p => {
        if (!p.birthDate) return false;
        const bday = new Date(p.birthDate);
        const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        return thisYearBday >= today && thisYearBday <= nextWeek;
      });

      if (upcomingBirthdays.length === 0) {
        return 'No birthdays coming up in the next week.';
      }
      const names = upcomingBirthdays.map(p => `- ${p.firstName} ${p.lastName}`).join('\n');
      return `Found ${upcomingBirthdays.length} birthday${upcomingBirthdays.length > 1 ? 's' : ''} this week:\n\n${names}`;
    }

    // Follow-up queries - show visitors who may need follow-up
    if (lowerQuery.includes('follow') || lowerQuery.includes('contact') || lowerQuery.includes('reach')) {
      const visitors = people.filter(p => p.status === 'visitor').slice(0, 5);

      if (visitors.length === 0) {
        return 'No visitors currently need follow-up!';
      }
      const names = visitors.map(p => `- ${p.firstName} ${p.lastName}`).join('\n');
      return `${visitors.length} visitor${visitors.length > 1 ? 's' : ''} may need follow-up:\n\n${names}`;
    }

    // Draft email/message
    if (lowerQuery.includes('draft') || lowerQuery.includes('write') || lowerQuery.includes('email') || lowerQuery.includes('thank')) {
      const context = `You are helping a church staff member. Generate a warm, professional message.

Church: Grace Community Church
People: ${people.length} total (${people.filter(p => p.status === 'visitor').length} visitors, ${people.filter(p => p.status === 'member').length} members)

Request: ${userQuery}

Generate a ready-to-send message. If email, include "Subject:" line. Keep under 150 words. Be warm but professional.`;

      try {
        const result = await generateAIText({ prompt: context, maxTokens: 400 });
        return result.success && result.text ? result.text : 'Sorry, I couldn\'t generate that. Please try again.';
      } catch {
        return 'Sorry, I couldn\'t generate that. Please try again.';
      }
    }

    // General query
    const context = `You are Grace AI for a church CRM. Be helpful and concise.

Database: ${people.length} people (${people.filter(p => p.status === 'visitor').length} visitors, ${people.filter(p => p.status === 'member').length} members)

User: ${userQuery}

If you can't help directly, suggest what you CAN do: draft messages, find people, suggest follow-ups.`;

    try {
      const result = await generateAIText({ prompt: context, maxTokens: 300 });
      return result.success && result.text ? result.text : 'Sorry, I encountered an error. Please try again.';
    } catch {
      return 'Sorry, I encountered an error. Please try again.';
    }
  };

  const handleAISubmit = async (userQuery: string) => {
    if (!userQuery.trim() || isAiLoading) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userQuery,
    };

    setAiMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsAiLoading(true);

    const loadingId = (Date.now() + 1).toString();
    setAiMessages(prev => [...prev, { id: loadingId, role: 'assistant', content: '', isLoading: true }]);

    const response = await processAIQuery(userQuery);

    setAiMessages(prev => prev.map(m =>
      m.id === loadingId ? { ...m, content: response, isLoading: false } : m
    ));

    setIsAiLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'ai') {
      handleAISubmit(query);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-16 px-4">
      <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[70vh]">
        {/* Mode Tabs */}
        <div className="flex border-b border-gray-200 dark:border-dark-700">
          <button
            onClick={() => setMode('search')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'search'
                ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 dark:border-violet-400'
                : 'text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200'
            }`}
          >
            <Search size={16} />
            Search
          </button>
          {aiSettings.smartSearch && (
            <button
              onClick={() => setMode('ai')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                mode === 'ai'
                  ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 dark:border-violet-400'
                  : 'text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200'
              }`}
            >
              <Sparkles size={16} />
              AI Assistant
            </button>
          )}
          <button
            onClick={onClose}
            className="p-3 hover:bg-gray-100 dark:hover:bg-dark-800"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Search Mode */}
        {mode === 'search' && (
          <>
            <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-dark-700">
              <Search size={18} className="text-gray-400 dark:text-dark-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people, tasks, prayers..."
                className="flex-1 bg-transparent text-gray-900 dark:text-dark-100 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-dark-500"
              />
            </div>

            {results.length > 0 && (
              <div className="flex-1 overflow-y-auto p-2">
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
                      <p className="font-medium text-gray-900 dark:text-dark-100 truncate">{result.title}</p>
                      <p className="text-sm text-gray-400 dark:text-dark-400 truncate">{result.subtitle}</p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-dark-500 capitalize">{result.type}</span>
                  </button>
                ))}
              </div>
            )}

            {query && results.length === 0 && (
              <div className="p-8 text-center text-gray-400 dark:text-dark-400">
                No results for "{query}"
              </div>
            )}

            {!query && (
              <div className="p-8 text-center text-gray-400 dark:text-dark-400">
                <p className="text-sm">Search people, tasks, and prayers</p>
                {aiSettings.smartSearch && (
                  <p className="text-xs mt-2">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-dark-700 rounded">Tab</kbd> to switch to AI
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* AI Mode */}
        {mode === 'ai' && aiSettings.smartSearch && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {aiMessages.length === 0 && (
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Sparkles size={24} className="text-white" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-dark-300 mb-4">
                    I can help draft messages, find people, and suggest actions.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {quickAIActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAISubmit(action.prompt)}
                        className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-dark-800 text-gray-700 dark:text-dark-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {aiMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      message.role === 'user'
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 dark:bg-dark-800 text-gray-900 dark:text-dark-100'
                    }`}
                  >
                    {message.isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.role === 'assistant' && (
                          <button
                            onClick={() => handleCopy(message.content, message.id)}
                            className="mt-1 text-xs flex items-center gap-1 opacity-60 hover:opacity-100"
                          >
                            {copiedId === message.id ? <Check size={10} /> : <Copy size={10} />}
                            {copiedId === message.id ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-dark-700">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask anything..."
                  className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-gray-400"
                  disabled={isAiLoading}
                />
                <button
                  type="submit"
                  disabled={!query.trim() || isAiLoading}
                  className="p-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
                {aiMessages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAiMessages([])}
                    className="p-2.5 bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-dark-400 rounded-xl hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors"
                    title="Clear"
                  >
                    <RefreshCw size={16} />
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
