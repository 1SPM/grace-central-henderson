/**
 * Faithful Church — demo tenant pastoral AI clergy roster.
 * Single source of truth for CRM Leadership hub, member portal, and People (staff).
 *
 * Faithful is a fictional demo tenant (church_id 22222222-2222-2222-2222-222222222222)
 * used for sales demos — mirrors centralHendersonLeaders.ts structurally, but every
 * name, photo, and contact detail here is fictional/synthetic. See public/demo-faces/README.md.
 */
import type { LeaderProfile, Person } from '../types';
import type { LeaderHubStats, LeaderCompanionConfig } from './leaderTypes';
import type { GraceFaqItem } from './leaderTypes';

export type { LeaderHubStats, LeaderCompanionConfig, GraceFaqItem };

/** Person IDs for Faithful staff rows in the people table (church_id 2222...). */
export const FAITHFUL_STAFF_PERSON_IDS = [
  '52aac663-0dfe-4084-b444-5d356a144b03', // Elena Castillo-Brooks
  'a021d765-5770-4e46-8c92-17018b81999c', // Jordan Mabika
  'b5283659-67e3-41c0-95d4-927b1965d555', // Renata Kessler
  'f6eddd8a-9484-4b5a-9b17-4878781e2d50', // Theo Bramwell
  'd8471d6f-3708-4678-9f15-388fd60b5815', // Naomi Larsson
  'eed0f87a-7022-46d2-bec3-9a5ca10918d4', // Caleb Voss
  '5f81c441-0181-4bc6-8e84-973f6b8fc9cb', // Zuri Adebayo
  '91783906-c90e-4de8-a10d-942e1651b380', // Mira Okonkwo
] as const;

/** Synthetic (GAN-generated, thispersondoesnotexist) headshots — see public/demo-faces/README.md. */
export const FAITHFUL_CHURCH_LEADER_PHOTOS: Record<string, string> = {
  'faithful-leader-elena-castillo-brooks': '/demo-faces/f191.jpg',
  'faithful-leader-jordan-mabika': '/demo-faces/f192.jpg',
  'faithful-leader-renata-kessler': '/demo-faces/f193.jpg',
  'faithful-leader-theo-bramwell': '/demo-faces/f194.jpg',
  'faithful-leader-naomi-larsson': '/demo-faces/f195.jpg',
  'faithful-leader-caleb-voss': '/demo-faces/f196.jpg',
  'faithful-leader-zuri-adebayo': '/demo-faces/f197.jpg',
  'faithful-leader-mira-okonkwo': '/demo-faces/f198.jpg',
};

/** Photo URL for a canonical Faithful leader id. */
export function getLeaderPhoto(leaderId: string): string | undefined {
  return FAITHFUL_CHURCH_LEADER_PHOTOS[leaderId];
}

const PERSON_ID_TO_LEADER_ID: Record<string, string> = {
  [FAITHFUL_STAFF_PERSON_IDS[0]]: 'faithful-leader-elena-castillo-brooks',
  [FAITHFUL_STAFF_PERSON_IDS[1]]: 'faithful-leader-jordan-mabika',
  [FAITHFUL_STAFF_PERSON_IDS[2]]: 'faithful-leader-renata-kessler',
  [FAITHFUL_STAFF_PERSON_IDS[3]]: 'faithful-leader-theo-bramwell',
  [FAITHFUL_STAFF_PERSON_IDS[4]]: 'faithful-leader-naomi-larsson',
  [FAITHFUL_STAFF_PERSON_IDS[5]]: 'faithful-leader-caleb-voss',
  [FAITHFUL_STAFF_PERSON_IDS[6]]: 'faithful-leader-zuri-adebayo',
  [FAITHFUL_STAFF_PERSON_IDS[7]]: 'faithful-leader-mira-okonkwo',
};

/** Photo URL for a Faithful staff person row (maps personId → leader roster). */
export function getLeaderPhotoByPersonId(personId: string): string | undefined {
  const leaderId = PERSON_ID_TO_LEADER_ID[personId];
  return leaderId ? getLeaderPhoto(leaderId) : undefined;
}

