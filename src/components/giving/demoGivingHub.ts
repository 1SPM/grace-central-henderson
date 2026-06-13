/**
 * Demo data for the Giving Hub (campaigns, revenue streams, points,
 * seasonal calendar, member causes). Extracted from the GRACE-Central
 * design mockups. This module is the single seam for wiring these
 * features to a real backend later — replace these exports with API
 * reads and the UI stays unchanged.
 */

export type CampaignKind = 'admin' | 'seasonal' | 'member';

export interface HubCampaign {
  id: string;
  name: string;
  description: string;
  kind: CampaignKind;
  /** Tailwind-safe accent key, mapped to classes in the components */
  accent: 'gold' | 'blue' | 'green' | 'purple';
  icon: 'building' | 'plane' | 'sun' | 'heart';
  raised: number;
  goal: number;
  donors: number;
  daysLeft: number;
  routesTo: string;
  submittedBy?: string;
}

export const demoCampaigns: HubCampaign[] = [
  {
    id: 'camp-building',
    name: 'Building Fund Drive',
    description: 'Capital campaign for new worship center expansion. Visible to all members on the giving screen and app home.',
    kind: 'admin',
    accent: 'gold',
    icon: 'building',
    raised: 68400,
    goal: 100000,
    donors: 142,
    daysLeft: 47,
    routesTo: 'Building Fund account',
  },
  {
    id: 'camp-kenya',
    name: 'Kenya Missions Trip',
    description: 'Support our team of 12 travelling to Nairobi in September. Covers flights, accommodation and project costs.',
    kind: 'admin',
    accent: 'blue',
    icon: 'plane',
    raised: 27300,
    goal: 30000,
    donors: 98,
    daysLeft: 18,
    routesTo: 'Missions Fund account',
  },
  {
    id: 'camp-summer',
    name: 'Summer Outreach Fund',
    description: 'Auto-suggested for June–August. Supports local food banks, youth summer programs, and community events nearby.',
    kind: 'seasonal',
    accent: 'green',
    icon: 'sun',
    raised: 8600,
    goal: 20000,
    donors: 61,
    daysLeft: 12,
    routesTo: 'Missions Fund account',
  },
  {
    id: 'camp-pantry',
    name: 'Community Food Pantry',
    description: 'Help stock the community food pantry through August. Funds disbursed to Feeding America affiliate.',
    kind: 'member',
    accent: 'purple',
    icon: 'heart',
    raised: 4100,
    goal: 5000,
    donors: 54,
    daysLeft: 28,
    routesTo: 'Escrow → disburse on goal',
    submittedBy: 'Maria Santos',
  },
];

export type StreamKind = 'direct' | 'points' | 'campaign' | 'seasonal' | 'member';

export interface RevenueStream {
  id: string;
  label: string;
  kind: StreamKind;
  source: string;
  mtdVolume: number;
  avgGift: number;
  donors: number;
  routesTo: string;
  settlement: string;
  status: 'Active' | 'Live' | 'Paused';
}

export const demoRevenueStreams: RevenueStream[] = [
  { id: 'rs-online', label: 'Direct — Online', kind: 'direct', source: 'App / Website', mtdVolume: 31200, avgGift: 390, donors: 80, routesTo: 'Chosen fund', settlement: 'Same-day', status: 'Active' },
  { id: 'rs-debit', label: 'Direct — Debit card', kind: 'direct', source: 'Grace Visa debit', mtdVolume: 14200, avgGift: 450, donors: 32, routesTo: 'Tithe fund', settlement: 'Same-day', status: 'Active' },
  { id: 'rs-credit', label: 'Direct — Credit card', kind: 'direct', source: 'Grace Visa credit', mtdVolume: 6000, avgGift: 600, donors: 10, routesTo: 'Tithe fund', settlement: 'Same-day', status: 'Active' },
  { id: 'rs-pts-tithe', label: 'Points → Tithe', kind: 'points', source: 'Card spend rewards', mtdVolume: 2890, avgGift: 82, donors: 35, routesTo: 'Tithe fund', settlement: 'Instant', status: 'Active' },
  { id: 'rs-pts-cause', label: 'Points → Cause', kind: 'points', source: 'Card spend rewards', mtdVolume: 950, avgGift: 48, donors: 20, routesTo: 'Member cause', settlement: 'Instant', status: 'Active' },
  { id: 'rs-camp-admin', label: 'Campaign — Admin', kind: 'campaign', source: 'Building Drive / Kenya', mtdVolume: 19770, avgGift: 510, donors: 39, routesTo: 'Campaign fund', settlement: 'Same-day', status: 'Active' },
  { id: 'rs-camp-seasonal', label: 'Campaign — Seasonal', kind: 'seasonal', source: 'Summer Outreach', mtdVolume: 5100, avgGift: 340, donors: 15, routesTo: 'Missions fund', settlement: 'Same-day', status: 'Active' },
  { id: 'rs-member-cause', label: 'Member cause', kind: 'member', source: 'Food Pantry Drive', mtdVolume: 4100, avgGift: 76, donors: 54, routesTo: 'Escrow → disburse', settlement: 'On goal met', status: 'Live' },
];

