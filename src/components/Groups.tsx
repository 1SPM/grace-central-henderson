import { useState, useMemo, useCallback } from 'react';
import { Users2, MapPin, Clock, User, Plus, ChevronDown, ChevronUp, UserPlus, UserMinus, Edit2, X, Check, Search, Mail } from 'lucide-react';
import { SmallGroup, Person } from '../types';

interface GroupsProps {
  groups: SmallGroup[];
  people: Person[];
  onCreateGroup?: (group: Omit<SmallGroup, 'id'>) => void;
  onAddMember?: (groupId: string, personId: string) => void;
  onRemoveMember?: (groupId: string, personId: string) => void;
  onEmailGroup?: (groupId: string) => void;
}

export function Groups({ groups, people, onCreateGroup, onAddMember, onRemoveMember, onEmailGroup }: GroupsProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [addingMemberTo, setAddingMemberTo] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  // Memoize active groups filter
  const activeGroups = useMemo(() => groups.filter(g => g.isActive), [groups]);

  // Memoize person lookup map for O(1) access
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  // Get people not in a specific group
  const getAvailablePeople = useCallback((groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];
    return people.filter(p =>
      !group.members.includes(p.id) &&
      (p.status === 'member' || p.status === 'regular' || p.status === 'leader')
    );
  }, [groups, people]);

  // Filter available people by search
  const filteredAvailablePeople = useMemo(() => {
    if (!addingMemberTo) return [];
    const available = getAvailablePeople(addingMemberTo);
    if (!memberSearch) return available;
    const searchLower = memberSearch.toLowerCase();
    return available.filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchLower)
    );
  }, [addingMemberTo, memberSearch, getAvailablePeople]);

  // Stats
  const totalMembers = useMemo(() => {
    const uniqueMembers = new Set<string>();
    activeGroups.forEach(g => g.members.forEach(m => uniqueMembers.add(m)));
    return uniqueMembers.size;
  }, [activeGroups]);

  const handleCreateGroup = (groupData: Omit<SmallGroup, 'id'>) => {
    if (onCreateGroup) {
      onCreateGroup(groupData);
    }
    setShowCreateModal(false);
  };

  const handleAddMember = (groupId: string, personId: string) => {
    if (onAddMember) {
      onAddMember(groupId, personId);
    } else {
      // Local state update for demo
      const group = groups.find(g => g.id === groupId);
      if (group && !group.members.includes(personId)) {
        group.members.push(personId);
      }
    }
  };

  const handleRemoveMember = (groupId: string, personId: string) => {
    if (onRemoveMember) {
      onRemoveMember(groupId, personId);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Small Groups</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            {activeGroups.length} groups · {totalMembers} members
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
        >
          <Plus size={18} />
          New Group
        </button>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {activeGroups.map((group) => {
          const leader = group.leaderId ? personMap.get(group.leaderId) : undefined;
          const members = group.members.map(id => personMap.get(id)).filter(Boolean) as Person[];
          const isExpanded = expandedGroup === group.id;
          const isAddingMember = addingMemberTo === group.id;

          return (
            <div
              key={group.id}
              className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden"
            >
              {/* Group Header */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Users2 className="text-white" size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">{group.name}</h2>
                      {group.description && (
                        <p className="text-sm text-gray-500 dark:text-dark-400 mt-0.5 line-clamp-1">{group.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingGroup(editingGroup === group.id ? null : group.id)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} className="text-gray-400" />
                  </button>
                </div>

                {/* Group Details */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-dark-300">
                  {leader && (
                    <div className="flex items-center gap-1.5">
                      <User size={14} className="text-gray-400 dark:text-dark-500" />
                      <span>{leader.firstName} {leader.lastName}</span>
                    </div>
                  )}
                  {group.meetingDay && group.meetingTime && (
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className="text-gray-400 dark:text-dark-500" />
                      <span>{group.meetingDay}s · {group.meetingTime}</span>
                    </div>
                  )}
                  {group.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-gray-400 dark:text-dark-500" />
                      <span>{group.location}</span>
                    </div>
                  )}
                </div>

                {/* Members Preview */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {members.slice(0, 4).map((member) => (
                        member.photo ? (
                          <img
                            key={member.id}
                            src={member.photo}
                            alt={`${member.firstName} ${member.lastName}`}
                            className="w-8 h-8 rounded-full border-2 border-white dark:border-dark-850 object-cover"
                            title={`${member.firstName} ${member.lastName}`}
                          />
                        ) : (
                          <div
                            key={member.id}
                            className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-dark-850"
                            title={`${member.firstName} ${member.lastName}`}
                          >
                            {member.firstName[0]}{member.lastName[0]}
                          </div>
                        )
                      ))}
                      {members.length > 4 && (
                        <div className="w-8 h-8 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center text-gray-500 dark:text-dark-300 text-xs font-medium border-2 border-white dark:border-dark-850">
                          +{members.length - 4}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-dark-400">
                      {members.length} member{members.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {onEmailGroup && members.length > 0 && (
                      <button
                        onClick={() => onEmailGroup(group.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                      >
                        <Mail size={16} />
                        Email
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setAddingMemberTo(isAddingMember ? null : group.id);
                        setMemberSearch('');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors"
                    >
                      <UserPlus size={16} />
                      Add
                    </button>
                    <button
                      onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {isExpanded ? 'Less' : 'More'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Add Member Panel */}
              {isAddingMember && (
                <div className="px-5 pb-4 border-t border-gray-100 dark:border-dark-700 pt-4">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search people to add..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredAvailablePeople.slice(0, 10).map(person => (
                      <button
                        key={person.id}
                        onClick={() => handleAddMember(group.id, person.id)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-lg transition-colors text-left"
                      >
                        {person.photo ? (
                          <img src={person.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                            {person.firstName[0]}{person.lastName[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                            {person.firstName} {person.lastName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-dark-400 truncate">{person.email}</p>
                        </div>
                        <Plus size={16} className="text-purple-600 dark:text-purple-400" />
                      </button>
                    ))}
                    {filteredAvailablePeople.length === 0 && (
                      <p className="text-sm text-gray-400 dark:text-dark-500 text-center py-4">
                        {memberSearch ? 'No matching people found' : 'All members are already in this group'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Expanded Member List */}
              {isExpanded && !isAddingMember && (
                <div className="px-5 pb-4 border-t border-gray-100 dark:border-dark-700">
                  <p className="text-xs font-medium text-gray-400 dark:text-dark-500 uppercase tracking-wider py-3">
                    All Members
                  </p>
                  <div className="space-y-1">
                    {members.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-lg group"
                      >
                        {member.photo ? (
                          <img src={member.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                            {member.firstName[0]}{member.lastName[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                            {member.firstName} {member.lastName}
                            {member.id === group.leaderId && (
                              <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded-full">
                                Leader
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-dark-400 truncate">{member.email || member.phone}</p>
                        </div>
                        {onRemoveMember && member.id !== group.leaderId && (
                          <button
                            onClick={() => handleRemoveMember(group.id, member.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove from group"
                          >
                            <UserMinus size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    {members.length === 0 && (
                      <p className="text-sm text-gray-400 dark:text-dark-500 text-center py-4">
                        No members yet. Click "Add" to add members.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {activeGroups.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users2 className="text-purple-600 dark:text-purple-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-2">No small groups yet</h3>
          <p className="text-gray-500 dark:text-dark-400 mb-6 max-w-sm mx-auto">
            Small groups help your congregation connect and grow together in community.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
          >
            <Plus size={18} />
            Create Your First Group
          </button>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal
          people={people}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateGroup}
        />
      )}
    </div>
  );
}

// Create Group Modal Component
interface CreateGroupModalProps {
  people: Person[];
  onClose: () => void;
  onCreate: (group: Omit<SmallGroup, 'id'>) => void;
}

function CreateGroupModal({ people, onClose, onCreate }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [meetingDay, setMeetingDay] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [location, setLocation] = useState('');

  const leaders = people.filter(p => p.status === 'leader' || p.status === 'member');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      leaderId: leaderId || '',
      members: leaderId ? [leaderId] : [],
      meetingDay: meetingDay || undefined,
      meetingTime: meetingTime || undefined,
      location: location.trim() || undefined,
      isActive: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Create New Group</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
              Group Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Young Adults, Men's Bible Study"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
              Group Leader
            </label>
            <select
              value={leaderId}
              onChange={(e) => setLeaderId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select a leader...</option>
              {leaders.map(person => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                Meeting Day
              </label>
              <select
                value={meetingDay}
                onChange={(e) => setMeetingDay(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select day...</option>
                <option value="Sunday">Sunday</option>
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                Meeting Time
              </label>
              <input
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Room 101, Smith's Home"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
