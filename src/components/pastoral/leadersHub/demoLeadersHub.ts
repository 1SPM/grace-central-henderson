import type { LeaderProfile } from '../../../types';

/**
 * Demo data for the Leaders Hub (roster stats, availability, care
 * dispatch, inbox, AI companion config). Stats are keyed by leader id
 * with a deterministic fallback, so the hub works with real leader rows
 * or the DEMO_LEADERS roster. Swap these for backend reads later.
 */

export interface LeaderHubStats {
  sessions: number;
  aiPct: number;
  rating: number;
  dms: number;
  blessings: number;
  availability: ('live' | 'ai' | 'off')[]; // Mon..Sun
  dmThreshold: string;
  hours: string;
  liveOverride: boolean;
  todaysBlessing: string;
  careAssignments: string[];
}

const STATS: Record<string, LeaderHubStats> = {
  'leader-1': {
    sessions: 142,
    aiPct: 68,
    rating: 4.9,
    dms: 36,
    blessings: 58,
    availability: ['live', 'ai', 'live', 'ai', 'live', 'ai', 'live'],
    dmThreshold: 'AI replies, escalate on crisis keywords',
    hours: 'Mon–Fri · 9a–4p',
    liveOverride: false,
    todaysBlessing: '“The Lord bless you and keep you; the Lord make his face shine on you.” — Numbers 6:24-25. Praying strength over every family this week.',
    careAssignments: ['Marriage counseling queue', 'New member welcome calls', 'Sunday altar follow-up'],
  },
  'leader-2': {
    sessions: 118,
    aiPct: 54,
    rating: 4.8,
    dms: 52,
    blessings: 31,
    availability: ['ai', 'live', 'ai', 'live', 'ai', 'off', 'live'],
    dmThreshold: 'AI triage first, escalate after 2 turns',
    hours: 'Tue/Thu · 10a–6p',
    liveOverride: true,
    todaysBlessing: '“Cast all your anxiety on him because he cares for you.” — 1 Peter 5:7. You are not carrying this alone.',
    careAssignments: ['Crisis line on-call', 'Grief support group', 'Hospital visitation'],
  },
  'leader-3': {
    sessions: 87,
    aiPct: 75,
    rating: 4.7,
    dms: 19,
    blessings: 12,
    availability: ['ai', 'ai', 'live', 'ai', 'ai', 'live', 'off'],
    dmThreshold: 'AI handles all financial Q&A, escalate on hardship',
    hours: 'Wed/Sat · 12p–5p',
    liveOverride: false,
    todaysBlessing: '“And my God will meet all your needs according to the riches of his glory.” — Philippians 4:19.',
    careAssignments: ['Financial counseling', 'Benevolence fund review', 'Recovery group Tuesdays'],
  },
  'leader-4': {
    sessions: 104,
    aiPct: 41,
    rating: 4.9,
    dms: 64,
    blessings: 44,
    availability: ['live', 'live', 'ai', 'live', 'live', 'live', 'live'],
    dmThreshold: 'Prefers live replies, AI only after-hours',
    hours: 'Mon–Sat · 8a–8p',
    liveOverride: false,
    todaysBlessing: '“Start children off on the way they should go.” — Proverbs 22:6. Cheering on every parent today!',
    careAssignments: ['Youth check-ins', 'Family transitions', 'College send-off prep'],
  },
  'leader-5': {
    sessions: 96,
    aiPct: 62,
    rating: 4.8,
    dms: 28,
    blessings: 22,
    availability: ['ai', 'live', 'ai', 'live', 'ai', 'live', 'off'],
    dmThreshold: 'AI triage, instant escalation on relapse signals',
    hours: 'Tue–Sun · varies',
    liveOverride: false,
    todaysBlessing: '“Therefore, if anyone is in Christ, the new creation has come.” — 2 Corinthians 5:17. One day at a time.',
    careAssignments: ['Celebrate Recovery', 'Sponsor matching', 'Step-study facilitation'],
  },
};

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getLeaderHubStats(leader: LeaderProfile): LeaderHubStats {
  if (STATS[leader.id]) return STATS[leader.id];
  const h = hashCode(leader.id);
  return {
    sessions: 40 + (h % 90),
    aiPct: 35 + (h % 50),
    rating: 4.5 + (h % 5) / 10,
    dms: 10 + (h % 50),
    blessings: 5 + (h % 40),
    availability: ['live', 'ai', 'live', 'ai', 'live', 'ai', 'off'],
    dmThreshold: 'AI triage first, escalate on crisis keywords',
    hours: 'Mon–Fri · 9a–5p',
    liveOverride: false,
    todaysBlessing: '“This is the day that the Lord has made; let us rejoice and be glad in it.” — Psalm 118:24.',
    careAssignments: ['General care queue'],
  };
}

// ── Care dispatch ─────────────────────────────────────────────────

export interface DispatchRoute {
  service: string;
  leaderAi: string;
  escalation: string;
  status: 'Routing' | 'Live' | 'Paused';
}

export const demoDispatchMatrix: DispatchRoute[] = [
  { service: 'Marriage & family', leaderAi: 'Pastor Mike — AI twin', escalation: 'Crisis keywords → live pastor', status: 'Routing' },
  { service: 'Mental health & crisis', leaderAi: 'Pastor Sarah — AI twin', escalation: 'Always pages on-call within 5 min', status: 'Live' },
  { service: 'Grief support', leaderAi: 'Pastor Sarah — AI twin', escalation: 'Escalate after 3 exchanges', status: 'Routing' },
  { service: 'Financial counseling', leaderAi: 'Deacon Robert — AI twin', escalation: 'Hardship signals → benevolence team', status: 'Routing' },
  { service: 'Recovery & addiction', leaderAi: 'Pastor James — AI twin', escalation: 'Relapse signals → instant page', status: 'Live' },
  { service: 'Youth & parenting', leaderAi: 'Sister Grace — AI twin', escalation: 'Minor safety → mandatory live + log', status: 'Routing' },
];

