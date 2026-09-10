import {
  Activity,
  MessageCircle,
  Heart,
  Users,
  AlertCircle,
  Mail,
} from 'lucide-react';
import type { GroupCommunityStats } from '../lib/services/community';
import type { Person, SmallGroup } from '../types';

interface GroupCommunityPanelProps {
  group: SmallGroup;
  stats: GroupCommunityStats;
  people: Person[];
  onViewPerson?: (personId: string) => void;
  onEmailInactive?: (personIds: string[]) => void;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function GroupCommunityPanel({
  group,
  stats,
  people,
  onViewPerson,
  onEmailInactive,
}: GroupCommunityPanelProps) {
  void group;
  const personMap = new Map(people.map(p => [p.id, p]));

  return (
    <div className="border-t border-gray-200 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-800/50 p-5 space-y-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-dark-200">
        <Activity size={16} className="text-indigo-500" />
        Community Activity
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-dark-850 rounded-xl p-3 border border-gray-100 dark:border-dark-700">
          <div className="text-lg font-bold text-gray-900 dark:text-dark-100">{stats.posts7d}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Posts (7d)</div>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-xl p-3 border border-gray-100 dark:border-dark-700">
          <div className="text-lg font-bold text-gray-900 dark:text-dark-100">{stats.reactions7d}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Reactions</div>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-xl p-3 border border-gray-100 dark:border-dark-700">
          <div className="text-lg font-bold text-gray-900 dark:text-dark-100">{stats.activeMembers7d}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Active (7d)</div>
        </div>
        <div className="bg-white dark:bg-dark-850 rounded-xl p-3 border border-gray-100 dark:border-dark-700">
          <div className="text-lg font-bold text-amber-600">{stats.inactiveMembers.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Inactive (14d+)</div>
        </div>
      </div>

      {/* Post type breakdown */}
      {Object.keys(stats.postsByType).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.postsByType).map(([type, count]) => (
            <span key={type} className="px-2 py-1 rounded-full text-xs bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 capitalize">
              {type.replace('_', ' ')}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Recent group feed */}
      {stats.recentPosts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-400 mb-2 flex items-center gap-1.5">
            <MessageCircle size={12} />
            Recent group posts
          </h4>
          <div className="space-y-2">
            {stats.recentPosts.slice(0, 5).map((post: import('../types').CommunityPost) => {
              const author = personMap.get(post.authorPersonId);
              return (
                <div
                  key={post.id}
                  className="bg-white dark:bg-dark-850 rounded-xl p-3 border border-gray-100 dark:border-dark-700 text-sm"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <button
                      type="button"
                      onClick={() => onViewPerson?.(post.authorPersonId)}
                      className="font-medium text-gray-900 dark:text-dark-100 hover:text-indigo-600"
                    >
                      {post.authorName ?? (author ? `${author.firstName} ${author.lastName}` : 'Member')}
                    </button>
                    <span className="text-[10px] text-gray-400 capitalize">{post.postType.replace('_', ' ')}</span>
                  </div>
                  <p className="text-gray-600 dark:text-dark-300 line-clamp-2 text-xs">{post.body}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                    <span>{timeAgo(post.createdAt)}</span>
                    {(post.reactionCounts?.pray ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5"><Heart size={10} /> {post.reactionCounts!.pray}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Member engagement table */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-400 mb-2 flex items-center gap-1.5">
          <Users size={12} />
          Member engagement
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-dark-700">
                <th className="pb-2 font-medium">Member</th>
                <th className="pb-2 font-medium">Last active</th>
                <th className="pb-2 font-medium text-center">Posts</th>
                <th className="pb-2 font-medium text-center">Reactions</th>
                <th className="pb-2 font-medium text-center">Connections</th>
              </tr>
            </thead>
            <tbody>
              {stats.memberEngagement.map((row: GroupCommunityStats['memberEngagement'][number]) => {
                const person = personMap.get(row.personId);
                const isInactive = stats.inactiveMembers.includes(row.personId);
                return (
                  <tr key={row.personId} className="border-b border-gray-50 dark:border-dark-800">
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => onViewPerson?.(row.personId)}
                        className={`font-medium hover:text-indigo-600 ${isInactive ? 'text-amber-600' : 'text-gray-800 dark:text-dark-200'}`}
                      >
                        {person ? `${person.firstName} ${person.lastName}` : row.personId.slice(0, 8)}
                        {isInactive && <AlertCircle size={10} className="inline ml-1 text-amber-500" />}
                      </button>
                    </td>
                    <td className="py-2 text-gray-500">{row.lastActiveAt ? timeAgo(row.lastActiveAt) : '—'}</td>
                    <td className="py-2 text-center">{row.postsCount}</td>
                    <td className="py-2 text-center">{row.reactionsGiven}</td>
                    <td className="py-2 text-center">{row.connectionCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick actions */}
      {stats.inactiveMembers.length > 0 && onEmailInactive && (
        <button
          type="button"
          onClick={() => onEmailInactive(stats.inactiveMembers)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
        >
          <Mail size={14} />
          Email {stats.inactiveMembers.length} inactive member{stats.inactiveMembers.length !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
