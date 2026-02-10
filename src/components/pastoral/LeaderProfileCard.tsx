import { useState } from 'react';
import { MessageCircle, Clock, BookOpen, Globe, Sparkles, Calendar, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { LeaderProfile, HelpCategory } from '../../types';
import { VerifiedBadge } from './VerifiedBadge';

interface LeaderProfileCardProps {
  leader: LeaderProfile;
  onStartChat: (leaderId: string) => void;
  onEdit?: (leader: LeaderProfile) => void;
  onDelete?: (leaderId: string) => void;
  onToggleAvailability?: (leaderId: string) => void;
  activeConversations?: number;
  expanded?: boolean;
}

const CATEGORY_LABELS: Record<HelpCategory, string> = {
  'marriage': 'Marriage',
  'addiction': 'Recovery',
  'grief': 'Grief',
  'faith-questions': 'Faith',
  'crisis': 'Crisis',
  'financial': 'Financial',
  'anxiety-depression': 'Mental Health',
  'parenting': 'Parenting',
  'general': 'General',
};

type ProfileTab = 'expertise' | 'spiritual';

export function LeaderProfileCard({ leader, onStartChat, onEdit, onDelete, onToggleAvailability, activeConversations = 0, expanded = false }: LeaderProfileCardProps) {
  const [tab, setTab] = useState<ProfileTab>('expertise');
  const [isExpanded, setIsExpanded] = useState(expanded);

  const initials = leader.displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {leader.photo ? (
              <img
                src={leader.photo}
                alt={leader.displayName}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xl">
                {initials}
              </div>
            )}
            <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white dark:border-dark-800 ${
              leader.isAvailable ? 'bg-emerald-500' : 'bg-gray-400'
            }`} />
          </div>

          {/* Name / Title / Badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                {leader.displayName}
              </h3>
              {leader.isVerified && <VerifiedBadge />}
              {leader.isAvailable && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{leader.title}</p>

            {/* Quick stats row */}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
              {leader.yearsOfPractice && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  {leader.yearsOfPractice} yrs experience
                </span>
              )}
              {leader.language && leader.language !== 'English' && (
                <span className="flex items-center gap-1">
                  <Globe size={11} />
                  {leader.language}
                </span>
              )}
              {activeConversations > 0 && (
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {activeConversations} active
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 line-clamp-2">{leader.bio}</p>

        {/* Credential tags */}
        {leader.credentials.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {leader.credentials.map(cred => (
              <span
                key={cred}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
              >
                {cred}
              </span>
            ))}
          </div>
        )}

        {/* Expertise tags */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {leader.expertiseAreas.map(area => (
            <span
              key={area}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400"
            >
              {CATEGORY_LABELS[area]}
            </span>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <button
            onClick={() => onStartChat(leader.id)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <MessageCircle size={14} />
            Start Chat
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors"
          >
            {isExpanded ? 'Hide Profile' : 'View Profile'}
          </button>
          {onEdit && (
            <button
              onClick={() => onEdit(leader)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors"
              title="Edit profile"
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
          {onToggleAvailability && (
            <button
              onClick={() => onToggleAvailability(leader.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                leader.isAvailable
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                  : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600'
              }`}
              title={leader.isAvailable ? 'Set offline' : 'Set online'}
            >
              {leader.isAvailable ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              {leader.isAvailable ? 'Online' : 'Offline'}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => {
                if (confirm(`Remove ${leader.displayName} from pastoral care?`)) {
                  onDelete(leader.id);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors"
              title="Remove leader"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded profile */}
      {isExpanded && (
        <>
          {/* Tabs */}
          <div className="flex border-t border-b border-gray-200 dark:border-gray-700/50">
            <button
              onClick={() => setTab('expertise')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
                tab === 'expertise'
                  ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 dark:border-violet-400 bg-violet-50/50 dark:bg-violet-500/5'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Areas & Expertise
            </button>
            <button
              onClick={() => setTab('spiritual')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
                tab === 'spiritual'
                  ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 dark:border-violet-400 bg-violet-50/50 dark:bg-violet-500/5'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Spiritual Insights
            </button>
          </div>

          <div className="p-5 space-y-4">
            {tab === 'expertise' && (
              <>
                {/* Credentials */}
                {leader.credentials.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                      <BookOpen size={13} />
                      Education & Credentials
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {leader.credentials.map(cred => (
                        <span key={cred} className="text-xs px-2.5 py-1 rounded-md bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300">
                          {cred}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expertise areas */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Areas of Expertise</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {leader.expertiseAreas.map(area => (
                      <span key={area} className="text-xs px-2.5 py-1 rounded-md bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400">
                        {CATEGORY_LABELS[area]}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Personality traits */}
                {leader.personalityTraits.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                      <Sparkles size={13} />
                      Personality
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {leader.personalityTraits.map(trait => (
                        <span key={trait} className="text-xs px-2.5 py-1 rounded-md bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suitable for */}
                {leader.suitableFor && leader.suitableFor.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Suitable For</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {leader.suitableFor.map(group => (
                        <span key={group} className="text-xs px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
                          {group}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === 'spiritual' && (
              <>
                {/* Spiritual focus areas */}
                {leader.spiritualFocusAreas.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Spiritual Focus Areas</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {leader.spiritualFocusAreas.map(area => (
                        <span key={area} className="text-xs px-2.5 py-1 rounded-md bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Anchor verse */}
                {leader.anchors && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Guiding Scripture</h4>
                    <blockquote className="text-sm text-gray-600 dark:text-gray-400 italic border-l-2 border-violet-400 pl-3">
                      {leader.anchors}
                    </blockquote>
                  </div>
                )}

                {/* Session info */}
                {(leader.sessionType || leader.sessionFrequency) && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Session Details</h4>
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      {leader.sessionType && <p>Type: {leader.sessionType === 'one-time' ? 'One-time' : 'Recurring'}</p>}
                      {leader.sessionFrequency && <p>Frequency: {leader.sessionFrequency}</p>}
                    </div>
                  </div>
                )}

                {/* Ministry date */}
                {leader.socialMinistryDate && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">In Ministry Since</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(leader.socialMinistryDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* CTA */}
          <div className="px-5 pb-5">
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-white mb-2">Ready to begin your spiritual journey?</p>
              <button
                onClick={() => onStartChat(leader.id)}
                className="px-5 py-2 bg-white text-violet-700 text-sm font-semibold rounded-lg hover:bg-violet-50 transition-colors"
              >
                Start Your Session
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
