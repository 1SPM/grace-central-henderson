/**
 * Central Henderson Church — canonical pastoral AI clergy roster.
 * Single source of truth for CRM Leadership hub, member portal, and People (Central Staff).
 */
import type { HelpCategory, LeaderProfile, Person } from '../types';

export interface LeaderHubStats {
  sessions: number;
  aiPct: number;
  rating: number;
  dms: number;
  blessings: number;
  availability: ('live' | 'ai' | 'off')[];
  dmThreshold: string;
  hours: string;
  liveOverride: boolean;
  todaysBlessing: string;
  careAssignments: string[];
  contactPhone?: string;
  contactEmail?: string;
}

export interface LeaderCompanionConfig {
  persona: string;
  knowledgeBase: string[];
  boundaries: string[];
  voiceModel: string;
  /** D-ID Agents embed — from studio.d-id.com share panel */
  didAgentId?: string;
  didClientKey?: string;
  greeting?: string;
  agentRole?: string;
  personality?: string;
  llm?: string;
  knowledgeGrounding?: 'Ungrounded' | 'Grounded' | 'Hybrid';
  creativity?: number;
  knowledgeText?: string;
  /** Fallback avatar session when D-ID keys are not configured */
  divinityAvatarUrl?: string;
}

export interface GraceFaqItem {
  id: string;
  question: string;
  answer: string;
  audience?: 'admin' | 'member' | 'both';
}

/** Person IDs for Central Staff rows in people table (seed + SAMPLE_PEOPLE). */
export const CENTRAL_STAFF_PERSON_IDS = [
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000104',
  '00000000-0000-0000-0000-000000000105',
  '00000000-0000-0000-0000-000000000106',
  '00000000-0000-0000-0000-000000000107',
  '00000000-0000-0000-0000-000000000108',
] as const;

/**
 * Leader portraits — official-style clergy headshots from churchofjesuschrist.org media library,
 * bundled under /public/leaders for stable circular avatars (see General Authority portraits).
 */
export const CENTRAL_HENDERSON_LEADER_PHOTOS: Record<string, string> = {
  'ch-leader-james-wilson': '/leaders/james-wilson.jpg',
  'ch-leader-marcus-collins': '/leaders/marcus-collins.jpg',
  'ch-leader-maria-rodriguez': '/leaders/maria-rodriguez.jpg',
  'ch-leader-thomas-grant': '/leaders/thomas-grant.jpg',
  'ch-leader-sarah-chen': '/leaders/sarah-chen.jpg',
  'ch-leader-david-okafor': '/leaders/david-okafor.jpg',
  'ch-leader-michael-hayes': '/leaders/michael-hayes.jpg',
  'ch-leader-ruth-abramowitz': '/leaders/ruth-abramowitz.jpg',
};

/** Photo URL for a canonical Central Henderson leader id. */
export function getLeaderPhoto(leaderId: string): string | undefined {
  return CENTRAL_HENDERSON_LEADER_PHOTOS[leaderId];
}

const PERSON_ID_TO_LEADER_ID: Record<string, string> = {
  [CENTRAL_STAFF_PERSON_IDS[0]]: 'ch-leader-james-wilson',
  [CENTRAL_STAFF_PERSON_IDS[1]]: 'ch-leader-marcus-collins',
  [CENTRAL_STAFF_PERSON_IDS[2]]: 'ch-leader-maria-rodriguez',
  [CENTRAL_STAFF_PERSON_IDS[3]]: 'ch-leader-thomas-grant',
  [CENTRAL_STAFF_PERSON_IDS[4]]: 'ch-leader-sarah-chen',
  [CENTRAL_STAFF_PERSON_IDS[5]]: 'ch-leader-david-okafor',
  [CENTRAL_STAFF_PERSON_IDS[6]]: 'ch-leader-michael-hayes',
  [CENTRAL_STAFF_PERSON_IDS[7]]: 'ch-leader-ruth-abramowitz',
};