export interface RecurringGiver {
  name: string;
  amount: number;
  frequency: string;
  fund: string;
  nextDate: string;
}

export const demoRecurring: RecurringGiver[] = [
  { name: 'James Okafor', amount: 400, frequency: 'Weekly', fund: 'Tithe', nextDate: 'Jun 15' },
  { name: 'Maria Santos', amount: 200, frequency: 'Monthly', fund: 'Missions', nextDate: 'Jun 15' },
  { name: 'David Osei', amount: 500, frequency: 'Weekly', fund: 'Tithe', nextDate: 'Jun 15' },
  { name: 'Robert Chen', amount: 150, frequency: 'Monthly', fund: 'Building', nextDate: 'Jun 20' },
  { name: 'Amara Williams', amount: 75, frequency: 'Weekly', fund: 'Youth', nextDate: 'Jun 15' },
];

/**
 * Per-fund revenue stream split, applied to whatever real fund totals
 * exist. Fractions per stream sum to <= 1; remainder counts as direct.
 */
export const demoFundStreamSplits: Record<string, { points: number; campaign: number; card: number }> = {
  tithe: { points: 0.14, campaign: 0, card: 0.08 },
  missions: { points: 0.1, campaign: 0.2, card: 0 },
  building: { points: 0, campaign: 0.3, card: 0 },
  benevolence: { points: 0.25, campaign: 0, card: 0 },
  offering: { points: 0, campaign: 0, card: 0 },
  other: { points: 0, campaign: 0, card: 0 },
};

// ── Points & rewards (rules & leaderboard demo; pool/spend from live API) ──
export interface EarnRule {
  id: string;
  title: string;
  detail: string;
  badge: string;
  icon: 'debit' | 'credit' | 'attendance' | 'referral';
}

export const demoEarnRules: EarnRule[] = [
  { id: 'earn-debit', title: 'Grace Debit card spend', detail: '1 point per $1 spent anywhere', badge: '1× pts', icon: 'debit' },
  { id: 'earn-credit', title: 'Grace Credit card spend', detail: '1.5 points per $1 spent', badge: '1.5× pts', icon: 'credit' },
  { id: 'earn-attend', title: 'Sunday attendance', detail: '50 points per service attended', badge: '50 pts', icon: 'attendance' },
  { id: 'earn-refer', title: 'Refer a new member', detail: '500 bonus points on join', badge: '500 pts', icon: 'referral' },
];

export interface RedemptionOption {
  id: string;
  title: string;
  detail: string;
  icon: 'tithe' | 'cause' | 'gift' | 'missions';
}

export const demoRedemptionOptions: RedemptionOption[] = [
  { id: 'rd-tithe', title: 'Apply to tithe', detail: 'Offset your weekly or monthly tithe balance with points', icon: 'tithe' },
  { id: 'rd-cause', title: 'Dedicate to a cause', detail: 'Send points value to any active campaign or member cause', icon: 'cause' },
  { id: 'rd-gift', title: 'Gift to a member', detail: "Transfer points to another member's giving account", icon: 'gift' },
  { id: 'rd-missions', title: 'Missions fund', detail: 'Direct your points to the global missions giving stream', icon: 'missions' },
];

export interface PointsLeader {
  rank: number;
  name: string;
  initials: string;
  points: number;
  cardSpend: number;
  redeemable: number;
  allocation: string;
}

