import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch } from '../../lib/services/workos';

export const COMPOSABLE_POST_TYPES = ['blessing', 'praise', 'scripture'] as const;
export type ComposablePostType = (typeof COMPOSABLE_POST_TYPES)[number];

export interface CommunityPost {
  id: string;
  post_type: string;
  body: string;
  created_at: string;
  is_mine: boolean;
  author_person_id: string;
  moderation_status: 'pending' | 'approved' | 'rejected' | 'removed';
  author_name: string;
  reaction_counts: Record<string, number>;
  my_reactions: string[];
}

export function usePortalCommunityFeed() {
  const { getAuthToken } = usePortalAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [reactingKey, setReactingKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await workosFetch<{ posts: CommunityPost[] }>('/api/community/posts', getAuthToken);
      setPosts(result.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the community feed');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const submitPost = useCallback(async (postType: ComposablePostType, body: string) => {
    setIsPosting(true);
    try {
      await workosFetch('/api/community/posts', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({ post_type: postType, body }),
      });
      await refresh();
    } finally {
      setIsPosting(false);
    }
  }, [getAuthToken, refresh]);

  // Optimistic toggle: flips the reaction locally so the tap feels instant,
  // then reconciles with the server. On failure it re-fetches rather than
  // guessing how to roll the optimistic change back.
  const toggleReaction = useCallback(async (postId: string, reactionType: string) => {
    const key = `${postId}:${reactionType}`;
    setReactingKey(key);
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const has = p.my_reactions.includes(reactionType);
      const counts = { ...p.reaction_counts };
      counts[reactionType] = Math.max(0, (counts[reactionType] ?? 0) + (has ? -1 : 1));
      return {
        ...p,
        my_reactions: has ? p.my_reactions.filter(r => r !== reactionType) : [...p.my_reactions, reactionType],
        reaction_counts: counts,
      };
    }));
    try {
      await workosFetch('/api/community/reactions', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({ post_id: postId, reaction_type: reactionType }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to react to that post');
      await refresh();
    } finally {
      setReactingKey(null);
    }
  }, [getAuthToken, refresh]);

  const reportPost = useCallback(async (postId: string, reason?: string) => {
    await workosFetch('/api/community/reports', getAuthToken, {
      method: 'POST',
      body: JSON.stringify({ post_id: postId, reason }),
    });
  }, [getAuthToken]);

  const blockMember = useCallback(async (blockedPersonId: string) => {
    await workosFetch('/api/community/blocks', getAuthToken, {
      method: 'POST',
      body: JSON.stringify({ blocked_person_id: blockedPersonId }),
    });
    await refresh();
  }, [getAuthToken, refresh]);

  return { posts, isLoading, error, isPosting, reactingKey, submitPost, toggleReaction, reportPost, blockMember, refresh };
}