export interface CareLogEntry {
  time: string;
  member: string;
  service: string;
  handledBy: 'AI' | 'Live';
  leader: string;
  outcome: string;
}

export const demoCareLog: CareLogEntry[] = [
  { time: '8:14 AM', member: 'Anonymous', service: 'Mental health', handledBy: 'AI', leader: 'Pastor Sarah twin', outcome: 'Comforted · resources shared' },
  { time: '9:02 AM', member: 'James Okafor', service: 'Financial', handledBy: 'AI', leader: 'Deacon Robert twin', outcome: 'Budget plan drafted' },
  { time: '10:41 AM', member: 'Maria Santos', service: 'Marriage', handledBy: 'Live', leader: 'Pastor Mike', outcome: 'Session booked Thursday' },
  { time: '11:55 AM', member: 'Anonymous', service: 'Recovery', handledBy: 'AI', leader: 'Pastor James twin', outcome: 'Escalated → live call placed' },
  { time: '1:20 PM', member: 'Robert Chen', service: 'Grief', handledBy: 'AI', leader: 'Pastor Sarah twin', outcome: 'Prayer sent · follow-up set' },
  { time: '2:08 PM', member: 'Amara Williams', service: 'Parenting', handledBy: 'Live', leader: 'Sister Grace', outcome: 'In conversation now' },
];

// ── Leader inbox ──────────────────────────────────────────────────

export interface InboxMessage {
  id: string;
  from: string;
  initials: string;
  preview: string;
  time: string;
  state: 'ai-replied' | 'needs-you' | 'flagged';
  topic: string;
}

export const demoInbox: InboxMessage[] = [
  { id: 'msg-1', from: 'Anonymous member', initials: '?', preview: 'I haven\'t told anyone this but I\'ve been struggling since the layoff…', time: '12 min ago', state: 'flagged', topic: 'Crisis' },
  { id: 'msg-2', from: 'Maria Santos', initials: 'MS', preview: 'Thank you for the prayer yesterday. Could we talk about next steps for…', time: '38 min ago', state: 'needs-you', topic: 'Marriage' },
  { id: 'msg-3', from: 'James Okafor', initials: 'JO', preview: 'The budget worksheet helped a lot. One question about the debt snowball…', time: '1 hr ago', state: 'ai-replied', topic: 'Financial' },
  { id: 'msg-4', from: 'Robert Chen', initials: 'RC', preview: 'Some days are harder than others. The anniversary is coming up and…', time: '2 hrs ago', state: 'needs-you', topic: 'Grief' },
  { id: 'msg-5', from: 'Amara Williams', initials: 'AW', preview: 'My teenager finally opened up after we tried what you suggested!', time: '4 hrs ago', state: 'ai-replied', topic: 'Parenting' },
  { id: 'msg-6', from: 'Anonymous member', initials: '?', preview: 'Is it okay to come to recovery group even if I slipped this week?', time: '6 hrs ago', state: 'ai-replied', topic: 'Recovery' },
];

// ── AI companion config ───────────────────────────────────────────

export const demoCompanionConfig = {
  brain: {
    persona: 'Warm, pastoral, scripture-grounded. Mirrors Pastor Mike\'s teaching style and favorite passages. Never diagnoses; always points to hope and practical next steps.',
    knowledgeBase: ['Sermon archive (2019–2026)', 'Marriage course curriculum', 'Church statement of faith', 'Benevolence policy'],
    boundaries: ['No medical or legal advice', 'No financial transactions', 'Mandatory escalation on self-harm signals', 'Never claims to be human'],
    voiceModel: 'Cloned voice — approved 2026-03-12 (consent on file)',
  },
  triggers: [
    { label: 'Self-harm or crisis language', action: 'Page on-call pastor + share 988 line', enabled: true },
    { label: 'Abuse disclosure', action: 'Mandatory live escalation + log for compliance', enabled: true },
    { label: 'Repeated relapse mentions', action: 'Notify recovery leader within 15 min', enabled: true },
    { label: 'Financial hardship', action: 'Offer benevolence intake form', enabled: true },
    { label: 'After 5 AI exchanges', action: 'Offer a live appointment', enabled: false },
  ],
  channels: [
    { label: 'Member app DMs', enabled: true },
    { label: '24-hr care line (voice)', enabled: true },
    { label: 'SMS / text-to-care', enabled: true },
    { label: 'Email replies', enabled: false },
    { label: 'Sunday kiosk', enabled: false },
  ],
  activity: [
    { time: 'Today 2:08 PM', event: 'Handled parenting question, shared course link (4 turns)' },
    { time: 'Today 11:55 AM', event: 'Escalated recovery conversation to live call — relapse signal' },
    { time: 'Today 9:02 AM', event: 'Drafted budget plan from financial counseling playbook' },
    { time: 'Yesterday 8:31 PM', event: 'After-hours grief support, scheduled follow-up prayer' },
    { time: 'Yesterday 3:15 PM', event: 'Knowledge base synced — 2 new sermons indexed' },
  ],
};