export const demoPointsLeaders: PointsLeader[] = [
  { rank: 1, name: 'David Osei', initials: 'DO', points: 42000, cardSpend: 28000, redeemable: 420, allocation: 'Applied to tithe' },
  { rank: 2, name: 'James Okafor', initials: 'JO', points: 18600, cardSpend: 12400, redeemable: 186, allocation: 'Split tithe + missions' },
  { rank: 3, name: 'Maria Santos', initials: 'MS', points: 13200, cardSpend: 8800, redeemable: 132, allocation: 'Dedicated to Food Pantry' },
  { rank: 4, name: 'Robert Chen', initials: 'RC', points: 9600, cardSpend: 6400, redeemable: 96, allocation: 'Applied to tithe' },
];

// ── Seasonal giving ───────────────────────────────────────────────

export type SeasonalStatus = 'completed' | 'active' | 'upcoming' | 'next-year';

export interface SeasonalCampaign {
  id: string;
  emoji: string;
  name: string;
  dates: string;
  status: SeasonalStatus;
  raised?: number;
  description?: string;
}

export const demoSeasonal: SeasonalCampaign[] = [
  { id: 'se-easter', emoji: '🐣', name: 'Easter Outreach', dates: 'Mar 28 – Apr 5', status: 'completed', raised: 12400 },
  { id: 'se-grad', emoji: '🎓', name: 'Graduation Giving', dates: 'May 1 – May 31', status: 'completed', raised: 4200 },
  { id: 'se-summer', emoji: '☀️', name: 'Summer Outreach', dates: 'Jun 1 – Aug 31', status: 'active', description: 'Food banks, youth camp, community events' },
  { id: 'se-harvest', emoji: '🍂', name: 'Harvest Giving', dates: 'Oct 1 – Nov 15', status: 'upcoming', description: 'Thanksgiving drives, local shelter support' },
  { id: 'se-christmas', emoji: '🎄', name: 'Christmas Blessing', dates: 'Dec 1 – Dec 24', status: 'upcoming', description: 'Family hampers, toy drives, community dinners' },
  { id: 'se-newyear', emoji: '🎆', name: 'New Year Hope', dates: 'Dec 28 – Jan 7', status: 'upcoming', description: 'Support for families in transition' },
  { id: 'se-valentine', emoji: '❤️', name: 'Valentine Outreach', dates: 'Feb 7 – Feb 14', status: 'next-year', description: 'Elderly care, hospital visits, care packages' },
  { id: 'se-lent', emoji: '✝️', name: 'Lent & Good Friday', dates: 'Mar 4 – Apr 3', status: 'next-year', description: 'Fasting pledges, prayer support, meals' },
];

// ── Member causes ─────────────────────────────────────────────────

export type CauseVerification = 'verified' | 'pending' | 'none';

export interface MemberCause {
  id: string;
  submitter: string;
  initials: string;
  title: string;
  description: string;
  votes: number;
  verification: CauseVerification;
  submitted: string;
}

export const demoCauses: MemberCause[] = [
  {
    id: 'cause-pantry',
    submitter: 'Maria Santos',
    initials: 'MS',
    title: 'Grace Community Food Pantry',
    description: 'Partner with Feeding America to stock our community food pantry through August. Target: 200 families per week.',
    votes: 82,
    verification: 'verified',
    submitted: 'Jun 2',
  },
  {
    id: 'cause-soccer',
    submitter: 'James Okafor',
    initials: 'JO',
    title: 'Youth Soccer Equipment Drive',
    description: 'Purchase equipment for the community youth soccer program at Liberty Park serving 80 at-risk kids aged 8–16.',
    votes: 61,
    verification: 'pending',
    submitted: 'Jun 9',
  },
  {
    id: 'cause-refugee',
    submitter: 'Amara Grace',
    initials: 'AG',
    title: 'Refugee Resettlement Welcome Kits',
    description: 'Assemble welcome kits for 50 newly arrived refugee families — bedding, kitchen items, hygiene and clothing essentials.',
    votes: 54,
    verification: 'verified',
    submitted: 'Jun 14',
  },
  {
    id: 'cause-street',
    submitter: 'Robert Chen',
    initials: 'RC',
    title: 'Street Outreach Supplies',
    description: 'Monthly supplies for the downtown street outreach team — sandwiches, hygiene kits, and prayer materials.',
    votes: 29,
    verification: 'none',
    submitted: 'Jun 18',
  },
];

export const demoCauseStats = {
  awaitingReview: 8,
  approvedLive: 1,
  approvedLiveLabel: 'Food Pantry Drive',
  totalVotes: 247,
};
