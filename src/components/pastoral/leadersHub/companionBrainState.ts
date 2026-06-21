import type { LeaderCompanionConfig } from '../../../config/centralHendersonLeaders';
import type { LeaderProfile } from '../../../types';
import { demoCompanionConfig } from './demoLeadersHub';

export type KnowledgeGrounding = 'Ungrounded' | 'Grounded' | 'Hybrid';
export type KnowledgeSource = 'text' | 'files';

export interface CompanionBrainState {
  greetings: string[];
  conversationStarters: string[];
  topicsToAvoid: string[];
  maxResponseLength: { enabled: boolean; words: number };
  agentRole: string;
  personality: string;
  agentPrompt: string;
  llm: string;
  knowledgeGrounding: KnowledgeGrounding;
  creativity: number;
  knowledgeSource: KnowledgeSource;
  knowledgeText: string;
  knowledgeTags: string[];
  voiceModel: string;
}

export const PERSONALITY_OPTIONS = [
  'Friendly and Professional',
  'Warm and Pastoral',
  'Calm and Empathetic',
  'Energetic and Relatable',
  'Direct and Practical',
] as const;

export const LLM_OPTIONS = ['GPT-4.1', 'GPT-4o', 'Claude 3.5 Sonnet'] as const;

export const GROUNDING_OPTIONS: { value: KnowledgeGrounding; description: string }[] = [
  { value: 'Ungrounded', description: 'Relies only on its own knowledge base, ignoring uploaded data' },
  { value: 'Grounded', description: 'Sticks to provided knowledge snippets and uploaded files' },
  { value: 'Hybrid', description: 'Uses uploaded data first, then broader insights when needed' },
];

const DEFAULT_GREETING =
  "Good morning — I'm here to listen. What's on your heart today? You can speak or type — I'm listening.";

export function buildBrainState(
  companion: LeaderCompanionConfig | undefined,
  leader: LeaderProfile,
): CompanionBrainState {
  const cfg = companion ?? {
    persona: demoCompanionConfig.brain.persona,
    knowledgeBase: demoCompanionConfig.brain.knowledgeBase,
    boundaries: demoCompanionConfig.brain.boundaries,
    voiceModel: demoCompanionConfig.brain.voiceModel,
    greeting: demoCompanionConfig.brain.greeting,
    agentRole: demoCompanionConfig.brain.agentRole,
    personality: demoCompanionConfig.brain.personality,
    llm: demoCompanionConfig.brain.llm,
    knowledgeGrounding: demoCompanionConfig.brain.knowledgeGrounding,
    creativity: demoCompanionConfig.brain.creativity,
    knowledgeText: demoCompanionConfig.brain.knowledgeText,
  };

  const rawGreeting = cfg.greeting?.replace(/^"|"$/g, '').trim();
  const greeting = rawGreeting || DEFAULT_GREETING;

  return {
    greetings: [greeting],
    conversationStarters: [],
    topicsToAvoid: [...cfg.boundaries],
    maxResponseLength: { enabled: false, words: 150 },
    agentRole: cfg.agentRole ?? leader.title ?? '',
    personality: cfg.personality ?? 'Friendly and Professional',
    agentPrompt: cfg.persona,
    llm: cfg.llm ?? 'GPT-4.1',
    knowledgeGrounding: cfg.knowledgeGrounding ?? 'Ungrounded',
    creativity: cfg.creativity ?? 50,
    knowledgeSource: 'text',
    knowledgeText: cfg.knowledgeText ?? '',
    knowledgeTags: [...cfg.knowledgeBase],
    voiceModel: cfg.voiceModel,
  };
}
