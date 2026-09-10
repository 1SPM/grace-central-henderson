import type { Person, DiscipleshipMilestone, MilestoneType } from '../types';
import { DEFAULT_MILESTONE_DEFINITIONS } from '../types';
import type { MemberActivityEvent } from './database.types';

const ADVANCED_MILESTONES: MilestoneType[] = [
  'attended_class',
  'baptized',
  'joined_group',
  'serving',
  'leading',
];

const STEP3_PLUS: MilestoneType[] = ['baptized', 'joined_group', 'serving', 'leading'];

export interface DiscipleshipMetrics {
  funnelStats: Array<{
    type: MilestoneType;
    label: string;
    color: string;
    count: number;
    pct: number;
  }>;
  needsNextStep: Person[];
  avgMilestones: string;
  atStep3Plus: number;
  milestonesByPerson: Map<string, Set<string>>;
}

export function computeDiscipleshipMetrics(
  people: Person[],
  milestones: DiscipleshipMilestone[],
): DiscipleshipMetrics {
  const milestonesByPerson = new Map<string, Set<string>>();
  milestones.forEach(m => {
    if (!milestonesByPerson.has(m.personId)) milestonesByPerson.set(m.personId, new Set());
    milestonesByPerson.get(m.personId)!.add(m.milestoneType);
  });

  const totalPeople = people.length;

  const funnelStats = DEFAULT_MILESTONE_DEFINITIONS.map(def => ({
    type: def.type,
    label: def.label,
    color: def.color,
    count: people.filter(p => milestonesByPerson.get(p.id)?.has(def.type)).length,
    pct: totalPeople > 0
      ? Math.round((people.filter(p => milestonesByPerson.get(p.id)?.has(def.type)).length / totalPeople) * 100)
      : 0,
  }));

  const activePeopleList = people.filter(p =>
    ['visitor', 'regular', 'member', 'leader'].includes(p.status),
  );
  const needsNextStep = activePeopleList.filter(p => {
    const types = milestonesByPerson.get(p.id);
    if (!types) return true;
    return !ADVANCED_MILESTONES.some(t => types.has(t));
  });

  const peopleWithMilestones = people.filter(p => milestonesByPerson.has(p.id));
  const avgMilestones = peopleWithMilestones.length > 0
    ? (milestones.length / peopleWithMilestones.length).toFixed(1)
    : '0';

  const atStep3Plus = people.filter(p => {
    const types = milestonesByPerson.get(p.id);
    if (!types) return false;
    return STEP3_PLUS.some(t => types.has(t));
  }).length;

  return { funnelStats, needsNextStep, avgMilestones, atStep3Plus, milestonesByPerson };
}

/** personId -> milestone types requested via My Journey portal */
export function buildStepRequestsByPerson(
  portalEvents: MemberActivityEvent[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  portalEvents
    .filter(e => e.event_type === 'milestone_step_request' && e.person_id)
    .forEach(e => {
      const type = String(e.metadata?.milestone_type ?? '');
      if (!type) return;
      if (!map.has(e.person_id!)) map.set(e.person_id!, new Set());
      map.get(e.person_id!)!.add(type);
    });
  return map;
}

/** Members with open step requests who aren't already in needsNextStep */
export function getStepRequestFollowUps(
  people: Person[],
  stepRequestsByPerson: Map<string, Set<string>>,
  needsNextStepIds: Set<string>,
): Person[] {
  return people.filter(p =>
    stepRequestsByPerson.has(p.id) && stepRequestsByPerson.get(p.id)!.size > 0 && !needsNextStepIds.has(p.id),
  );
}
