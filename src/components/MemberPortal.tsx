/**
 * Member Self-Service Portal
 *
 * Allows members to view and update their own information,
 * view giving history, and manage communication preferences.
 */

import { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Calendar,
  Bell,
  Save,
  ChevronDown,
  ChevronUp,
  Download,
  LogOut,
} from 'lucide-react';

interface MemberProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  photoUrl?: string;
  memberSince?: string;
  birthday?: string;
  anniversary?: string;
}

interface GivingRecord {
  id: string;
  date: string;
  amount: number;
  fund: string;
  method: string;
}

interface VolunteerAssignment {
  id: string;
  eventTitle: string;
  role: string;
  date: string;
  status: 'confirmed' | 'pending' | 'declined';
}

interface CommunicationPrefs {
  emailNewsletter: boolean;
  emailEvents: boolean;
  smsReminders: boolean;
  smsEmergency: boolean;
  directoryOptIn: boolean;
}

interface MemberPortalProps {
  profile: MemberProfile;
  givingHistory: GivingRecord[];
  volunteerSchedule: VolunteerAssignment[];
  communicationPrefs: CommunicationPrefs;
  onProfileUpdate: (profile: Partial<MemberProfile>) => Promise<void>;
  onPrefsUpdate: (prefs: CommunicationPrefs) => Promise<void>;
  onLogout: () => void;
}

