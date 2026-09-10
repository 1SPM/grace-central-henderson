/**
 * Demo community data — mirrors Connect at Central screenshot content.
 * Uses seed.sql person and group IDs for Grace Community Church.
 */

import type {
  CommunityPost,
  MemberConnection,
  MemberConnectionRequest,
  CommunityComment,
} from '../types';

const CHURCH_ID = '11111111-1111-1111-1111-111111111111';
const YOUNG_ADULTS = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02';
const WOMEN_OF_GRACE = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03';

const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

export const DEMO_COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: 'cp-001',
    churchId: CHURCH_ID,
    authorPersonId: '00000000-0000-0000-0000-000000000031',
    postType: 'prayer',
    body: 'Please pray for my college applications — decisions come back next week. Also praying for our youth retreat planning.',
    visibility: 'church',
    createdAt: hoursAgo(3),
    authorName: 'Jennifer Scott',
    reactionCounts: { pray: 12, amen: 4, share: 1 },
    commentCount: 2,
  },
  {
    id: 'cp-002',
    churchId: CHURCH_ID,
    authorPersonId: '00000000-0000-0000-0000-000000000015',
    postType: 'praise',
    body: 'Got the job! Thank you all for praying through the interview season. God is faithful.',
    visibility: 'church',
    createdAt: hoursAgo(8),
    authorName: 'Ashley Robinson',
    reactionCounts: { pray: 3, amen: 24, share: 2 },
    commentCount: 5,
  },
  {
    id: 'cp-003',
    churchId: CHURCH_ID,
    authorPersonId: '00000000-0000-0000-0000-000000000024',
    postType: 'milestone',
    body: 'Giving goal updated — thank you for your generosity this quarter!',
    visibility: 'church',
    metadata: { milestoneType: 'giving_goal' },
    createdAt: daysAgo(1),
    authorName: 'Richard Anderson',
    reactionCounts: { pray: 2, amen: 18, share: 0 },
    commentCount: 0,
  },
  {
    id: 'cp-004',
    churchId: CHURCH_ID,
    authorPersonId: '00000000-0000-0000-0000-000000000032',
    postType: 'scripture',
    body: '"The Lord is my shepherd; I shall not want." — Psalm 23:1. Rest in His provision today.',
    visibility: 'church',
    createdAt: daysAgo(1),
    authorName: 'William Harris',
    reactionCounts: { pray: 8, amen: 31, share: 4 },
    commentCount: 1,
  },
  {
    id: 'cp-005',
    churchId: CHURCH_ID,
    authorPersonId: '00000000-0000-0000-0000-000000000030',
    postType: 'event',
    body: 'Attending Summer BBQ Fellowship this Saturday — who else is going?',
    visibility: 'church',
    metadata: { eventName: 'Summer BBQ Fellowship' },
    createdAt: daysAgo(2),
    authorName: 'David Park',
    reactionCounts: { pray: 0, amen: 6, share: 1 },
    commentCount: 3,
  },
  {
    id: 'cp-006',
    churchId: CHURCH_ID,
    authorPersonId: '00000000-0000-0000-0000-000000000010',
    postType: 'group_activity',
    body: '12 members from Young Adults watched the 9:45 AM Sunday service together this morning!',
    visibility: 'group',
    groupId: YOUNG_ADULTS,
    metadata: { serviceTime: '9:45 AM', memberCount: 12 },
    createdAt: hoursAgo(5),
    authorName: 'Kevin Martinez',
    reactionCounts: { pray: 4, amen: 15, share: 0 },
    commentCount: 2,
  },
  {
    id: 'cp-007',
    churchId: CHURCH_ID,
    authorPersonId: '00000000-0000-0000-0000-000000000009',
    postType: 'blessing',
    body: 'Grateful for this community. You all showed up with meals when my mom was in the hospital — I felt so loved.',
    visibility: 'group',
    groupId: WOMEN_OF_GRACE,
    createdAt: daysAgo(3),
    authorName: 'Amanda Foster',
    reactionCounts: { pray: 6, amen: 22, share: 0 },
    commentCount: 4,
  },
];

export const DEMO_CONNECTIONS: MemberConnection[] = [
  {
    id: 'mc-001',
    churchId: CHURCH_ID,
    personAId: '00000000-0000-0000-0000-000000000015',
    personBId: '00000000-0000-0000-0000-000000000010',
    createdAt: daysAgo(14),
  },
  {
    id: 'mc-002',
    churchId: CHURCH_ID,
    personAId: '00000000-0000-0000-0000-000000000030',
    personBId: '00000000-0000-0000-0000-000000000031',
    createdAt: daysAgo(7),
  },
];

export const DEMO_CONNECTION_REQUESTS: MemberConnectionRequest[] = [
  {
    id: 'mcr-001',
    churchId: CHURCH_ID,
    fromPersonId: '00000000-0000-0000-0000-000000000029',
    toPersonId: '00000000-0000-0000-0000-000000000015',
    status: 'pending',
    createdAt: hoursAgo(6),
    fromName: 'Grace Williams',
  },
  {
    id: 'mcr-002',
    churchId: CHURCH_ID,
    fromPersonId: '00000000-0000-0000-0000-000000000034',
    toPersonId: '00000000-0000-0000-0000-000000000015',
    status: 'pending',
    createdAt: hoursAgo(12),
    fromName: 'Jason Reed',
  },
];

export const DEMO_COMMENTS: CommunityComment[] = [];

export function cloneDemoPosts(): CommunityPost[] {
  return DEMO_COMMUNITY_POSTS.map(p => ({
    ...p,
    reactionCounts: p.reactionCounts ? { ...p.reactionCounts } : undefined,
    myReactions: p.myReactions ? [...p.myReactions] : [],
  }));
}
