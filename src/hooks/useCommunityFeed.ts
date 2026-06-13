import { useState, useEffect, useCallback } from 'react';
import {
  fetchCommunityPosts,
  fetchPostReactions,
  createPost,
  addReaction,
  addComment,
  type CreatePostInput,
} from '../lib/services/community';
import type {
  CommunityPost,
  CommunityFeedFilter,
  CommunityReactionType,
  Person,
} from '../types';

function enrichPosts(posts: CommunityPost[], people: Person[], currentPersonId?: string): CommunityPost[] {
  const personMap = new Map(people.map(p => [p.id, p]));
  return posts.map(p => {
    const author = personMap.get(p.authorPersonId);
    return {
      ...p,
      authorName: p.authorName ?? (author ? `${author.firstName} ${author.lastName}` : 'Member'),
      authorPhoto: author?.photo,
    };
  });
}

export function useCommunityFeed(
  churchId: string | undefined,
  people: Person[],
  currentPersonId?: string,
) {
  const [filter, setFilter] = useState<CommunityFeedFilter>('all');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!churchId) {
      setPosts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const raw = await fetchCommunityPosts(churchId, filter);
    const reactionMap = await fetchPostReactions(raw.map(p => p.id));
    const withReactions = raw.map(p => ({
      ...p,
      reactionCounts: reactionMap.get(p.id) ?? p.reactionCounts ?? { pray: 0, amen: 0, share: 0 },
    }));
    setPosts(enrichPosts(withReactions, people, currentPersonId));
    setIsLoading(false);
  }, [churchId, filter, people, currentPersonId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const submitPost = useCallback(async (input: Omit<CreatePostInput, 'churchId' | 'authorPersonId'>) => {
    if (!churchId || !currentPersonId) return null;
    const post = await createPost({
      ...input,
      churchId,
      authorPersonId: currentPersonId,
    });
    if (post) await reload();
    return post;
  }, [churchId, currentPersonId, reload]);

  const react = useCallback(async (postId: string, reactionType: CommunityReactionType, groupId?: string) => {
    if (!churchId || !currentPersonId) return;
    await addReaction(churchId, postId, currentPersonId, reactionType, groupId);
    await reload();
  }, [churchId, currentPersonId, reload]);

  const comment = useCallback(async (postId: string, body: string, groupId?: string) => {
    if (!churchId || !currentPersonId) return;
    await addComment(churchId, postId, currentPersonId, body, groupId);
    await reload();
  }, [churchId, currentPersonId, reload]);

  return { posts, filter, setFilter, isLoading, reload, submitPost, react, comment };
}
