/**
 * Community social network service — Connect at Central.
 * Writes to Supabase when configured; falls back to in-memory demo store.
 * Every write path logs to member_activity_events.
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import { createLogger } from '../../utils/logger';
import { logMemberActivity } from './memberActivity';
import {
  cloneDemoPosts,
  DEMO_CONNECTIONS,
  DEMO_CONNECTION_REQUESTS,
  DEMO_COMMENTS,
} from '../demoCommunityData';
import type {
  CommunityPost,
  CommunityPostType,
  CommunityPostVisibility,
  CommunityReactionType,
  CommunityComment,
  MemberConnection,
  MemberConnectionRequest,
  CommunityFeedFilter,
  Person,
  SmallGroup,
} from '../../types';
import type {
  CommunityPostRow,
  CommunityReactionRow,
  CommunityCommentRow,
  MemberConnectionRow,
  MemberConnectionRequestRow,
} from '../database.types';

const log = createLogger('community');

// In-memory demo store (mutated in demo mode)
let demoPosts = cloneDemoPosts();
let demoConnections = [...DEMO_CONNECTIONS];
let demoRequests = [...DEMO_CONNECTION_REQUESTS];
let demoComments = [...DEMO_COMMENTS];
const demoReactions = new Map<string, Set<string>>(); // key: postId:personId:type

function postFromRow(row: CommunityPostRow): CommunityPost {
  return {
    id: row.id,
    churchId: row.church_id,
    authorPersonId: row.author_person_id,
    postType: row.post_type,
    body: row.body,
    visibility: row.visibility,
    groupId: row.group_id ?? undefined,
    metadata: row.metadata,
    isHidden: row.is_hidden,
    createdAt: row.created_at,
  };
}

function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export interface CreatePostInput {
  churchId: string;
  authorPersonId: string;
  postType: CommunityPostType;
  body: string;
  visibility?: CommunityPostVisibility;
  groupId?: string;
  metadata?: Record<string, unknown>;
}

export async function fetchCommunityPosts(
  churchId: string,
  filter: CommunityFeedFilter = 'all',
  groupId?: string,
): Promise<CommunityPost[]> {
  if (!isSupabaseConfigured() || !supabase) {
    let items = demoPosts.filter(p => p.churchId === churchId && !p.isHidden);
    if (groupId) items = items.filter(p => p.groupId === groupId || p.visibility === 'church');
    if (filter === 'group') items = items.filter(p => p.groupId || p.postType === 'group_activity');
    else if (filter !== 'all') items = items.filter(p => p.postType === filter || (filter === 'blessing' && p.postType === 'blessing'));
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  let query = supabase
    .from('community_posts')
    .select('*')
    .eq('church_id', churchId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(100);

  if (groupId) query = query.or(`group_id.eq.${groupId},visibility.eq.church`);
  if (filter === 'group') query = query.not('group_id', 'is', null);
  else if (filter !== 'all') query = query.eq('post_type', filter);

  const { data, error } = await query;
  if (error) {
    log.warn('fetch posts failed', error.message);
    return cloneDemoPosts();
  }
  return (data as CommunityPostRow[]).map(postFromRow);
}

export async function fetchPostReactions(postIds: string[]): Promise<Map<string, { pray: number; amen: number; share: number }>> {
  const counts = new Map<string, { pray: number; amen: number; share: number }>();
  if (postIds.length === 0) return counts;

  if (!isSupabaseConfigured() || !supabase) {
    for (const id of postIds) {
      const post = demoPosts.find(p => p.id === id);
      counts.set(id, post?.reactionCounts ?? { pray: 0, amen: 0, share: 0 });
    }
    return counts;
  }

  const { data } = await supabase
    .from('community_reactions')
    .select('post_id, reaction_type')
    .in('post_id', postIds);

  for (const id of postIds) counts.set(id, { pray: 0, amen: 0, share: 0 });
  for (const row of (data ?? []) as Pick<CommunityReactionRow, 'post_id' | 'reaction_type'>[]) {
    const c = counts.get(row.post_id)!;
    if (row.reaction_type === 'pray') c.pray++;
    else if (row.reaction_type === 'amen') c.amen++;
    else c.share++;
  }
  return counts;
}

export async function createPost(input: CreatePostInput): Promise<CommunityPost | null> {
  const visibility = input.visibility ?? (input.groupId ? 'group' : 'church');
  const eventType = input.groupId ? 'group_post' : 'community_post';

  if (!isSupabaseConfigured() || !supabase) {
    const post: CommunityPost = {
      id: `cp-${Date.now()}`,
      churchId: input.churchId,
      authorPersonId: input.authorPersonId,
      postType: input.postType,
      body: input.body,
      visibility,
      groupId: input.groupId,
      metadata: input.metadata,
      createdAt: new Date().toISOString(),
      reactionCounts: { pray: 0, amen: 0, share: 0 },
      commentCount: 0,
      myReactions: [],
    };
    demoPosts = [post, ...demoPosts];
    logMemberActivity({
      churchId: input.churchId,
      personId: input.authorPersonId,
      eventType,
      entityType: 'community_post',
      entityId: post.id,
      metadata: { post_type: input.postType, group_id: input.groupId },
    });
    return post;
  }

  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      church_id: input.churchId,
      author_person_id: input.authorPersonId,
      post_type: input.postType,
      body: input.body,
      visibility,
      group_id: input.groupId ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error || !data) {
    log.warn('create post failed', error?.message);
    return null;
  }

  const post = postFromRow(data as CommunityPostRow);
  logMemberActivity({
    churchId: input.churchId,
    personId: input.authorPersonId,
    eventType,
    entityType: 'community_post',
    entityId: post.id,
    metadata: { post_type: input.postType, group_id: input.groupId },
  });
  return post;
}

export async function addReaction(
  churchId: string,
  postId: string,
  personId: string,
  reactionType: CommunityReactionType,
  groupId?: string,
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    const key = `${postId}:${personId}:${reactionType}`;
    if (!demoReactions.has(key)) {
      demoReactions.set(key, new Set([key]));
      const post = demoPosts.find(p => p.id === postId);
      if (post?.reactionCounts) post.reactionCounts[reactionType]++;
    }
    logMemberActivity({
      churchId,
      personId,
      eventType: 'community_react',
      entityType: 'community_post',
      entityId: postId,
      metadata: { reaction_type: reactionType, group_id: groupId },
    });
    return true;
  }

  const { error } = await supabase.from('community_reactions').insert({
    church_id: churchId,
    post_id: postId,
    person_id: personId,
    reaction_type: reactionType,
  });

  if (error && !error.message.includes('duplicate')) {
    log.warn('add reaction failed', error.message);
    return false;
  }

  logMemberActivity({
    churchId,
    personId,
    eventType: 'community_react',
    entityType: 'community_post',
    entityId: postId,
    metadata: { reaction_type: reactionType, group_id: groupId },
  });
  return true;
}

export async function addComment(
  churchId: string,
  postId: string,
  authorPersonId: string,
  body: string,
  groupId?: string,
): Promise<CommunityComment | null> {
  if (!isSupabaseConfigured() || !supabase) {
    const comment: CommunityComment = {
      id: `cc-${Date.now()}`,
      churchId,
      postId,
      authorPersonId,
      body,
      createdAt: new Date().toISOString(),
    };
    demoComments.push(comment);
    const post = demoPosts.find(p => p.id === postId);
    if (post) post.commentCount = (post.commentCount ?? 0) + 1;
    logMemberActivity({
      churchId,
      personId: authorPersonId,
      eventType: 'community_comment',
      entityType: 'community_post',
      entityId: postId,
      metadata: { group_id: groupId },
    });
    return comment;
  }

  const { data, error } = await supabase
    .from('community_comments')
    .insert({
      church_id: churchId,
      post_id: postId,
      author_person_id: authorPersonId,
      body,
    })
    .select()
    .single();

  if (error || !data) return null;

  logMemberActivity({
    churchId,
    personId: authorPersonId,
    eventType: 'community_comment',
    entityType: 'community_post',
    entityId: postId,
    metadata: { group_id: groupId },
  });

  const row = data as CommunityCommentRow;
  return {
    id: row.id,
    churchId: row.church_id,
    postId: row.post_id,
    authorPersonId: row.author_person_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function fetchConnections(churchId: string, personId?: string): Promise<MemberConnection[]> {
  if (!isSupabaseConfigured() || !supabase) {
    let items = demoConnections.filter(c => c.churchId === churchId);
    if (personId) items = items.filter(c => c.personAId === personId || c.personBId === personId);
    return items;
  }

  let query = supabase.from('member_connections').select('*').eq('church_id', churchId);
  if (personId) query = query.or(`person_a_id.eq.${personId},person_b_id.eq.${personId}`);
  const { data } = await query;
  return ((data ?? []) as MemberConnectionRow[]).map(r => ({
    id: r.id,
    churchId: r.church_id,
    personAId: r.person_a_id,
    personBId: r.person_b_id,
    createdAt: r.created_at,
  }));
}

export async function fetchConnectionRequests(
  churchId: string,
  toPersonId?: string,
): Promise<MemberConnectionRequest[]> {
  if (!isSupabaseConfigured() || !supabase) {
    let items = demoRequests.filter(r => r.churchId === churchId && r.status === 'pending');
    if (toPersonId) items = items.filter(r => r.toPersonId === toPersonId);
    return items;
  }

  let query = supabase
    .from('member_connection_requests')
    .select('*')
    .eq('church_id', churchId)
    .eq('status', 'pending');
  if (toPersonId) query = query.eq('to_person_id', toPersonId);
  const { data } = await query;
  return ((data ?? []) as MemberConnectionRequestRow[]).map(r => ({
    id: r.id,
    churchId: r.church_id,
    fromPersonId: r.from_person_id,
    toPersonId: r.to_person_id,
    status: r.status,
    createdAt: r.created_at,
    respondedAt: r.responded_at ?? undefined,
  }));
}

export async function acceptConnectionRequest(
  churchId: string,
  requestId: string,
  toPersonId: string,
): Promise<boolean> {
  const req = demoRequests.find(r => r.id === requestId);
  if (!isSupabaseConfigured() || !supabase) {
    if (!req || req.status !== 'pending') return false;
    req.status = 'accepted';
    req.respondedAt = new Date().toISOString();
    const [a, b] = canonicalPair(req.fromPersonId, req.toPersonId);
    demoConnections.push({
      id: `mc-${Date.now()}`,
      churchId,
      personAId: a,
      personBId: b,
      createdAt: new Date().toISOString(),
    });
    logMemberActivity({
      churchId,
      personId: toPersonId,
      eventType: 'connection_accept',
      entityType: 'member_connection_request',
      entityId: requestId,
      metadata: { from_person_id: req.fromPersonId },
    });
    return true;
  }

  const { data: reqRow } = await supabase
    .from('member_connection_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (!reqRow) return false;
  const row = reqRow as MemberConnectionRequestRow;
  const [a, b] = canonicalPair(row.from_person_id, row.to_person_id);

  await supabase.from('member_connection_requests').update({
    status: 'accepted',
    responded_at: new Date().toISOString(),
  }).eq('id', requestId);

  await supabase.from('member_connections').insert({
    church_id: churchId,
    person_a_id: a,
    person_b_id: b,
  });

  logMemberActivity({
    churchId,
    personId: toPersonId,
    eventType: 'connection_accept',
    entityType: 'member_connection_request',
    entityId: requestId,
    metadata: { from_person_id: row.from_person_id },
  });
  return true;
}

export async function sendConnectionRequest(
  churchId: string,
  fromPersonId: string,
  toPersonId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    demoRequests.push({
      id: `mcr-${Date.now()}`,
      churchId,
      fromPersonId,
      toPersonId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    logMemberActivity({
      churchId,
      personId: fromPersonId,
      eventType: 'connection_request',
      metadata: { to_person_id: toPersonId },
    });
    return true;
  }

  const { error } = await supabase.from('member_connection_requests').insert({
    church_id: churchId,
    from_person_id: fromPersonId,
    to_person_id: toPersonId,
  });

  if (error) return false;
  logMemberActivity({
    churchId,
    personId: fromPersonId,
    eventType: 'connection_request',
    metadata: { to_person_id: toPersonId },
  });
  return true;
}

// ---- CRM aggregation ---------------------------------------------------

export interface GroupCommunityStats {
  groupId: string;
  posts7d: number;
  postsByType: Partial<Record<CommunityPostType, number>>;
  reactions7d: number;
  comments7d: number;
  activeMembers7d: number;
  inactiveMembers: string[];
  recentPosts: CommunityPost[];
  memberEngagement: Array<{
    personId: string;
    lastActiveAt?: string;
    postsCount: number;
    reactionsGiven: number;
    connectionCount: number;
  }>;
}

export interface ChurchCommunitySummary {
  activeMembers7d: number;
  totalConnections: number;
  pendingRequests: number;
}

export function getDemoCommunityDataForCRM(): {
  posts: CommunityPost[];
  connections: MemberConnection[];
  requests: MemberConnectionRequest[];
} {
  return {
    posts: cloneDemoPosts(),
    connections: [...demoConnections],
    requests: demoRequests.filter(r => r.status === 'pending'),
  };
}

export function computeGroupCommunityStats(
  group: SmallGroup,
  _people: Person[],
  posts: CommunityPost[],
  activityEvents: Array<{ personId?: string | null; createdAt: string; eventType: string; metadata?: Record<string, unknown> }>,
  connections: MemberConnection[],
): GroupCommunityStats {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const memberIds = new Set(group.members);

  const groupPosts = posts.filter(p =>
    p.groupId === group.id ||
    (memberIds.has(p.authorPersonId) && p.visibility === 'church'),
  );
  const recentPosts = groupPosts
    .filter(p => p.groupId === group.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const posts7d = groupPosts.filter(p => new Date(p.createdAt).getTime() >= sevenDaysAgo);
  const postsByType: Partial<Record<CommunityPostType, number>> = {};
  for (const p of posts7d) {
    postsByType[p.postType] = (postsByType[p.postType] ?? 0) + 1;
  }

  let reactions7d = 0;
  let comments7d = 0;
  for (const p of posts7d) {
    reactions7d += (p.reactionCounts?.pray ?? 0) + (p.reactionCounts?.amen ?? 0) + (p.reactionCounts?.share ?? 0);
    comments7d += p.commentCount ?? 0;
  }

  const activeMemberIds = new Set<string>();
  for (const e of activityEvents) {
    if (!e.personId || !memberIds.has(e.personId)) continue;
    if (new Date(e.createdAt).getTime() >= sevenDaysAgo) activeMemberIds.add(e.personId);
  }
  for (const p of posts7d) {
    if (memberIds.has(p.authorPersonId)) activeMemberIds.add(p.authorPersonId);
  }

  const inactiveMembers: string[] = [];
  for (const mid of group.members) {
    const personEvents = activityEvents.filter(e => e.personId === mid);
    const personPosts = groupPosts.filter(p => p.authorPersonId === mid);
    const lastActivity = Math.max(
      ...personEvents.map(e => new Date(e.createdAt).getTime()),
      ...personPosts.map(p => new Date(p.createdAt).getTime()),
      0,
    );
    if (lastActivity < fourteenDaysAgo || lastActivity === 0) inactiveMembers.push(mid);
  }

  const memberEngagement = group.members.map(personId => {
    const personEvents = activityEvents.filter(e => e.personId === personId);
    const lastActiveAt = personEvents.length
      ? personEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
      : undefined;
    const postsCount = groupPosts.filter(p => p.authorPersonId === personId).length;
    const reactionsGiven = personEvents.filter(e => e.eventType === 'community_react').length;
    const connectionCount = connections.filter(
      c => c.personAId === personId || c.personBId === personId,
    ).length;
    return { personId, lastActiveAt, postsCount, reactionsGiven, connectionCount };
  });

  return {
    groupId: group.id,
    posts7d: posts7d.length,
    postsByType,
    reactions7d,
    comments7d,
    activeMembers7d: activeMemberIds.size,
    inactiveMembers,
    recentPosts,
    memberEngagement,
  };
}

export function computeChurchCommunitySummary(
  groups: SmallGroup[],
  posts: CommunityPost[],
  connections: MemberConnection[],
  requests: MemberConnectionRequest[],
  activityEvents: Array<{ personId?: string | null; createdAt: string }>,
): ChurchCommunitySummary {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const allMemberIds = new Set<string>();
  groups.forEach(g => g.members.forEach(m => allMemberIds.add(m)));

  const activeMembers7d = new Set<string>();
  for (const e of activityEvents) {
    if (e.personId && allMemberIds.has(e.personId) && new Date(e.createdAt).getTime() >= sevenDaysAgo) {
      activeMembers7d.add(e.personId);
    }
  }
  for (const p of posts) {
    if (allMemberIds.has(p.authorPersonId) && new Date(p.createdAt).getTime() >= sevenDaysAgo) {
      activeMembers7d.add(p.authorPersonId);
    }
  }

  const memberConnectionSet = connections.filter(
    c => allMemberIds.has(c.personAId) && allMemberIds.has(c.personBId),
  );

  const pendingRequests = requests.filter(
    r => r.status === 'pending' && (allMemberIds.has(r.fromPersonId) || allMemberIds.has(r.toPersonId)),
  ).length;

  return {
    activeMembers7d: activeMembers7d.size,
    totalConnections: memberConnectionSet.length,
    pendingRequests,
  };
}

/** Reset demo store (for tests) */
export function resetDemoCommunityStore(): void {
  demoPosts = cloneDemoPosts();
  demoConnections = [...DEMO_CONNECTIONS];
  demoRequests = [...DEMO_CONNECTION_REQUESTS];
  demoComments = [...DEMO_COMMENTS];
  demoReactions.clear();
}