/** Photo URL for a Central Staff person row (maps personId → leader roster). */
export function getLeaderPhotoByPersonId(personId: string): string | undefined {
  const leaderId = PERSON_ID_TO_LEADER_ID[personId];
  return leaderId ? getLeaderPhoto(leaderId) : undefined;
}

export const CENTRAL_HENDERSON_LEADERS: LeaderProfile[] = [
  {
    id: 'ch-leader-james-wilson',
    personId: CENTRAL_STAFF_PERSON_IDS[0],
    displayName: 'Pastor James Wilson',
    title: 'Senior Pastor',
    photo: CENTRAL_HENDERSON_LEADER_PHOTOS['ch-leader-james-wilson'],
    bio: 'Over 22 years guiding families through faith, marriage, and life transitions. Grounded in scripture and practical pastoral care.',
    expertiseAreas: ['marriage', 'parenting', 'general', 'faith-questions'],
    credentials: ['M.Div — Fuller Seminary', 'Certified Biblical Counselor'],
    yearsOfPractice: 22,
    personalityTraits: ['Warm', 'Patient', 'Scripture-focused', 'Encouraging'],
    spiritualFocusAreas: ['Prayer Ministry', 'Discipleship', 'Preaching'],
    language: 'English',
    isVerified: true,
    isAvailable: true,
    isActive: true,
    sessionType: 'recurring',
    sessionFrequency: 'Weekly',
    suitableFor: ['Adults', 'Couples', 'Families'],
    anchors: '"Bear one another\'s burdens, and so fulfill the law of Christ." — Galatians 6:2',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ch-leader-marcus-collins',
    personId: CENTRAL_STAFF_PERSON_IDS[1],
    displayName: 'Deacon Marcus Collins',
    title: 'Pastoral Care Director',
    photo: CENTRAL_HENDERSON_LEADER_PHOTOS['ch-leader-marcus-collins'],
    bio: 'Leads care dispatch and hospital visitation. Former hospice chaplain with deep crisis intervention experience.',
    expertiseAreas: ['grief', 'crisis', 'anxiety-depression', 'general'],
    credentials: ['Board Certified Chaplain', 'M.A. Pastoral Care'],
    yearsOfPractice: 18,
    personalityTraits: ['Empathetic', 'Calm', 'Steady', 'Compassionate'],
    spiritualFocusAreas: ['Healing Ministry', 'Intercessory Prayer'],
    language: 'English',
    isVerified: true,
    isAvailable: true,
    isActive: true,
    sessionType: 'recurring',
    sessionFrequency: 'On-call rotation',
    suitableFor: ['Adults', 'Seniors', 'Families'],
    anchors: '"The Lord is close to the brokenhearted." — Psalm 34:18',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ch-leader-maria-rodriguez',
    personId: CENTRAL_STAFF_PERSON_IDS[2],
    displayName: 'Sister Maria Rodriguez',
    title: 'Youth & Family Ministry',
    photo: CENTRAL_HENDERSON_LEADER_PHOTOS['ch-leader-maria-rodriguez'],
    bio: 'Passionate about walking with young adults and families through transitions and faith formation.',
    expertiseAreas: ['parenting', 'faith-questions', 'general'],
    credentials: ['M.A. Family Therapy', 'Youth Ministry Certificate'],
    yearsOfPractice: 12,
    personalityTraits: ['Energetic', 'Relatable', 'Insightful', 'Encouraging'],
    spiritualFocusAreas: ['Youth Ministry', 'Worship', 'Discipleship'],
    language: 'English',
    isVerified: true,
    isAvailable: false,
    isActive: true,
    sessionType: 'recurring',
    sessionFrequency: 'Weekly',
    suitableFor: ['Youth', 'Young Adults', 'Families'],
    anchors: '"Start children off on the way they should go." — Proverbs 22:6',
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'ch-leader-thomas-grant',
    personId: CENTRAL_STAFF_PERSON_IDS[3],
    displayName: 'Elder Thomas Grant',
    title: 'Missions & Outreach Lead',
    photo: CENTRAL_HENDERSON_LEADER_PHOTOS['ch-leader-thomas-grant'],
    bio: 'Oversees missions partnerships and community outreach. Guides members in service and global engagement.',
    expertiseAreas: ['general', 'financial', 'faith-questions'],
    credentials: ['Elder — Central Henderson', 'Missions Leadership Certificate'],
    yearsOfPractice: 20,
    personalityTraits: ['Practical', 'Direct', 'Visionary', 'Humble'],
    spiritualFocusAreas: ['Missions', 'Social Justice', 'Discipleship'],
    language: 'English',
    isVerified: true,
    isAvailable: false,
    isActive: true,
    sessionType: 'one-time',
    sessionFrequency: 'Monthly',
    suitableFor: ['Adults', 'Volunteers'],
    anchors: '"Go into all the world and preach the gospel." — Mark 16:15',
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'ch-leader-sarah-chen',
    personId: CENTRAL_STAFF_PERSON_IDS[4],
    displayName: 'Pastor Sarah Chen',
    title: "Women's Ministry",
    photo: CENTRAL_HENDERSON_LEADER_PHOTOS['ch-leader-sarah-chen'],
    bio: 'Licensed counselor combining professional expertise with spiritual care for women facing anxiety, grief, and life stress.',
    expertiseAreas: ['anxiety-depression', 'grief', 'marriage', 'general'],
    credentials: ['Licensed Professional Counselor', 'M.A. Clinical Psychology'],
    yearsOfPractice: 14,
    personalityTraits: ['Empathetic', 'Gentle', 'Encouraging', 'Contemplative'],
    spiritualFocusAreas: ['Prayer Ministry', 'Healing Ministry', "Women's Ministry"],
    language: 'English',
    isVerified: true,
    isAvailable: true,
    isActive: true,
    sessionType: 'recurring',
    sessionFrequency: 'Bi-weekly',
    suitableFor: ['Women', 'Adults', 'Couples'],
    anchors: '"She is clothed with strength and dignity." — Proverbs 31:25',
    createdAt: '2024-03-01T00:00:00Z',
  },
  {
    id: 'ch-leader-david-okafor',
    personId: CENTRAL_STAFF_PERSON_IDS[5],
    displayName: 'Deacon David Okafor',
    title: 'Worship & Arts Ministry',
    photo: CENTRAL_HENDERSON_LEADER_PHOTOS['ch-leader-david-okafor'],
    bio: 'Leads worship teams and creative arts. Helps members connect with God through music, prayer, and creative expression.',
    expertiseAreas: ['general', 'faith-questions'],
    credentials: ['Worship Leadership Certificate', 'Music Director — 15 years'],
    yearsOfPractice: 15,
    personalityTraits: ['Creative', 'Passionate', 'Encouraging', 'Collaborative'],
    spiritualFocusAreas: ['Worship', 'Creative Arts', 'Prayer Ministry'],
    language: 'English',
    isVerified: true,
    isAvailable: true,
    isActive: true,
    sessionType: 'recurring',
    sessionFrequency: 'Weekly',
    suitableFor: ['Musicians', 'Volunteers', 'Adults'],
    anchors: '"Sing to the Lord a new song." — Psalm 96:1',
    createdAt: '2024-03-01T00:00:00Z',
  },
  {
    id: 'ch-leader-michael-hayes',
    personId: CENTRAL_STAFF_PERSON_IDS[6],
    displayName: 'Pastor Michael Hayes',
    title: 'Family & Counseling',
    photo: CENTRAL_HENDERSON_LEADER_PHOTOS['ch-leader-michael-hayes'],
    bio: 'Specializes in marriage counseling, family systems, and pre-marital guidance with a scripture-centered approach.',
    expertiseAreas: ['marriage', 'parenting', 'crisis', 'general'],
    credentials: ['M.Div', 'Certified Marriage & Family Therapist'],
    yearsOfPractice: 16,
    personalityTraits: ['Patient', 'Wise', 'Scripture-focused', 'Coaching'],
    spiritualFocusAreas: ['Marriage Ministry', 'Discipleship', 'Counseling'],
    language: 'English',
    isVerified: true,
    isAvailable: false,
    isActive: true,
    sessionType: 'recurring',
    sessionFrequency: 'Weekly',
    suitableFor: ['Couples', 'Families', 'Adults'],
    anchors: '"Above all, love each other deeply." — 1 Peter 4:8',
    createdAt: '2024-04-01T00:00:00Z',
  },
  {
    id: 'ch-leader-ruth-abramowitz',
    personId: CENTRAL_STAFF_PERSON_IDS[7],
    displayName: 'Elder Ruth Abramowitz',
    title: 'Prayer Ministry Lead',
    photo: CENTRAL_HENDERSON_LEADER_PHOTOS['ch-leader-ruth-abramowitz'],
    bio: 'Coordinates intercessory prayer teams and daily blessings. Deep experience in grief support and hospital prayer visits.',
    expertiseAreas: ['grief', 'crisis', 'general', 'anxiety-depression'],
    credentials: ['Prayer Ministry Director', 'GriefShare Facilitator'],
    yearsOfPractice: 19,
    personalityTraits: ['Contemplative', 'Gentle', 'Faithful', 'Encouraging'],
    spiritualFocusAreas: ['Intercessory Prayer', 'Healing Ministry', 'Grief Support'],
    language: 'English',
    isVerified: true,
    isAvailable: false,
    isActive: true,
    sessionType: 'recurring',
    sessionFrequency: 'Daily prayer rotation',
    suitableFor: ['Adults', 'Seniors', 'Care requests'],
    anchors: '"The prayer of a righteous person is powerful and effective." — James 5:16',
    createdAt: '2024-04-01T00:00:00Z',
  },
];

