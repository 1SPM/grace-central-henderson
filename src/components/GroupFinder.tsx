/**
 * Group Finder Component
 *
 * Public-facing page for visitors to browse and express interest in small groups.
 * No login required - collects contact info when someone is interested.
 */

import { useState, useMemo } from 'react';
import {
  Users,
  MapPin,
  Calendar,
  Search,
  Filter,
  Heart,
  Check,
  X,
  ChevronDown,
  Mail,
  Phone,
  User,
} from 'lucide-react';

interface SmallGroup {
  id: string;
  name: string;
  description?: string;
  leaderName: string;
  leaderEmail?: string;
  meetingDay?: string;
  meetingTime?: string;
  location?: string;
  category?: string;
  isActive: boolean;
  memberCount?: number;
  maxMembers?: number;
}

interface GroupFinderProps {
  groups: SmallGroup[];
  churchName: string;
  onInterestSubmit?: (groupId: string, contactInfo: ContactInfo) => Promise<void>;
}

interface ContactInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  message?: string;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CATEGORY_COLORS: Record<string, string> = {
  'mens': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'womens': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'couples': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'young-adults': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'seniors': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'mixed': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  'bible-study': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  'prayer': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'service': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export function GroupFinder({ groups, churchName, onInterestSubmit }: GroupFinderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Interest form state
  const [selectedGroup, setSelectedGroup] = useState<SmallGroup | null>(null);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get unique categories from groups
  const categories = useMemo(() => {
    const cats = new Set<string>();
    groups.forEach((g) => g.category && cats.add(g.category));
    return Array.from(cats);
  }, [groups]);

  // Get unique meeting days
  const meetingDays = useMemo(() => {
    const days = new Set<string>();
    groups.forEach((g) => g.meetingDay && days.add(g.meetingDay));
    return DAYS_OF_WEEK.filter((d) => days.has(d));
  }, [groups]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      // Only show active groups
      if (!group.isActive) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = group.name.toLowerCase().includes(query);
        const matchesDesc = group.description?.toLowerCase().includes(query);
        const matchesLeader = group.leaderName.toLowerCase().includes(query);
        const matchesLocation = group.location?.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesLeader && !matchesLocation) {
          return false;
        }
      }

      // Day filter
      if (selectedDay && group.meetingDay !== selectedDay) {
        return false;
      }

      // Category filter
      if (selectedCategory && group.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [groups, searchQuery, selectedDay, selectedCategory]);

  const handleInterestClick = (group: SmallGroup) => {
    setSelectedGroup(group);
    setShowInterestModal(true);
    setSubmitted(false);
    setError(null);
  };

  const handleSubmitInterest = async () => {
    if (!selectedGroup || !contactInfo.firstName || !contactInfo.email) {
      setError('Please fill in required fields');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (onInterestSubmit) {
        await onInterestSubmit(selectedGroup.id, contactInfo);
      }
      setSubmitted(true);
      // Reset form after short delay
      setTimeout(() => {
        setContactInfo({ firstName: '', lastName: '', email: '', phone: '', message: '' });
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowInterestModal(false);
    setSelectedGroup(null);
    setSubmitted(false);
    setError(null);
  };

  const getCategoryColor = (category?: string) => {
    if (!category) return CATEGORY_COLORS['mixed'];
    return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS['mixed'];
  };

  const formatCategory = (category?: string) => {
    if (!category) return 'General';
    return category
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Find Your Group
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Small groups are the best way to connect and grow at {churchName}.
          Find a group that fits your schedule and interests.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, leader, or location..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {/* Filter Options */}
        {showFilters && (
          <div className="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            {/* Day Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Meeting Day
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="">Any Day</option>
                {meetingDays.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{formatCategory(cat)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Clear Filters */}
            {(selectedDay || selectedCategory) && (
              <button
                onClick={() => {
                  setSelectedDay('');
                  setSelectedCategory('');
                }}
                className="self-end px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results Count */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {filteredGroups.length} group{filteredGroups.length !== 1 ? 's' : ''} found
      </p>

      {/* Groups Grid */}
      {filteredGroups.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-5">
                {/* Category Badge */}
                {group.category && (
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full mb-3 ${getCategoryColor(group.category)}`}>
                    {formatCategory(group.category)}
                  </span>
                )}

                {/* Group Name */}
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
                  {group.name}
                </h3>

                {/* Description */}
                {group.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {group.description}
                  </p>
                )}

                {/* Details */}
                <div className="space-y-2 mb-4">
                  {/* Leader */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <User className="w-4 h-4" />
                    <span>Led by {group.leaderName}</span>
                  </div>

                  {/* Meeting Day/Time */}
                  {(group.meetingDay || group.meetingTime) && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {group.meetingDay}
                        {group.meetingTime && ` at ${group.meetingTime}`}
                      </span>
                    </div>
                  )}

                  {/* Location */}
                  {group.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4" />
                      <span>{group.location}</span>
                    </div>
                  )}

                  {/* Member Count */}
                  {group.memberCount !== undefined && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Users className="w-4 h-4" />
                      <span>
                        {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                        {group.maxMembers && ` (max ${group.maxMembers})`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Interest Button */}
                <button
                  onClick={() => handleInterestClick(group)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Heart className="w-4 h-4" />
                  I'm Interested
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No groups found matching your criteria</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedDay('');
              setSelectedCategory('');
            }}
            className="mt-2 text-indigo-600 dark:text-indigo-400 text-sm hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Interest Modal */}
      {showInterestModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {submitted ? 'Thank You!' : `Join ${selectedGroup.name}`}
                </h2>
                {!submitted && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    The group leader will contact you soon
                  </p>
                )}
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            {submitted ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Interest Submitted!
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {selectedGroup.leaderName} will reach out to you soon about joining {selectedGroup.name}.
                </p>
                <button
                  onClick={closeModal}
                  className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      First Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={contactInfo.firstName}
                        onChange={(e) => setContactInfo({ ...contactInfo, firstName: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={contactInfo.lastName}
                      onChange={(e) => setContactInfo({ ...contactInfo, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={contactInfo.email}
                      onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                      required
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone (optional)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={contactInfo.phone}
                      onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Message (optional)
                  </label>
                  <textarea
                    value={contactInfo.message}
                    onChange={(e) => setContactInfo({ ...contactInfo, message: e.target.value })}
                    placeholder="Any questions or things the leader should know?"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 resize-none"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleSubmitInterest}
                  disabled={submitting || !contactInfo.firstName || !contactInfo.email}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit Interest'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