export const FAITHFUL_CHURCH_LEADERS: LeaderProfile[] = [
  {
    id: 'faithful-leader-elena-castillo-brooks',
    personId: FAITHFUL_STAFF_PERSON_IDS[0],
    displayName: 'Pastor Elena Castillo-Brooks',
    title: 'Executive Pastor',
    photo: FAITHFUL_CHURCH_LEADER_PHOTOS['faithful-leader-elena-castillo-brooks'],
    bio: 'Leads the pastoral team and Faithful\'s hybrid in-person and online congregation. Grounded in scripture and practical, everyday shepherding.',
    expertiseAreas: ['general', 'faith-questions', 'marriage'],
    credentials: ['M.Div — Fuller Theological Seminary', 'Certified Biblical Counselor'],
    yearsOfPractice: 15,
    personalityTraits: ['Warm', 'Decisive', 'Scripture-focused', 'Encouraging'],
    spiritualFocusAreas: ['Discipleship', 'Preaching', 'Vision & Leadership'],
    language: 'English',
    isVerified: true,
    isAvailable: true,
    isActive: true,
    sessionType: 'recurring',
    sessionFrequency: 'Weekly',
    suitableFor: ['Adults', 'Couples', 'Families'],
    anchors: '"Bear one another\'s burdens, and so fulfill the law of Christ." — Galatians 6:2',
    createdAt: '2019-03-10T00:00:00Z',
  },
  {
    id: 'faithful-leader-jordan-mabika',
    personId: FAITHFUL_STAFF_PERSON_IDS[1],
    displayName: 'Pastor Jordan Mabika',
    title: 'Worship Pastor',
    photo: FAITHFUL_CHURCH_LEADER_PHOTOS['faithful-leader-jordan-mabika'],
    bio: 'Directs the worship team across Sunday services and livestream production. Helps members connect with God through music and creative expression.',
    expertiseAreas: ['general', 'faith-questions'],
    credentials: ['Worship Leadership Certificate', 'Music Director — 10 years'],
    yearsOfPractice: 10,
    personalityTraits: ['Creative', 'Passionate', 'Collaborative'],
    spiritualFocusAreas: ['Worship', 'Creative Arts', 'Prayer Ministry'],
    language: 'English',
    isVerified: true,
    isAvailable: true,
    isActive: true,
    sessionType: 'recurring',
    sessionFrequency: 'Weekly',
    suitableFor: ['Musicians', 'Volunteers', 'Adults'],
    anchors: '"Sing to the Lord a new song." — Psalm 96:1',
    createdAt: '2020-06-01T00:00:00Z',
  },
  {
    id: 'faithful-leader-renata-kessler',
    personId: FAITHFUL_STAFF_PERSON_IDS[2],
    displayName: 'Pastor Renata Kessler',
    title: 'Online Campus Pastor',
    photo: FAITHFUL_CHURCH_LEADER_PHOTOS['faithful-leader-renata-kessler'],
    bio: 'Shepherds the online campus — chat moderation, digital communion, and follow-up for remote attendees.',
    expertiseAreas: ['general', 'faith-questions', 'anxiety-depression'],
    credentials: ['M.A. Pastoral Ministry', 'Digital Ministry Certificate'],
    yearsOfPractice: 8,
    personalityTraits: ['Approachable', 'Responsive', 'Tech-savvy', 'Encouraging'],
    spiritualFocusAreas: ['Online Discipleship', 'Digital Outreach'],
    language: 'English',
    isVerified: true,
    isAvailable: true,
    isActive: true,
    sessionType: 'recurring',
    sessionFrequency: 'Daily (online hours)',
    suitableFor: ['Adults', 'Remote members', 'New visitors'],
    anchors: '"Where two or three gather in my name, there am I with them." — Matthew 18:20',
    createdAt: '2021-09-15T00:00:00Z',
  },
  {
    id: 'faithful-leader-theo-bramwell',
    personId: FAITHFUL_STAFF_PERSON_IDS[3],
    displayName: 'Theo Bramwell',
    title: 'Media & Production Director',
    photo: FAITHFUL_CHURCH_LEADER_PHOTOS['faithful-leader-theo-bramwell'],
    bio: 'Runs the broadcast booth and the on-demand sermon library, keeping every service watchable live or later.',
    expertiseAreas: ['general'],
    credentials: ['B.A. Media Production', 'Live Broadcast Engineer — 9 years'],
    yearsOfPractice: 9,
    personalityTraits: ['Detail-oriented', 'Calm under pressure', 'Collaborative'],
    spiritualFocusAreas: ['Media Ministry', 'Sunday Production'],
    language: 'English',
    isVerified: true,
    isAvailable: true,
    isActive: true,
    sessionType: 'one-time',
    sessionFrequency: 'As needed',
    suitableFor: ['Volunteers', 'Media team'],
    anchors: '"Let everything that has breath praise the Lord." — Psalm 150:6',
    createdAt: '2020-01-20T00:00:00Z',
  },
  {
    id: 'faithful-leader-naomi-larsson',
    personId: FAITHFUL_STAFF_PERSON_IDS[4],
    displayName: 'Pastor Naomi Larsson',
    title: 'Care Pastor',
    photo: FAITHFUL_CHURCH_LEADER_PHOTOS['faithful-leader-naomi-larsson'],
    bio: 'Coordinates pastoral care visits and the prayer-request pipeline. Deep experience walking with members through grief and crisis.',
    expertiseAreas: ['grief', 'crisis', 'anxiety-depression', 'general'],
    credentials: ['M.A. Pastoral Care', 'Board Certified Chaplain'],
    yearsOfPractice: 12,
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
    createdAt: '2022-02-14T00:00:00Z',
  },
  {
    id: 'faithful-leader-caleb-voss',
    personId: FAITHFUL_STAFF_PERSON_IDS[5],
    displayName: 'Caleb Voss',
    title: 'Kids Ministry Director',
    photo: FAITHFUL_CHURCH_LEADER_PHOTOS['faithful-leader-caleb-voss'],
    bio: 'Oversees Sunday check-in and the kids\' online class stream, making sure every family\'s youngest members are cared for.',
    expertiseAreas: ['parenting', 'general'],
    credentials: ['Children\'s Ministry Certificate', 'Background-checked & trained'],
    yearsOfPractice: 7,
    personalityTraits: ['Playful', 'Patient', 'Organized', 'Encouraging'],
    spiritualFocusAreas: ['Kids Ministry', 'Family Ministry'],
    language: 'English',
    isVerified: true,
    isAvailable: true,
    isActive: true,
    sessionType: 'recurring',
    sessionFrequency: 'Weekly',
    suitableFor: ['Families', 'Parents', 'Kids volunteers'],
    anchors: '"Let the little children come to me." — Matthew 19:14',
    createdAt: '2021-05-03T00:00:00Z',
  },
  {
    id: 'faithful-leader-zuri-adebayo',
    personId: FAITHFUL_STAFF_PERSON_IDS[6],
    displayName: 'Pastor Zuri Adebayo',
    title: 'Youth Pastor',
    photo: FAITHFUL_CHURCH_LEADER_PHOTOS['faithful-leader-zuri-adebayo'],
    bio: 'Leads the youth group and its online community. Passionate about walking with teens through faith formation.',
    expertiseAreas: ['parenting', 'faith-questions', 'general'],
    credentials: ['M.A. Youth Ministry', 'Youth Ministry Certificate'],
    yearsOfPractice: 6,
    personalityTraits: ['Energetic', 'Relatable', 'Encouraging'],
    spiritualFocusAreas: ['Youth Ministry', 'Discipleship'],
    language: 'English',
    isVerified: true,
    isAvailable: true,
    isActive: true,
    sessionType: 'recurring',
    sessionFrequency: 'Weekly',
    suitableFor: ['Youth', 'Young Adults', 'Families'],
    anchors: '"Let no one despise your youth, but set an example." — 1 Timothy 4:12',
    createdAt: '2022-08-22T00:00:00Z',
  },
  {
    id: 'faithful-leader-mira-okonkwo',
    personId: FAITHFUL_STAFF_PERSON_IDS[7],
    displayName: 'Mira Okonkwo',
    title: 'Communications Director',
    photo: FAITHFUL_CHURCH_LEADER_PHOTOS['faithful-leader-mira-okonkwo'],
    bio: 'Manages the church\'s social channels and weekly email digest, keeping the congregation connected between Sundays.',
    expertiseAreas: ['general'],
    credentials: ['B.A. Communications', 'Digital Marketing Certificate'],
    yearsOfPractice: 5,
    personalityTraits: ['Organized', 'Creative', 'Approachable'],
    spiritualFocusAreas: ['Communications', 'Outreach'],
    language: 'English',
    isVerified: true,
    isAvailable: true,
    isActive: true,
    sessionType: 'one-time',
    sessionFrequency: 'As needed',
    suitableFor: ['Volunteers', 'Communications team'],
    anchors: '"Let your light shine before others." — Matthew 5:16',
    createdAt: '2023-01-09T00:00:00Z',
  },
];

