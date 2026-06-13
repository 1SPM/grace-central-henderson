import { CommunityPostCard } from './CommunityPostCard';
import { PostComposer } from './PostComposer';
import type { CommunityFeedFilter, SmallGroup } from '../../../types';
import type { CommunityPost, CommunityReactionType } from '../../../types';

const FILTERS: { id: CommunityFeedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'blessing', label: 'Blessings' },
  { id: 'prayer', label: 'Prayer' },
  { id: 'milestone', label: 'Milestones' },
  { id: 'event', label: 'Events' },
  { id: 'group', label: '+ Groups' },
];

interface CommunityFeedProps {
  posts: CommunityPost[];
  filter: CommunityFeedFilter;
  onFilterChange: (f: CommunityFeedFilter) => void;
  isLoading?: boolean;
  groups?: SmallGroup[];
  memberGroupIds?: string[];
  currentPersonId?: string;
  onSubmitPost: (input: { postType: import('../../../types').CommunityPostType; body: string; groupId?: string }) => Promise<unknown>;
  onReact: (postId: string, type: CommunityReactionType, groupId?: string) => void;
  onComment: (postId: string, body: string, groupId?: string) => void;
}

export function CommunityFeed({
  posts,
  filter,
  onFilterChange,
  isLoading,
  groups,
  memberGroupIds,
  currentPersonId,
  onSubmitPost,
  onReact,
  onComment,
}: CommunityFeedProps) {
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-dark-850 text-gray-600 dark:text-dark-300 border border-gray-200 dark:border-dark-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <PostComposer
        groups={groups}
        memberGroupIds={memberGroupIds}
        onSubmit={onSubmitPost}
        disabled={!currentPersonId}
      />

      {isLoading ? (
        <div className="text-center py-8 text-sm text-gray-400">Loading community feed...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">No posts yet. Be the first to share!</div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <CommunityPostCard
              key={post.id}
              post={post}
              onReact={onReact}
              onComment={onComment}
              canInteract={!!currentPersonId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
