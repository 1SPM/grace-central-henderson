import { useState, useRef, useEffect } from 'react';
import { X, Search, MessageSquare, Loader2, FileText, Phone, Mail, Home, MessageCircle, Heart } from 'lucide-react';
import { Person, Interaction } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger('quick-note');

interface QuickNoteProps {
  people: Person[];
  onSave: (interaction: Omit<Interaction, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
}

export function QuickNote({ people, onSave, onClose }: QuickNoteProps) {
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [noteType, setNoteType] = useState<Interaction['type']>('note');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const filteredPeople = search
    ? people.filter(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
          p.email.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 5)
    : [];

  const selectedPerson = people.find((p) => p.id === selectedPersonId);

  const handleSelectPerson = (person: Person) => {
    setSelectedPersonId(person.id);
    setSearch('');
    setTimeout(() => contentRef.current?.focus(), 100);
  };

  const handleSubmit = async () => {
    if (!selectedPersonId || !content.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        personId: selectedPersonId,
        type: noteType,
        content: content.trim(),
        createdBy: 'You',
      });
      onClose();
    } catch (error) {
      log.error('Failed to save note', error);
    } finally {
      setIsSaving(false);
    }
  };

  const noteTypes: { value: Interaction['type']; label: string; icon: React.ReactNode }[] = [
    { value: 'note', label: 'Note', icon: <FileText size={14} /> },
    { value: 'call', label: 'Call', icon: <Phone size={14} /> },
    { value: 'email', label: 'Email', icon: <Mail size={14} /> },
    { value: 'visit', label: 'Visit', icon: <Home size={14} /> },
    { value: 'text', label: 'Text', icon: <MessageCircle size={14} /> },
    { value: 'prayer', label: 'Prayer', icon: <Heart size={14} /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-[10vh]">
      <div
        className="bg-white dark:bg-dark-850 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center">
              <MessageSquare size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Quick Note</h2>
              <p className="text-sm text-gray-500 dark:text-dark-400">Add a quick note to anyone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-dark-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Person Search / Selection */}
          {!selectedPerson ? (
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-400"
                size={18}
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search for a person..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />

              {/* Search Results */}
              {filteredPeople.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl shadow-lg z-10 overflow-hidden">
                  {filteredPeople.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => handleSelectPerson(person)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors text-left"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {person.firstName[0]}
                        {person.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-dark-100">
                          {person.firstName} {person.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-dark-400">{person.email || 'No email'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {search && filteredPeople.length === 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl shadow-lg z-10 p-4 text-center text-gray-500 dark:text-dark-400 text-sm">
                  No people found
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                  {selectedPerson.firstName[0]}
                  {selectedPerson.lastName[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-dark-100">
                    {selectedPerson.firstName} {selectedPerson.lastName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-dark-400">
                    {selectedPerson.email || 'No email'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPersonId('')}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Change
              </button>
            </div>
          )}

          {/* Note Type Selection */}
          {selectedPerson && (
            <>
              <div className="flex flex-wrap gap-2">
                {noteTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setNoteType(type.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      noteType === type.value
                        ? 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400'
                        : 'bg-gray-100/80 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200/80 dark:hover:bg-white/10'
                    }`}
                  >
                    {type.icon}
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Note Content */}
              <textarea
                ref={contentRef}
                placeholder={`Add a ${noteType} note...`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedPersonId || !content.trim() || isSaving}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save Note'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