export const FAITHFUL_CHURCH_LEADER_STATS: Record<string, LeaderHubStats> = {
  'faithful-leader-elena-castillo-brooks': {
    sessions: 42,
    aiPct: 74,
    rating: 4.7,
    dms: 9,
    blessings: 21,
    availability: ['live', 'live', 'live', 'live', 'live', 'ai', 'ai'],
    dmThreshold: '5 sessions for live DM',
    hours: 'Mon–Fri · 9a–5p',
    liveOverride: false,
    todaysBlessing:
      '"The Lord bless you and keep you; the Lord make his face shine on you." — Numbers 6:24-25.',
    careAssignments: ['Prayer & guidance', 'Crisis triage', 'Sunday follow-up'],
    contactPhone: '(555) 010-0191',
    contactEmail: 'elena.castillobrooks@faithfulchurch.example',
  },
  'faithful-leader-jordan-mabika': {
    sessions: 56,
    aiPct: 65,
    rating: 4.6,
    dms: 11,
    blessings: 20,
    availability: ['live', 'live', 'live', 'live', 'live', 'live', 'off'],
    dmThreshold: 'Open DMs for worship team; AI for general questions',
    hours: 'Mon–Sat · varies',
    liveOverride: false,
    todaysBlessing: '"Sing to the Lord a new song; sing to the Lord, all the earth." — Psalm 96:1.',
    careAssignments: ['Worship team care', 'Creative arts mentoring', 'Sunday prep prayer'],
    contactPhone: '(555) 010-0192',
    contactEmail: 'jordan.mabika@faithfulchurch.example',
  },
  'faithful-leader-renata-kessler': {
    sessions: 61,
    aiPct: 82,
    rating: 4.6,
    dms: 16,
    blessings: 19,
    availability: ['ai', 'live', 'live', 'live', 'live', 'live', 'ai'],
    dmThreshold: 'AI triage first, escalate on repeat visits',
    hours: 'Daily · 8a–8p (online hours)',
    liveOverride: false,
    todaysBlessing: '"Where two or three gather in my name, there am I with them." — Matthew 18:20.',
    careAssignments: ['Online campus chat', 'New-visitor follow-up', 'Digital communion'],
    contactPhone: '(555) 010-0193',
    contactEmail: 'renata.kessler@faithfulchurch.example',
  },
  'faithful-leader-theo-bramwell': {
    sessions: 28,
    aiPct: 40,
    rating: 4.5,
    dms: 5,
    blessings: 6,
    availability: ['live', 'live', 'live', 'live', 'live', 'off', 'off'],
    dmThreshold: 'Media team DMs only',
    hours: 'Mon–Fri · 10a–6p',
    liveOverride: false,
    todaysBlessing: '"Let everything that has breath praise the Lord." — Psalm 150:6.',
    careAssignments: ['Broadcast booth', 'Sermon library uploads'],
    contactPhone: '(555) 010-0194',
    contactEmail: 'theo.bramwell@faithfulchurch.example',
  },
  'faithful-leader-naomi-larsson': {
    sessions: 108,
    aiPct: 71,
    rating: 4.8,
    dms: 20,
    blessings: 33,
    availability: ['live', 'live', 'live', 'live', 'live', 'off', 'off'],
    dmThreshold: 'AI triage first, escalate on crisis keywords',
    hours: 'Mon–Fri · 8a–5p',
    liveOverride: false,
    todaysBlessing: '"Cast all your anxiety on him because he cares for you." — 1 Peter 5:7.',
    careAssignments: ['Care dispatch', 'Prayer requests', 'Grief support'],
    contactPhone: '(555) 010-0195',
    contactEmail: 'naomi.larsson@faithfulchurch.example',
  },
  'faithful-leader-caleb-voss': {
    sessions: 70,
    aiPct: 55,
    rating: 4.5,
    dms: 7,
    blessings: 5,
    availability: ['live', 'live', 'live', 'live', 'live', 'live', 'off'],
    dmThreshold: 'Parent DMs only; AI for general questions',
    hours: 'Sun · service hours',
    liveOverride: false,
    todaysBlessing: '"Let the little children come to me." — Matthew 19:14.',
    careAssignments: ['Sunday check-in', 'Kids online class'],
    contactPhone: '(555) 010-0196',
    contactEmail: 'caleb.voss@faithfulchurch.example',
  },
  'faithful-leader-zuri-adebayo': {
    sessions: 86,
    aiPct: 68,
    rating: 4.6,
    dms: 13,
    blessings: 41,
    availability: ['ai', 'live', 'live', 'live', 'live', 'live', 'off'],
    dmThreshold: 'AI after-hours; live during youth hours',
    hours: 'Tue–Sat · 3p–8p',
    liveOverride: false,
    todaysBlessing: '"Let no one despise your youth, but set an example." — 1 Timothy 4:12.',
    careAssignments: ['Youth check-ins', 'Family transitions'],
    contactPhone: '(555) 010-0197',
    contactEmail: 'zuri.adebayo@faithfulchurch.example',
  },
  'faithful-leader-mira-okonkwo': {
    sessions: 125,
    aiPct: 60,
    rating: 4.5,
    dms: 24,
    blessings: 20,
    availability: ['live', 'live', 'live', 'live', 'live', 'off', 'off'],
    dmThreshold: 'Open DMs',
    hours: 'Mon–Fri · 9a–5p',
    liveOverride: false,
    todaysBlessing: '"Let your light shine before others." — Matthew 5:16.',
    careAssignments: ['Social channels', 'Weekly email digest'],
    contactPhone: '(555) 010-0198',
    contactEmail: 'mira.okonkwo@faithfulchurch.example',
  },
};

