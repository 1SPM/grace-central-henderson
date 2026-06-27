import type { LeaderProfile } from '../../../types';
import {
  CENTRAL_HENDERSON_LEADER_STATS,
  type LeaderHubStats,
} from '../../../config/centralHendersonLeaders';

/**
 * Leaders Hub stats — reads from canonical Central Henderson config
 * with deterministic fallback for ad-hoc leaders.
 */

export type { LeaderHubStats };

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getLeaderHubStats(leader: LeaderProfile): LeaderHubStats {
  if (CENTRAL_HENDERSON_LEADER_STATS[leader.id]) {
    return CENTRAL_HENDERSON_LEADER_STATS[leader.id];
  }
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
    todaysBlessing: '"This is the day that the Lord has made; let us rejoice and be glad in it." — Psalm 118:24.',
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
  { service: 'Marriage & family', leaderAi: 'Pastor James Wilson — AI twin', escalation: 'Crisis keywords → live pastor', status: 'Routing' },
  { service: 'Mental health & crisis', leaderAi: 'Pastor Sarah Chen — AI twin', escalation: 'Always pages on-call within 5 min', status: 'Live' },
  { service: 'Grief support', leaderAi: 'Elder Ruth Abramowitz — AI twin', escalation: 'Escalate after 3 exchanges', status: 'Routing' },
  { service: 'Pastoral care dispatch', leaderAi: 'Deacon Marcus Collins — AI twin', escalation: 'Hospital / crisis → live team', status: 'Live' },
  { service: 'Youth & parenting', leaderAi: 'Sister Maria Rodriguez — AI twin', escalation: 'Minor safety → mandatory live + log', status: 'Routing' },
  { service: 'Family counseling', leaderAi: 'Pastor Michael Hayes — AI twin', escalation: 'Domestic signals → instant page', status: 'Routing' },
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
  { time: '9:02 AM', member: 'James Okafor', service: 'Marriage', handledBy: 'AI', leader: 'Pastor Michael twin', outcome: 'Pre-marital resources shared' },
  { time: '10:41 AM', member: 'Maria Santos', service: 'Marriage', handledBy: 'Live', leader: 'Pastor James Wilson', outcome: 'Session booked Thursday' },
  { time: '11:55 AM', member: 'Anonymous', service: 'Crisis', handledBy: 'AI', leader: 'Deacon Marcus twin', outcome: 'Escalated → live call placed' },
  { time: '1:20 PM', member: 'Robert Chen', service: 'Grief', handledBy: 'AI', leader: 'Elder Ruth twin', outcome: 'Prayer sent · follow-up set' },
  { time: '2:08 PM', member: 'Amara Williams', service: 'Parenting', handledBy: 'Live', leader: 'Sister Maria Rodriguez', outcome: 'In conversation now' },
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

// ── AI companion config (global defaults; per-leader in centralHendersonLeaders) ──

export const demoCompanionConfig = {
  brain: {
    persona: 'Warm, pastoral, scripture-grounded. Mirrors Pastor James Wilson\'s teaching style and favorite passages.',
    knowledgeBase: ['Sermon archive (2019–2026)', 'Marriage course curriculum', 'Church statement of faith', 'Benevolence policy'],
    boundaries: ['No medical or legal advice', 'No financial transactions', 'Mandatory escalation on self-harm signals', 'Never claims to be human'],
    voiceModel: 'Cloned voice — approved 2026-03-12 (consent on file)',
    greeting:
      "Good morning Maya — I'm Pastor James. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: 'Senior Pastor',
    personality: 'Warm and Pastoral',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded' as const,
    creativity: 50,
    knowledgeText: '',
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
    { time: 'Today 11:55 AM', event: 'Escalated crisis conversation to Deacon Marcus — live call' },
    { time: 'Today 9:02 AM', event: 'Drafted pre-marital resource plan from counseling playbook' },
    { time: 'Yesterday 8:31 PM', event: 'After-hours grief support, scheduled follow-up prayer' },
    { time: 'Yesterday 3:15 PM', event: 'Knowledge base synced — 2 new sermons indexed' },
  ],
};
