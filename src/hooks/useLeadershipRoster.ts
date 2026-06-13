import { useMemo } from 'react';
import type { LeaderProfile, Person } from '../types';

function isPastoralTitle(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes('pastor') || t.includes('deacon') || t.includes('clergy') || t.includes('chaplain');
}

function personToLeader(person: Person): LeaderProfile {
  const name = `${person.firstName} ${person.lastName}`.trim();
  const titleFromTags = person.tags?.find(tag =>
    /pastor|deacon|clergy|staff|director|minister/i.test(tag),
  );
  return {
    id: `people-leader-${person.id}`,
    personId: person.id,
    displayName: name,
    title: titleFromTags ?? (person.status === 'leader' ? 'Church leader' : 'Staff'),
    bio: person.notes ?? 'Congregation leadership team member.',
    expertiseAreas: ['general'],
    credentials: [],
    personalityTraits: [],
    spiritualFocusAreas: [],
    language: 'English',
    isVerified: false,
    isAvailable: true,
    isActive: true,
    hasAiCompanion: false,
    leaderSource: 'people',
    createdAt: person.joinDate ?? new Date().toISOString(),
  };
}

/** Merge pastoral roster with people.status=leader not already linked. */
export function useLeadershipRoster(
  leaders: LeaderProfile[],
  people: Person[],
): LeaderProfile[] {
  return useMemo(() => {
    const base = leaders.length > 0 ? leaders : [];
    const linkedPersonIds = new Set(
      base.map(l => l.personId).filter((id): id is string => !!id),
    );

    const fromPeople = people
      .filter(p => p.status === 'leader' && !linkedPersonIds.has(p.id))
      .map(personToLeader);

    const merged = [
      ...base.map(l => ({
        ...l,
        hasAiCompanion: l.hasAiCompanion ?? (l.isActive && l.isVerified),
        leaderSource: l.leaderSource ?? ('roster' as const),
      })),
      ...fromPeople,
    ];

    return merged.sort((a, b) => {
      const aPastor = isPastoralTitle(a.title) ? 0 : 1;
      const bPastor = isPastoralTitle(b.title) ? 0 : 1;
      if (aPastor !== bPastor) return aPastor - bPastor;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [leaders, people]);
}

export function countLeadershipBadges(roster: LeaderProfile[]) {
  const active = roster.filter(l => l.isActive);
  return {
    staff: active.length,
    aiDeployed: active.filter(l => l.hasAiCompanion !== false).length,
    humanOnly: active.filter(l => l.hasAiCompanion === false).length,
  };
}