export function MemberPortal({
  profile,
  givingHistory,
  volunteerSchedule,
  communicationPrefs,
  onProfileUpdate,
  onPrefsUpdate,
  onLogout,
}: MemberPortalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'giving' | 'volunteer' | 'settings'>(
    'profile'
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(profile);
  const [prefs, setPrefs] = useState(communicationPrefs);
  const [saving, setSaving] = useState(false);
  const [expandedYear, setExpandedYear] = useState<number>(new Date().getFullYear());

  // Calculate giving totals by year
  const givingByYear = givingHistory.reduce(
    (acc, record) => {
      const year = new Date(record.date).getFullYear();
      if (!acc[year]) acc[year] = { total: 0, records: [] };
      acc[year].total += record.amount;
      acc[year].records.push(record);
      return acc;
    },
    {} as Record<number, { total: number; records: GivingRecord[] }>
  );

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await onProfileUpdate(editedProfile);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
    setSaving(false);
  };

  const handleSavePrefs = async () => {
    setSaving(true);
    try {
      await onPrefsUpdate(prefs);
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }
    setSaving(false);
  };

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'giving', label: 'Giving History', icon: DollarSign },
    { id: 'volunteer', label: 'Volunteer Schedule', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: Bell },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                  {profile.firstName[0]}
                  {profile.lastName[0]}
                </span>
              </div>
            )}
            <div>
              <h1 className="font-semibold text-gray-900 dark:text-white">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="text-sm text-gray-500">Member Portal</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === id
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Personal Information
              </h2>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedProfile(profile);
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedProfile.firstName}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                ) : (
                  <p className="py-2 text-gray-900 dark:text-white">{profile.firstName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedProfile.lastName}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                ) : (
                  <p className="py-2 text-gray-900 dark:text-white">{profile.lastName}</p>
                )}
              </div>

              {/* Contact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editedProfile.email}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                ) : (
                  <p className="py-2 text-gray-900 dark:text-white">{profile.email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editedProfile.phone || ''}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                ) : (
                  <p className="py-2 text-gray-900 dark:text-white">
                    {profile.phone || 'Not provided'}
                  </p>
                )}
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Address
                </label>
                {isEditing ? (
                  <div className="grid md:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Street"
                      value={editedProfile.address?.street || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile,
                          address: { ...editedProfile.address, street: e.target.value },
                        })
                      }
                      className="md:col-span-4 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                    <input
                      type="text"
                      placeholder="City"
                      value={editedProfile.address?.city || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile,
                          address: { ...editedProfile.address, city: e.target.value },
                        })
                      }
                      className="md:col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                    <input
                      type="text"
                      placeholder="State"
                      value={editedProfile.address?.state || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile,
                          address: { ...editedProfile.address, state: e.target.value },
                        })
                      }
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                    <input
                      type="text"
                      placeholder="ZIP"
                      value={editedProfile.address?.zip || ''}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile,
                          address: { ...editedProfile.address, zip: e.target.value },
                        })
                      }
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                  </div>
                ) : (
                  <p className="py-2 text-gray-900 dark:text-white">
                    {profile.address?.street ? (
                      <>
                        {profile.address.street}
                        <br />
                        {profile.address.city}, {profile.address.state} {profile.address.zip}
                      </>
                    ) : (
                      'Not provided'
                    )}
                  </p>
                )}
              </div>

              {/* Special Dates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Birthday
                </label>
                {isEditing ? (
                  <input
                    type="date"
                    value={editedProfile.birthday || ''}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, birthday: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                ) : (
                  <p className="py-2 text-gray-900 dark:text-white">
                    {profile.birthday
                      ? new Date(profile.birthday).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'Not provided'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Anniversary
                </label>
                {isEditing ? (
                  <input
                    type="date"
                    value={editedProfile.anniversary || ''}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, anniversary: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                ) : (
                  <p className="py-2 text-gray-900 dark:text-white">
                    {profile.anniversary
                      ? new Date(profile.anniversary).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'Not provided'}
                  </p>
                )}
              </div>
            </div>

            {profile.memberSince && (
              <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                Member since{' '}
                {new Date(profile.memberSince).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        )}

        {/* Giving History Tab */}
        {activeTab === 'giving' && (
          <div className="space-y-4">
            {/* Year Summary */}
            {Object.entries(givingByYear)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([year, { total, records }]) => (
                <div
                  key={year}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedYear(expandedYear === Number(year) ? 0 : Number(year))}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-gray-900 dark:text-white">{year}</span>
                      <span className="text-sm text-gray-500">
                        ({records.length} contribution{records.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-green-600">
                        ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      {expandedYear === Number(year) ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {expandedYear === Number(year) && (
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">
                                Date
                              </th>
                              <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">
                                Fund
                              </th>
                              <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">
                                Method
                              </th>
                              <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-400">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {records
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .map((record) => (
                                <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                                    {new Date(record.date).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                    {record.fund}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                    {record.method}
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                                    ${record.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-900/50 flex justify-end">
                        <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg">
                          <Download className="w-4 h-4" />
                          Download {year} Statement
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

            {Object.keys(givingByYear).length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
                <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No giving records found</p>
              </div>
            )}
          </div>
        )}

        {/* Volunteer Schedule Tab */}
        {activeTab === 'volunteer' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Upcoming Assignments</h2>
            </div>
            {volunteerSchedule.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {volunteerSchedule
                  .filter((a) => new Date(a.date) >= new Date())
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((assignment) => (
                    <div key={assignment.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex flex-col items-center justify-center">
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                            {new Date(assignment.date).toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                          <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                            {new Date(assignment.date).getDate()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {assignment.eventTitle}
                          </p>
                          <p className="text-sm text-gray-500">{assignment.role}</p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          assignment.status === 'confirmed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : assignment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {assignment.status}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No upcoming volunteer assignments</p>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Communication Preferences
                </h2>
                <p className="text-sm text-gray-500">
                  Choose how you want to hear from us
                </p>
              </div>
              <button
                onClick={handleSavePrefs}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div className="space-y-6">
              {/* Email Preferences */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </h3>
                <div className="space-y-3 ml-6">
                  <label className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Weekly newsletter</span>
                    <input
                      type="checkbox"
                      checked={prefs.emailNewsletter}
                      onChange={(e) => setPrefs({ ...prefs, emailNewsletter: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Event announcements</span>
                    <input
                      type="checkbox"
                      checked={prefs.emailEvents}
                      onChange={(e) => setPrefs({ ...prefs, emailEvents: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                  </label>
                </div>
              </div>

              {/* SMS Preferences */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Text Messages
                </h3>
                <div className="space-y-3 ml-6">
                  <label className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Volunteer reminders</span>
                    <input
                      type="checkbox"
                      checked={prefs.smsReminders}
                      onChange={(e) => setPrefs({ ...prefs, smsReminders: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Emergency alerts</span>
                    <input
                      type="checkbox"
                      checked={prefs.smsEmergency}
                      onChange={(e) => setPrefs({ ...prefs, smsEmergency: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                  </label>
                </div>
              </div>

              {/* Directory Preferences */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-gray-900 dark:text-white font-medium">
                      Include me in the member directory
                    </span>
                    <p className="text-sm text-gray-500">
                      Your name, photo, and contact info will be visible to other members
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.directoryOptIn}
                    onChange={(e) => setPrefs({ ...prefs, directoryOptIn: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