export const CENTRAL_HENDERSON_LEADER_STATS: Record<string, LeaderHubStats> = {
  'ch-leader-james-wilson': {
    sessions: 58,
    aiPct: 83,
    rating: 4.9,
    dms: 12,
    blessings: 27,
    availability: ['live', 'live', 'live', 'live', 'live', 'ai', 'ai'],
    dmThreshold: '5 sessions + Enlightened tier for live DM',
    hours: 'Mon–Fri · 9a–6p',
    liveOverride: false,
    todaysBlessing:
      '"The Lord bless you and keep you; the Lord make his face shine on you." — Numbers 6:24-25. Praying strength over every family this week.',
    careAssignments: ['Prayer & guidance', 'Crisis triage', 'Sunday altar follow-up'],
    contactPhone: '(702) 555-0101',
    contactEmail: 'jwilson@centralhenderson.org',
  },
  'ch-leader-marcus-collins': {
    sessions: 45,
    aiPct: 78,
    rating: 4.8,
    dms: 18,
    blessings: 24,
    availability: ['live', 'live', 'live', 'live', 'live', 'off', 'off'],
    dmThreshold: 'AI triage first, escalate on crisis keywords',
    hours: 'Mon–Fri · 8a–5p',
    liveOverride: false,
    todaysBlessing:
      '"Cast all your anxiety on him because he cares for you." — 1 Peter 5:7. You are not carrying this alone.',
    careAssignments: ['Care dispatch', 'Hospital visitation', 'Funerals (backup)'],
    contactPhone: '(702) 555-0102',
    contactEmail: 'mcollins@centralhenderson.org',
  },
  'ch-leader-maria-rodriguez': {
    sessions: 42,
    aiPct: 71,
    rating: 4.9,
    dms: 22,
    blessings: 26,
    availability: ['ai', 'live', 'live', 'live', 'live', 'live', 'off'],
    dmThreshold: 'AI after-hours; live during youth hours',
    hours: 'Tue–Sat · 10a–7p',
    liveOverride: false,
    todaysBlessing:
      '"Let no one despise your youth, but set an example." — 1 Timothy 4:12. Cheering on every young person today!',
    careAssignments: ['Youth check-ins', 'Family transitions', 'College send-off prep'],
    contactPhone: '(702) 555-0103',
    contactEmail: 'mrodriguez@centralhenderson.org',
  },
  'ch-leader-thomas-grant': {
    sessions: 31,
    aiPct: 85,
    rating: 4.7,
    dms: 8,
    blessings: 22,
    availability: ['ai', 'ai', 'live', 'ai', 'ai', 'off', 'off'],
    dmThreshold: 'AI handles outreach Q&A; live for missions partners',
    hours: 'Wed · 12p–5p',
    liveOverride: false,
    todaysBlessing:
      '"How beautiful are the feet of those who bring good news!" — Romans 10:15.',
    careAssignments: ['Missions intake', 'Volunteer outreach', 'Community partnerships'],
    contactPhone: '(702) 555-0104',
    contactEmail: 'tgrant@centralhenderson.org',
  },
  'ch-leader-sarah-chen': {
    sessions: 52,
    aiPct: 76,
    rating: 4.9,
    dms: 15,
    blessings: 28,
    availability: ['live', 'live', 'live', 'live', 'live', 'ai', 'off'],
    dmThreshold: 'AI triage first, escalate after 2 turns on crisis',
    hours: 'Mon–Fri · 9a–5p',
    liveOverride: true,
    todaysBlessing:
      '"She is clothed with strength and dignity; she can laugh at the days to come." — Proverbs 31:25.',
    careAssignments: ["Women's Bible study", 'Grief support group', 'Anxiety & faith workshop'],
    contactPhone: '(702) 555-0105',
    contactEmail: 'schen@centralhenderson.org',
  },
  'ch-leader-david-okafor': {
    sessions: 38,
    aiPct: 69,
    rating: 4.8,
    dms: 10,
    blessings: 25,
    availability: ['live', 'live', 'live', 'live', 'live', 'live', 'live'],
    dmThreshold: 'Open DMs for worship team; AI for general questions',
    hours: 'Mon–Sat · varies',
    liveOverride: false,
    todaysBlessing: '"Sing to the Lord a new song; sing to the Lord, all the earth." — Psalm 96:1.',
    careAssignments: ['Worship team care', 'Creative arts mentoring', 'Sunday prep prayer'],
    contactPhone: '(702) 555-0106',
    contactEmail: 'dokafor@centralhenderson.org',
  },
  'ch-leader-michael-hayes': {
    sessions: 47,
    aiPct: 80,
    rating: 4.8,
    dms: 14,
    blessings: 23,
    availability: ['ai', 'live', 'live', 'live', 'live', 'ai', 'off'],
    dmThreshold: 'Pre-marital couples → live within 24h',
    hours: 'Tue–Thu · 10a–6p',
    liveOverride: false,
    todaysBlessing:
      '"Above all, love each other deeply, because love covers over a multitude of sins." — 1 Peter 4:8.',
    careAssignments: ['Marriage counseling queue', 'Pre-marital sessions', 'Family crisis triage'],
    contactPhone: '(702) 555-0107',
    contactEmail: 'mhayes@centralhenderson.org',
  },
  'ch-leader-ruth-abramowitz': {
    sessions: 19,
    aiPct: 84,
    rating: 4.9,
    dms: 6,
    blessings: 26,
    availability: ['ai', 'ai', 'live', 'ai', 'ai', 'live', 'off'],
    dmThreshold: 'AI daily blessings; live for grief escalation',
    hours: 'Wed/Sat · prayer hours',
    liveOverride: false,
    todaysBlessing:
      '"The prayer of a righteous person is powerful and effective." — James 5:16. Holding your request before the Lord today.',
    careAssignments: ['Prayer chain', 'GriefShare facilitation', 'Hospital prayer visits'],
    contactPhone: '(702) 555-0108',
    contactEmail: 'rabramowitz@centralhenderson.org',
  },
};

