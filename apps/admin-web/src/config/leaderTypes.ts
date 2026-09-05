/**
 * Shared types for per-tenant leadership roster configs
 * (centralHendersonLeaders.ts, faithfulChurchLeaders.ts). Both configs
 * import from here rather than one importing from the other, so neither
 * tenant's data module depends on another tenant's.
 */
import type { HelpCategory } from '../types';

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

/** Expertise labels for member portal display (Prayer · Scripture · Guidance style). Tenant-agnostic. */
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
