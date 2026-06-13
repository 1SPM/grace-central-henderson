import { useState } from 'react';
import { Heart, Sparkles, PartyPopper, Camera, Send } from 'lucide-react';
import type { CommunityPostType, SmallGroup } from '../../../types';

interface PostComposerProps {
  groups?: SmallGroup[];
  memberGroupIds?: string[];
  onSubmit: (input: {
    postType: CommunityPostType;
    body: string;
    groupId?: string;
  }) => Promise<unknown>;
  disabled?: boolean;
}

const QUICK_ACTIONS: { type: CommunityPostType; label: string; icon: typeof Heart }[] = [
  { type: 'prayer', label: 'Prayer Request', icon: Heart },
  { type: 'blessing', label: 'Share Blessing', icon: Sparkles },
  { type: 'praise', label: 'Praise report', icon: PartyPopper },
];

export function PostComposer({ groups = [], memberGroupIds = [], onSubmit, disabled }: PostComposerProps) {
  const [body, setBody] = useState('');
  const [postType, setPostType] = useState<CommunityPostType>('prayer');
  const [groupId, setGroupId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myGroups = groups.filter(g => memberGroupIds.includes(g.id) && g.isActive);

  const handleSubmit = async () => {
    if (!body.trim() || disabled) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        postType,
        body: body.trim(),
        groupId: groupId || undefined,
      });
      setBody('');
      setGroupId('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4 mb-4">
      <p className="text-sm font-medium text-gray-700 dark:text-dark-200 mb-3">
        What&apos;s on your heart today?
      </p>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Share with your church family..."
        rows={3}
        disabled={disabled}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-800 text-sm text-gray-900 dark:text-dark-100 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      />
      <div className="flex flex-wrap gap-2 mt-3">
        {QUICK_ACTIONS.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => setPostType(type)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              postType === type
                ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300 hover:bg-gray-200 dark:hover:bg-dark-600'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
        <button
          type="button"
          disabled
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-dark-700 text-gray-400 cursor-not-allowed"
          title="Photo upload coming soon"
        >
          <Camera size={14} />
          Photo
        </button>
      </div>
      {myGroups.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-dark-400 shrink-0">Share with:</label>
          <select
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
            className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-700 dark:text-dark-200"
          >
            <option value="">Whole church</option>
            {myGroups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!body.trim() || isSubmitting || disabled}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={16} />
          {isSubmitting ? 'Posting...' : 'Post'}
        </button>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-2">
        Choose which group or your whole church community sees your post.
      </p>
    </div>
  );
}
