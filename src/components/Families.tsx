import { useState, useMemo } from 'react';
import {
  Home,
  Users,
  Plus,
  Search,
  UserPlus,
  UserMinus,
  X,
  MapPin,
  Phone,
  Mail,
  Crown,
  ChevronRight,
} from 'lucide-react';
import { Person, Family } from '../types';

interface FamiliesProps {
  people: Person[];
  onSelectPerson: (id: string) => void;
  onUpdatePerson: (person: Person) => Promise<void>;
}

export function Families({ people, onSelectPerson, onUpdatePerson }: FamiliesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState<string | null>(null);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  // Group people into families
  const families = useMemo(() => {
    const familyMap = new Map<string, Family>();

    people.forEach(person => {
      if (person.familyId) {
        if (!familyMap.has(person.familyId)) {
          // Create family entry
          const familyMembers = people.filter(p => p.familyId === person.familyId);
          const lastName = familyMembers[0]?.lastName || 'Unknown';

          // Find member with most complete address
          const memberWithAddress = familyMembers.find(m => m.address) || familyMembers[0];

          familyMap.set(person.familyId, {
            id: person.familyId,
            name: `${lastName} Family`,
            members: familyMembers,
            address: memberWithAddress?.address,
            city: memberWithAddress?.city,
            state: memberWithAddress?.state,
            zip: memberWithAddress?.zip,
            headOfHousehold: familyMembers.find(m => m.status === 'leader' || m.status === 'member')?.id,
          });
        }
      }
    });

    return Array.from(familyMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [people]);

  // People without a family
  const unassignedPeople = useMemo(() => {
    return people.filter(p => !p.familyId);
  }, [people]);

  // Filter families by search
  const filteredFamilies = useMemo(() => {
    if (!searchQuery) return families;
    const query = searchQuery.toLowerCase();
    return families.filter(f =>
      f.name.toLowerCase().includes(query) ||
      f.members.some(m =>
        m.firstName.toLowerCase().includes(query) ||
        m.lastName.toLowerCase().includes(query)
      )
    );
  }, [families, searchQuery]);

  // Search unassigned people for adding to family
  const searchablePeople = useMemo(() => {
    if (!memberSearch) return unassignedPeople.slice(0, 10);
    const query = memberSearch.toLowerCase();
    return people.filter(p =>
      (p.firstName.toLowerCase().includes(query) ||
       p.lastName.toLowerCase().includes(query) ||
       p.email.toLowerCase().includes(query)) &&
      p.familyId !== showAddMemberModal
    ).slice(0, 10);
  }, [people, unassignedPeople, memberSearch, showAddMemberModal]);

  const createFamily = () => {
    if (!newFamilyName.trim()) return;

    // Generate a family ID
    const familyId = `fam-${Date.now()}`;

    // We'll need to assign at least one person to this family
    // For now, just close the modal - user will add members next
    setShowCreateModal(false);
    setNewFamilyName('');
    setShowAddMemberModal(familyId);
  };

  const addMemberToFamily = (person: Person, familyId: string) => {
    onUpdatePerson({ ...person, familyId });
    setMemberSearch('');
  };

  const removeMemberFromFamily = (person: Person) => {
    onUpdatePerson({ ...person, familyId: undefined });
  };

  const getStatusColor = (status: Person['status']) => {
    switch (status) {
      case 'member': return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400';
      case 'leader': return 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400';
      case 'regular': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400';
      case 'visitor': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-dark-300';
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Families</h1>
            <p className="text-gray-500 dark:text-dark-400 mt-1">
              {families.length} households · {unassignedPeople.length} unassigned
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <Plus size={18} />
            New Family
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search families..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg flex items-center justify-center">
                <Home size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{families.length}</p>
                <p className="text-sm text-gray-500 dark:text-dark-400">Households</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-lg flex items-center justify-center">
                <Users size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                  {families.reduce((acc, f) => acc + f.members.length, 0)}
                </p>
                <p className="text-sm text-gray-500 dark:text-dark-400">In Families</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-lg flex items-center justify-center">
                <UserPlus size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{unassignedPeople.length}</p>
                <p className="text-sm text-gray-500 dark:text-dark-400">Unassigned</p>
              </div>
            </div>
          </div>
        </div>

        {/* Family Cards */}
        <div className="space-y-4">
          {filteredFamilies.map(family => (
            <div
              key={family.id}
              className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden"
            >
              {/* Family Header */}
              <div className="p-4 bg-gray-50 dark:bg-dark-850 border-b border-gray-200 dark:border-dark-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg flex items-center justify-center">
                      <Home size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-dark-100">{family.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-dark-400">
                        {family.members.length} member{family.members.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddMemberModal(family.id)}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                      title="Add member"
                    >
                      <UserPlus size={18} />
                    </button>
                  </div>
                </div>
                {family.address && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-dark-400">
                    <MapPin size={14} />
                    <span>
                      {family.address}
                      {family.city && `, ${family.city}`}
                      {family.state && `, ${family.state}`}
                      {family.zip && ` ${family.zip}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Family Members */}
              <div className="divide-y divide-gray-100 dark:divide-dark-700">
                {family.members.map(member => (
                  <div
                    key={member.id}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-850 transition-colors"
                  >
                    <button
                      onClick={() => onSelectPerson(member.id)}
                      className="flex items-center gap-3 text-left flex-1"
                    >
                      {member.photo ? (
                        <img
                          src={member.photo}
                          alt={`${member.firstName} ${member.lastName}`}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 dark:bg-dark-700 rounded-full flex items-center justify-center text-gray-500 dark:text-dark-400 font-medium">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-dark-100">
                            {member.firstName} {member.lastName}
                          </span>
                          {family.headOfHousehold === member.id && (
                            <span title="Head of household">
                              <Crown size={14} className="text-amber-500" />
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(member.status)}`}>
                            {member.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-dark-400">
                          {member.email && (
                            <span className="flex items-center gap-1">
                              <Mail size={12} />
                              {member.email}
                            </span>
                          )}
                          {member.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={12} />
                              {member.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeMemberFromFamily(member)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Remove from family"
                      >
                        <UserMinus size={16} />
                      </button>
                      <ChevronRight size={16} className="text-gray-300 dark:text-dark-600" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredFamilies.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
              <Home size={48} className="mx-auto text-gray-300 dark:text-dark-600 mb-4" />
              <p className="text-gray-500 dark:text-dark-400">No families found</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Create a family
              </button>
            </div>
          )}
        </div>

        {/* Unassigned People Section */}
        {unassignedPeople.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">
              Unassigned People
            </h2>
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-dark-700">
                {unassignedPeople.slice(0, 10).map(person => (
                  <div
                    key={person.id}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-850 transition-colors"
                  >
                    <button
                      onClick={() => onSelectPerson(person.id)}
                      className="flex items-center gap-3 text-left"
                    >
                      {person.photo ? (
                        <img
                          src={person.photo}
                          alt={`${person.firstName} ${person.lastName}`}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 dark:bg-dark-700 rounded-full flex items-center justify-center text-gray-500 dark:text-dark-400 font-medium">
                          {person.firstName[0]}{person.lastName[0]}
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-gray-900 dark:text-dark-100">
                          {person.firstName} {person.lastName}
                        </span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${getStatusColor(person.status)}`}>
                          {person.status}
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setShowAddMemberModal('new');
                        setMemberSearch(`${person.firstName} ${person.lastName}`);
                      }}
                      className="px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                    >
                      Assign to family
                    </button>
                  </div>
                ))}
                {unassignedPeople.length > 10 && (
                  <div className="p-4 text-center text-sm text-gray-500 dark:text-dark-400">
                    And {unassignedPeople.length - 10} more...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Family Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Create Family</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Family Name
                </label>
                <input
                  type="text"
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  placeholder="e.g., Smith Family"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-dark-400">
                After creating the family, you can add members to it.
              </p>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={createFamily}
                disabled={!newFamilyName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
              >
                Create & Add Members
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">Add Family Member</h2>
                <button
                  onClick={() => {
                    setShowAddMemberModal(null);
                    setMemberSearch('');
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-11 pr-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {searchablePeople.map(person => (
                  <button
                    key={person.id}
                    onClick={() => addMemberToFamily(person, showAddMemberModal)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors text-left"
                  >
                    {person.photo ? (
                      <img
                        src={person.photo}
                        alt={`${person.firstName} ${person.lastName}`}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-200 dark:bg-dark-700 rounded-full flex items-center justify-center text-gray-500 dark:text-dark-400 font-medium">
                        {person.firstName[0]}{person.lastName[0]}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-dark-100">
                        {person.firstName} {person.lastName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-dark-400">
                        {person.email}
                        {person.familyId && (
                          <span className="ml-2 text-amber-600 dark:text-amber-400">
                            (already in a family)
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                {searchablePeople.length === 0 && (
                  <p className="text-center py-4 text-gray-500 dark:text-dark-400">
                    No people found
                  </p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-dark-700">
              <button
                onClick={() => {
                  setShowAddMemberModal(null);
                  setMemberSearch('');
                }}
                className="w-full px-4 py-2 text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
