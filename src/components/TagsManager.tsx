import { useState } from 'react';
import { Tag, Plus, Trash2, Edit2, Check, X, Users, Merge } from 'lucide-react';
import { Person } from '../types';
import { useToast } from './Toast';

interface TagsManagerProps {
  people: Person[];
  onUpdatePersonTags: (personId: string, tags: string[]) => void;
}

interface TagInfo {
  name: string;
  count: number;
  people: Person[];
}

export function TagsManager({ people, onUpdatePersonTags }: TagsManagerProps) {
  const toast = useToast();
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTagName, setCreateTagName] = useState('');
  const [selectedPeopleForTag, setSelectedPeopleForTag] = useState<Set<string>>(new Set());

  // Get all tags with counts
  const tagMap = new Map<string, TagInfo>();
  people.forEach((person) => {
    person.tags.forEach((tag) => {
      if (tagMap.has(tag)) {
        const info = tagMap.get(tag)!;
        info.count++;
        info.people.push(person);
      } else {
        tagMap.set(tag, { name: tag, count: 1, people: [person] });
      }
    });
  });

  const tags = Array.from(tagMap.values()).sort((a, b) => b.count - a.count);

  const handleRenameTag = (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) {
      setEditingTag(null);
      return;
    }

    // Check if new name already exists
    if (tagMap.has(newName)) {
      toast.error(`Tag "${newName}" already exists`);
      return;
    }

    // Update all people with this tag
    const tagInfo = tagMap.get(oldName);
    if (tagInfo) {
      tagInfo.people.forEach((person) => {
        const newTags = person.tags.map((t) => (t === oldName ? newName : t));
        onUpdatePersonTags(person.id, newTags);
      });
      toast.success(`Renamed "${oldName}" to "${newName}"`);
    }

    setEditingTag(null);
    setNewTagName('');
  };

  const handleDeleteTag = (tagName: string) => {
    const tagInfo = tagMap.get(tagName);
    if (tagInfo) {
      tagInfo.people.forEach((person) => {
        const newTags = person.tags.filter((t) => t !== tagName);
        onUpdatePersonTags(person.id, newTags);
      });
      toast.success(`Deleted tag "${tagName}" from ${tagInfo.count} people`);
    }
  };

  const handleMergeTags = () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return;

    const sourceInfo = tagMap.get(mergeSource);
    if (sourceInfo) {
      sourceInfo.people.forEach((person) => {
        // Remove source tag and add target if not already present
        let newTags = person.tags.filter((t) => t !== mergeSource);
        if (!newTags.includes(mergeTarget)) {
          newTags.push(mergeTarget);
        }
        onUpdatePersonTags(person.id, newTags);
      });
      toast.success(`Merged "${mergeSource}" into "${mergeTarget}"`);
    }

    setShowMergeModal(false);
    setMergeSource('');
    setMergeTarget('');
  };

  const handleCreateTag = () => {
    if (!createTagName.trim() || selectedPeopleForTag.size === 0) return;

    if (tagMap.has(createTagName.trim())) {
      toast.error(`Tag "${createTagName}" already exists`);
      return;
    }

    selectedPeopleForTag.forEach((personId) => {
      const person = people.find((p) => p.id === personId);
      if (person) {
        onUpdatePersonTags(person.id, [...person.tags, createTagName.trim()]);
      }
    });

    toast.success(`Created tag "${createTagName}" for ${selectedPeopleForTag.size} people`);
    setShowCreateModal(false);
    setCreateTagName('');
    setSelectedPeopleForTag(new Set());
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Tags Manager</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            {tags.length} tags used across your congregation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMergeModal(true)}
            disabled={tags.length < 2}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors disabled:opacity-50"
          >
            <Merge size={18} />
            Merge Tags
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={18} />
            Create Tag
          </button>
        </div>
      </div>

      {/* Tags Grid */}
      {tags.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map((tag) => (
            <div
              key={tag.name}
              className="bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-4"
            >
              <div className="flex items-start justify-between mb-3">
                {editingTag === tag.name ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRenameTag(tag.name, newTagName)}
                      className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => { setEditingTag(null); setNewTagName(''); }}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800 rounded"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Tag size={16} className="text-indigo-500" />
                      <span className="font-medium text-gray-900 dark:text-dark-100">
                        {tag.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingTag(tag.name); setNewTagName(tag.name); }}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded transition-colors"
                        title="Rename"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.name)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-400 mb-3">
                <Users size={14} />
                <span>{tag.count} {tag.count === 1 ? 'person' : 'people'}</span>
              </div>

              {/* People preview */}
              <div className="flex flex-wrap gap-1">
                {tag.people.slice(0, 5).map((person) => (
                  <span
                    key={person.id}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300 rounded"
                  >
                    {person.firstName} {person.lastName[0]}.
                  </span>
                ))}
                {tag.people.length > 5 && (
                  <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-400 rounded">
                    +{tag.people.length - 5} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700">
          <Tag className="mx-auto text-gray-300 dark:text-dark-600 mb-3" size={48} />
          <p className="text-gray-500 dark:text-dark-400">No tags created yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Create your first tag
          </button>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Merge Tags
              </h2>
              <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                Combine two tags into one
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Merge this tag...
                </label>
                <select
                  value={mergeSource}
                  onChange={(e) => setMergeSource(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                >
                  <option value="">Select tag</option>
                  {tags.map((tag) => (
                    <option key={tag.name} value={tag.name} disabled={tag.name === mergeTarget}>
                      {tag.name} ({tag.count})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Into this tag...
                </label>
                <select
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                >
                  <option value="">Select tag</option>
                  {tags.map((tag) => (
                    <option key={tag.name} value={tag.name} disabled={tag.name === mergeSource}>
                      {tag.name} ({tag.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex gap-3">
              <button
                onClick={() => { setShowMergeModal(false); setMergeSource(''); setMergeTarget(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={handleMergeTags}
                disabled={!mergeSource || !mergeTarget}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Tag Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Create New Tag
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Tag Name
                </label>
                <input
                  type="text"
                  value={createTagName}
                  onChange={(e) => setCreateTagName(e.target.value)}
                  placeholder="e.g., Youth, Volunteer, New Member"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  Select People ({selectedPeopleForTag.size} selected)
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-dark-700 rounded-xl">
                  {people.map((person) => (
                    <label
                      key={person.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-dark-800 cursor-pointer border-b border-gray-100 dark:border-dark-700 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPeopleForTag.has(person.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedPeopleForTag);
                          if (e.target.checked) {
                            newSet.add(person.id);
                          } else {
                            newSet.delete(person.id);
                          }
                          setSelectedPeopleForTag(newSet);
                        }}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-900 dark:text-dark-100">
                        {person.firstName} {person.lastName}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setCreateTagName(''); setSelectedPeopleForTag(new Set()); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTag}
                disabled={!createTagName.trim() || selectedPeopleForTag.size === 0}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Create Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
