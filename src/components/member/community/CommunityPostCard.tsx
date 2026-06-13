import { useState } from 'react';
import {
  Heart,
  Sparkles,
  MessageCircle,
  Share2,
  PartyPopper,
  Calendar,
  Users,
  BookOpen,
  Trophy,
} from 'lucide-react';
import type { CommunityPost, CommunityReactionType } from '../../../types';

interface CommunityPostCardProps {
  post: CommunityPost;
  onReact: (postId: string, type: CommunityReactionType, groupId?: string) => void;
  onComment: (postId: string, body: string, groupId?: string) => void;
  canInteract?: boolean;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Heart; color: string }> = {
  prayer: { label: 'Prayer', icon: Heart, color: 'text-pink-600 bg-pink-50 dark:bg-pink-500/10' },
  blessing: { label: 'Blessing', icon: Sparkles, color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
  praise: { label: 'Praise', icon: PartyPopper, color: 'text-green-600 bg-green-50 dark:bg-green-500/10' },
  milestone: { label: 'Milestone', icon: Trophy, color: 'text-purple-600 bg-purple-50 dark:bg-purple-500/10' },
  event: { label: 'Event', icon: Calendar, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10' },
  group_activity: { label: 'Group', icon: Users, color: 'text-slate-600 bg-slate-50 dark:bg-slate-500/10' },
  scripture: { label: 'Scripture', icon: BookOpen, color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10' },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function CommunityPostCard({ post, onReact, onComment, canInteract = true }: CommunityPostCardProps) {
  const [showComment, setShowComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const cfg = TYPE_CONFIG[post.postType] ?? TYPE_CONFIG.prayer;
  const Icon = cfg.icon;
  const counts = post.reactionCounts ?? { pray: 0, amen: 0, share: 0 };

  const handleComment = () => {
    if (!commentText.trim()) return;
    onComment(post.id, commentText.trim(), post.groupId);
    setCommentText('');
    setShowComment(false);
  };

  return (
    <article className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4">
      <div className="flex items-start gap-3 mb-3">
        {post.authorPhoto ? (
          <img src={post.authorPhoto} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-slate-500 flex items-center justify-center text-white text-sm font-medium">
            {(post.authorName ?? 'M').charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900 dark:text-dark-100">{post.authorName}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.color}`}>
              <Icon size={10} />
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-dark-500">{timeAgo(post.createdAt)}</p>
        </div>
      </div>
      <p className="text-sm text-gray-700 dark:text-dark-200 leading-relaxed mb-4">{post.body}</p>
      <div className="flex items-center gap-1 border-t border-gray-100 dark:border-dark-700 pt-3">
        <button
          type="button"
          disabled={!canInteract}
          onClick={() => onReact(post.id, 'pray', post.groupId)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-500/10 transition-colors disabled:opacity-50"
        >
          <Heart size={14} />
          {post.postType === 'prayer' ? "I'm Praying" : 'Pray'}
          {counts.pray > 0 && <span className="text-gray-400">({counts.pray})</span>}
        </button>
        <button
          type="button"
          disabled={!canInteract}
          onClick={() => onReact(post.id, 'amen', post.groupId)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors disabled:opacity-50"
        >
          Amen
          {counts.amen > 0 && <span className="text-gray-400">({counts.amen})</span>}
        </button>
        <button
          type="button"
          disabled={!canInteract}
          onClick={() => setShowComment(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors disabled:opacity-50"
        >
          <MessageCircle size={14} />
          Comment
          {(post.commentCount ?? 0) > 0 && <span className="text-gray-400">({post.commentCount})</span>}
        </button>
        <button
          type="button"
          disabled={!canInteract}
          onClick={() => onReact(post.id, 'share', post.groupId)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors disabled:opacity-50 ml-auto"
        >
          <Share2 size={14} />
          Share
        </button>
      </div>
      {showComment && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-800 text-sm"
            onKeyDown={e => e.key === 'Enter' && handleComment()}
          />
          <button
            type="button"
            onClick={handleComment}
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
          >
            Send
          </button>
        </div>
      )}
    </article>
  );
}