export const FAITHFUL_CHURCH_COMPANION_CONFIG: Record<string, LeaderCompanionConfig> = {
  'faithful-leader-elena-castillo-brooks': {
    persona:
      'Warm, pastoral, scripture-grounded. Mirrors Pastor Elena\'s teaching style — compassionate, clear, and encouraging. Never diagnoses; always points to hope and practical next steps.',
    knowledgeBase: ['Sermon archive', 'Church statement of faith', 'Faithful service guide'],
    boundaries: ['No medical or legal advice', 'No financial transactions', 'Mandatory escalation on self-harm signals', 'Never claims to be human'],
    voiceModel: 'Standard pastoral voice (demo)',
    greeting: "Good morning — I'm Pastor Elena. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: 'Executive Pastor',
    personality: 'Warm and Pastoral',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
  'faithful-leader-jordan-mabika': {
    persona: 'Creative and worship-focused. Helps members connect with God through music, prayer, and artistic expression.',
    knowledgeBase: ['Worship set archive', 'Team roster & schedules', 'Sunday prep run sheet'],
    boundaries: ['No scheduling changes without team lead approval', 'Technical issues → AV team'],
    voiceModel: 'Standard pastoral voice (demo)',
    greeting: "Good morning — I'm Pastor Jordan. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: 'Worship Pastor',
    personality: 'Friendly and Professional',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
  'faithful-leader-renata-kessler': {
    persona: 'Approachable and responsive online-campus voice. Moderates chat warmly, follows up with new visitors, and keeps remote members connected.',
    knowledgeBase: ['Online campus guide', 'New-visitor follow-up playbook', 'Digital communion guide'],
    boundaries: ['No medical or legal advice', 'Escalate repeat crisis mentions to a live pastor'],
    voiceModel: 'Standard pastoral voice (demo)',
    greeting: "Good morning — I'm Pastor Renata. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: 'Online Campus Pastor',
    personality: 'Warm and Pastoral',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
  'faithful-leader-theo-bramwell': {
    persona: 'Practical, production-focused voice for the media team. Handles scheduling and technical questions, not pastoral care.',
    knowledgeBase: ['Broadcast run sheet', 'Sermon library index'],
    boundaries: ['No pastoral care topics — route to a pastor', 'Technical issues only'],
    voiceModel: 'Standard voice (demo)',
    greeting: "Hey — I'm Theo. Need something for Sunday's broadcast or the sermon library?",
    agentRole: 'Media & Production Director',
    personality: 'Friendly and Professional',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
  'faithful-leader-naomi-larsson': {
    persona: 'Steady, calming presence for crisis and grief. Validates pain, offers scripture comfort, escalates quickly when needed.',
    knowledgeBase: ['Crisis response playbook', 'Grief support resources', '988 & local crisis lines'],
    boundaries: ['Always share 988 on crisis signals', 'No clinical diagnosis', 'Mandatory live escalation on abuse disclosure'],
    voiceModel: 'Standard pastoral voice (demo)',
    greeting: "Good morning — I'm Pastor Naomi. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: 'Care Pastor',
    personality: 'Calm and Empathetic',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
  'faithful-leader-caleb-voss': {
    persona: 'Playful, patient voice for parents and kids-ministry volunteers. Age-appropriate, safety-first.',
    knowledgeBase: ['Kids check-in guide', 'Kids online class schedule', 'Volunteer background-check policy'],
    boundaries: ['No unsupervised contact with minors off-platform', 'Escalate safety concerns immediately'],
    voiceModel: 'Standard voice (demo)',
    greeting: "Hi — I'm Caleb from Kids Ministry! Question about Sunday check-in or the kids' class?",
    agentRole: 'Kids Ministry Director',
    personality: 'Friendly and Professional',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
  'faithful-leader-zuri-adebayo': {
    persona: 'Relatable and energetic for youth and families. Uses age-appropriate language, celebrates small wins, connects faith to everyday life.',
    knowledgeBase: ['Youth ministry curriculum', 'Parenting resources', 'Youth group schedule'],
    boundaries: ['Minor safety → mandatory live + log', 'No unsupervised youth contact off-platform', 'Escalate parental conflict to live'],
    voiceModel: 'Youth-friendly voice (demo)',
    greeting: "Good morning — I'm Pastor Zuri. What's on your heart today? You can speak or type — I'm listening.",
    agentRole: 'Youth Pastor',
    personality: 'Energetic and Relatable',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
  'faithful-leader-mira-okonkwo': {
    persona: 'Organized, approachable communications voice. Handles announcement and social-channel questions, not pastoral care.',
    knowledgeBase: ['Announcement calendar', 'Social channel guide', 'Weekly digest archive'],
    boundaries: ['No pastoral care topics — route to a pastor', 'Communications questions only'],
    voiceModel: 'Standard voice (demo)',
    greeting: "Hi — I'm Mira from Communications. Looking for an announcement or the weekly digest?",
    agentRole: 'Communications Director',
    personality: 'Friendly and Professional',
    llm: 'GPT-4.1',
    knowledgeGrounding: 'Ungrounded',
    creativity: 50,
    divinityAvatarUrl: 'https://link.divinityagi.com/Individual',
  },
};

export const FAITHFUL_GRACE_AI_FAQ: GraceFaqItem[] = [
  {
    id: 'what-is-grace',
    question: 'What is GRACE?',
    answer:
      'GRACE stands for Growth, Resource, Assistance, Community, and Engagement — your guide through Faithful Church. Start here for giving, watching live services, finding groups, registering for events, and care routing. When something personal is on your heart, connect with a leader avatar instead.',
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
      'GRACE can share livestream links, weekend service times, on-demand sermon archives, and watch-party schedules for Faithful Church experiences.',
    audience: 'both',
  },
  {
    id: 'ways-grace-helps-groups',
    question: 'How can GRACE help me find groups?',
    answer:
      'Tell GRACE your life stage or interests — GRACE matches you to small groups, youth group, kids ministry info, and volunteer teams.',
    audience: 'both',
  },
  {
    id: 'ways-grace-helps-events',
    question: 'How can GRACE help with events?',
    answer:
      'GRACE surfaces upcoming events, registration links, RSVP status, and volunteer opportunities. Ask about welcome events, baptisms, or special weekend experiences.',
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
      'A verified leader avatar is an AI companion grounded in a specific pastor or staff member\'s approved teachings, tone, and boundaries. It offers prayer, scripture, and guidance while the real leader can follow up live when needed.',
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

export function isFaithfulStaffPerson(personId: string): boolean {
  return (FAITHFUL_STAFF_PERSON_IDS as readonly string[]).includes(personId);
}

export function getLeaderByPersonId(personId: string): LeaderProfile | undefined {
  return FAITHFUL_CHURCH_LEADERS.find(l => l.personId === personId);
}

export function isPastoralStaffTags(tags: string[]): boolean {
  return tags.includes('pastoral-staff');
}

export function isPastoralStaffRecord(personId: string, tags: string[]): boolean {
  return isPastoralStaffTags(tags) || isFaithfulStaffPerson(personId);
}

/** Resolved companion config with env fallbacks for demo leaders. */
export function getLeaderCompanionConfig(leaderId: string): LeaderCompanionConfig | undefined {
  const base = FAITHFUL_CHURCH_COMPANION_CONFIG[leaderId];
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
  const stats = FAITHFUL_CHURCH_LEADER_STATS[leader.id];
  const person = leader.personId ? people.find(p => p.id === leader.personId) : undefined;
  return {
    phone: person?.phone || stats?.contactPhone || '',
    email: person?.email || stats?.contactEmail || '',
  };
}