export const CENTRAL_HENDERSON_COMPANION_CONFIG: Record<string, LeaderCompanionConfig> = {
  'ch-leader-james-wilson': {
    persona:
      'Warm, pastoral, scripture-grounded. Mirrors Pastor James\'s teaching style — compassionate, clear, and encouraging. Never diagnoses; always points to hope and practical next steps.',
    knowledgeBase: ['Sermon archive (2019–2026)', 'Marriage course curriculum', 'Church statement of faith', 'Central Henderson service guide'],
    boundaries: ['No medical or legal advice', 'No financial transactions', 'Mandatory escalation on self-harm signals', 'Never claims to be human'],
    voiceModel: 'Cloned voice — approved 2026-03-12 (consent on file)',
    greeting:
      "Good morning Maya — I'm Pastor James. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: 'Senior Pastor',
    personality: 'Warm and Pastoral',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/james-wilson',
  },
  'ch-leader-marcus-collins': {
    persona:
      'Steady, calming presence for crisis and grief. Reflects Deacon Marcus\'s chaplain training — validates pain, offers scripture comfort, escalates quickly when needed.',
    knowledgeBase: ['Crisis response playbook', 'Grief support resources', '988 & local crisis lines', 'Hospital visitation protocol'],
    boundaries: ['Always share 988 on crisis signals', 'No clinical diagnosis', 'Mandatory live escalation on abuse disclosure'],
    voiceModel: 'Standard pastoral voice — approved 2026-02-01',
    greeting:
      "Good morning — I'm Deacon Marcus. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: 'Pastoral Care Director',
    personality: 'Calm and Empathetic',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
  'ch-leader-maria-rodriguez': {
    persona:
      'Relatable and energetic for youth and families. Uses age-appropriate language, celebrates small wins, connects faith to everyday life.',
    knowledgeBase: ['Youth ministry curriculum', 'Parenting resources', 'Central Youth Apex schedule', 'College transition guide'],
    boundaries: ['Minor safety → mandatory live + log', 'No unsupervised youth contact off-platform', 'Escalate parental conflict to live'],
    voiceModel: 'Youth-friendly voice — approved 2026-01-15',
    greeting:
      "Good morning — I'm Sister Maria. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: 'Youth & Family Ministry',
    personality: 'Energetic and Relatable',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
  'ch-leader-thomas-grant': {
    persona:
      'Vision-oriented and practical about missions and service. Encourages members to discover their calling and connect to outreach opportunities.',
    knowledgeBase: ['Missions partner list', 'Volunteer opportunity catalog', 'Outreach event calendar', 'Global missions briefing'],
    boundaries: ['No commitment of church funds', 'Refer financial questions to benevolence team'],
    voiceModel: 'Standard pastoral voice',
    greeting:
      "Good morning — I'm Elder Thomas. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: 'Missions & Outreach Lead',
    personality: 'Direct and Practical',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
  'ch-leader-sarah-chen': {
    persona:
      'Gentle, empathetic counselor tone. Validates emotions, integrates scripture with evidence-informed coping strategies, offers prayer alongside practical tools.',
    knowledgeBase: ['Women\'s ministry resources', 'Anxiety & faith workbook', 'Grief support curriculum', 'LPC scope guidelines'],
    boundaries: ['No clinical diagnosis', 'Crisis → page on-call within 5 min', 'Never replaces licensed therapy for ongoing care'],
    voiceModel: 'Warm counselor voice — approved 2026-02-20',
    greeting:
      "Good morning — I'm Pastor Sarah. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: "Women's Ministry",
    personality: 'Calm and Empathetic',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
  'ch-leader-david-okafor': {
    persona:
      'Creative and worship-focused. Helps members connect with God through music, prayer, and artistic expression. Celebrates the arts as ministry.',
    knowledgeBase: ['Worship set archive', 'Team roster & schedules', 'Creative arts policy', 'Sunday prep run sheet'],
    boundaries: ['No scheduling changes without team lead approval', 'Technical issues → AV team'],
    voiceModel: 'Expressive worship leader voice',
    greeting:
      "Good morning — I'm Deacon David. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: 'Worship & Arts Ministry',
    personality: 'Friendly and Professional',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
  'ch-leader-michael-hayes': {
    persona:
      'Patient marriage and family counselor. Scripture-centered, asks good questions, helps couples and families find reconciliation and clarity.',
    knowledgeBase: ['Pre-marital curriculum', 'Marriage enrichment course', 'Family systems framework', 'Conflict resolution guide'],
    boundaries: ['No legal advice on divorce', 'Domestic violence → mandatory escalation', 'No couples counseling without both parties aware'],
    voiceModel: 'Calm counselor voice — approved 2026-01-30',
    greeting:
      "Good morning — I'm Pastor Michael. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: 'Family & Counseling',
    personality: 'Warm and Pastoral',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
  'ch-leader-ruth-abramowitz': {
    persona:
      'Contemplative prayer guide. Offers daily blessings, intercessory prayer, and gentle grief companionship. Never rushes; holds space for silence and lament.',
    knowledgeBase: ['Daily blessing archive', 'Prayer chain roster', 'GriefShare materials', 'Hospital prayer protocol'],
    boundaries: ['Crisis grief → connect to Marcus Collins team', 'No prophecy or predictive statements'],
    voiceModel: 'Gentle elder voice — approved 2026-02-10',
    greeting:
      "Good morning — I'm Elder Ruth. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: 'Prayer Ministry Lead',
    personality: 'Calm and Empathetic',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
};

export const GRACE_AI_FAQ: GraceFaqItem[] = [
  {
    id: 'what-is-grace',
    question: 'What is GRACE?',
    answer:
      'GRACE stands for Growth, Resource, Assistance, Community, and Engagement — your guide through Central Henderson. Start here for giving, watching live services, finding groups, registering for events, and care routing. When something personal is on your heart, connect with a verified leader avatar instead.',
    audience: 'both',
  },
  {
    id: 'ways-grace-helps-giving',
    question: 'How can GRACE help with giving?',
    answer:
      'Ask GRACE to set up recurring gifts, find campaign details, explain tax statements, or route you to online giving. GRACE knows your church\'s giving policies and seasonal campaigns.',
    audience: 'both',
  },
  {
    id: 'ways-grace-helps-watch',
    question: 'How can GRACE help me watch?',
    answer:
      'GRACE can share livestream links, weekend service times, on-demand sermon archives, and watch-party schedules for Central Henderson experiences.',
    audience: 'both',
  },
  {
    id: 'ways-grace-helps-groups',
    question: 'How can GRACE help me find groups?',
    answer:
      'Tell GRACE your life stage or interests — GRACE matches you to small groups, Central Youth, Central Kids info, and volunteer teams.',
    audience: 'both',
  },
  {
    id: 'ways-grace-helps-events',
    question: 'How can GRACE help with events?',
    answer:
      'GRACE surfaces upcoming events, registration links, RSVP status, and volunteer opportunities. Ask about First Step, baptisms, or special weekend experiences.',
    audience: 'both',
  },
  {
    id: 'ways-grace-helps-care',
    question: 'How does GRACE route care requests?',
    answer:
      'For operational needs (scheduling, benevolence intake forms, general questions), GRACE handles it. For prayer, grief, crisis, or personal pastoral conversation, GRACE connects you to a verified leader avatar — siloed to that leader, not shared with GRACE.',
    audience: 'both',
  },
  {
    id: 'what-is-leader-avatar',
    question: 'What is a leader avatar?',
    answer:
      'A verified leader avatar is an AI companion grounded in a specific pastor or deacon\'s approved teachings, tone, and boundaries. It offers prayer, scripture, and guidance while the real leader can follow up live when needed.',
    audience: 'both',
  },
  {
    id: 'where-personal',
    question: 'Where should I share something personal?',
    answer:
      'Share personal matters with a leader avatar in My Leadership / Care — not with GRACE on Home. Leader conversations are confidential to that avatar profile.',
    audience: 'member',
  },
  {
    id: 'privacy',
    question: 'Are conversations private?',
    answer:
      'Leader avatar conversations are siloed to that leader\'s profile and kept confidential between you and their care team. GRACE operational chat is separate and used for church navigation and admin tasks.',
    audience: 'both',
  },
  {
    id: 'real-leader',
    question: 'Is this the real leader?',
    answer:
      'The avatar reflects the leader\'s approved voice and teachings. When you see "Reachable now" or "Live", the real person may join. Crisis keywords always trigger human follow-up.',
    audience: 'member',
  },
  {
    id: 'switch-leaders',
    question: 'How do I switch leaders?',
    answer:
      'Use "Switch Leader" on the care page or tap another leader in the directory sidebar. Your conversation history stays with each leader separately.',
    audience: 'member',
  },
  {
    id: 'manage-clergy',
    question: 'How do I manage leadership in the admin?',
    answer:
      'Open Leadership. View the team roster, open a leader profile for settings, configure AI companion persona and knowledge base, review activity and analytics, and process onboarding applications.',
    audience: 'admin',
  },
];

/** Expertise labels for member portal display (Prayer · Scripture · Guidance style). */
export const EXPERTISE_DISPLAY_LABELS: Partial<Record<HelpCategory, string>> = {
  marriage: 'Marriage',
  addiction: 'Recovery',
  grief: 'Grief',
  'faith-questions': 'Faith',
  crisis: 'Crisis',
  financial: 'Financial',
  'anxiety-depression': 'Care',
  parenting: 'Family',
  general: 'Guidance',
};

export function getExpertiseDisplayTags(areas: HelpCategory[], max = 3): string[] {
  const labels = areas.map(a => EXPERTISE_DISPLAY_LABELS[a] ?? 'Guidance');
  const withPrayer = ['Prayer', ...labels.filter(l => l !== 'Prayer')];
  return withPrayer.slice(0, max);
}

export function isCentralStaffPerson(personId: string): boolean {
  return (CENTRAL_STAFF_PERSON_IDS as readonly string[]).includes(personId);
}

export function getLeaderByPersonId(personId: string): LeaderProfile | undefined {
  return CENTRAL_HENDERSON_LEADERS.find(l => l.personId === personId);
}

export function isPastoralStaffTags(tags: string[]): boolean {
  return tags.includes('pastoral-staff');
}

export function isPastoralStaffRecord(personId: string, tags: string[]): boolean {
  return isPastoralStaffTags(tags) || isCentralStaffPerson(personId);
}

/** Resolved companion config with env fallbacks for demo leaders. */
export function getLeaderCompanionConfig(leaderId: string): LeaderCompanionConfig | undefined {
  const base = CENTRAL_HENDERSON_COMPANION_CONFIG[leaderId];
  if (!base) return undefined;
  const envAgentId = import.meta.env.VITE_DID_AGENT_ID as string | undefined;
  const envClientKey = import.meta.env.VITE_DID_CLIENT_KEY as string | undefined;
  return {
    ...base,
    didAgentId: base.didAgentId || envAgentId || undefined,
    didClientKey: base.didClientKey || envClientKey || undefined,
  };
}

export function resolveLeaderContact(
  leader: LeaderProfile,
  people: Person[] = [],
): { phone: string; email: string } {
  const stats = CENTRAL_HENDERSON_LEADER_STATS[leader.id];
  const person = leader.personId ? people.find(p => p.id === leader.personId) : undefined;
  return {
    phone: person?.phone || stats?.contactPhone || '',
    email: person?.email || stats?.contactEmail || '',
  };
}

/** Tenant-aware GRACE FAQ — Faithful Church copy when VITE_TENANT_DEFAULT=faithful */
export function getGraceAiFaq(): GraceFaqItem[] {
  if (import.meta.env.VITE_TENANT_DEFAULT !== 'faithful') return GRACE_AI_FAQ;
  const church = 'Faithful Church';
  return GRACE_AI_FAQ.map(item => ({
    ...item,
    answer: item.answer
      .replace(/Central Henderson/g, church)
      .replace(/Central Youth/g, 'Youth Ministry')
      .replace(/Central Kids/g, "Children's Ministry"),
  }));
}
