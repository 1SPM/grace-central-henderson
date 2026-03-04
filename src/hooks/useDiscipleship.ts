import { useState, useCallback, useEffect } from 'react';
import type { DiscipleshipMilestone, MilestoneType, Person } from '../types';

const DEMO_MILESTONES: DiscipleshipMilestone[] = [
  {
    id: 'dm-1',
    churchId: 'demo',
    personId: 'person-1',
    milestoneType: 'first_visit',
    completedAt: '2024-06-15T00:00:00Z',
    notes: 'Came with a friend from work',
    verifiedBy: 'Pastor Mike',
    createdAt: '2024-06-15T00:00:00Z',
  },
  {
    id: 'dm-2',
    churchId: 'demo',
    personId: 'person-1',
    milestoneType: 'attended_class',
    completedAt: '2024-08-20T00:00:00Z',
    notes: 'Completed New Members Class',
    verifiedBy: 'Pastor Sarah',
    createdAt: '2024-08-20T00:00:00Z',
  },
  {
    id: 'dm-3',
    churchId: 'demo',
    personId: 'person-1',
    milestoneType: 'baptized',
    completedAt: '2024-10-06T00:00:00Z',
    notes: 'Baptized during Sunday service',
    verifiedBy: 'Pastor Mike',
    createdAt: '2024-10-06T00:00:00Z',
  },
  {
    id: 'dm-4',
    churchId: 'demo',
    personId: 'person-1',
    milestoneType: 'joined_group',
    completedAt: '2024-11-01T00:00:00Z',
    notes: 'Joined Men\'s Bible Study',
    createdAt: '2024-11-01T00:00:00Z',
  },
  {
    id: 'dm-5',
    churchId: 'demo',
    personId: 'person-2',
    milestoneType: 'first_visit',
    completedAt: '2024-09-01T00:00:00Z',
    createdAt: '2024-09-01T00:00:00Z',
  },
  {
    id: 'dm-6',
    churchId: 'demo',
    personId: 'person-2',
    milestoneType: 'attended_class',
    completedAt: '2024-11-15T00:00:00Z',
    createdAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'dm-7',
    churchId: 'demo',
    personId: 'person-3',
    milestoneType: 'first_visit',
    completedAt: '2025-01-10T00:00:00Z',
    createdAt: '2025-01-10T00:00:00Z',
  },
];

export function useDiscipleship(people?: Person[]) {
  const [milestones, setMilestones] = useState<DiscipleshipMilestone[]>(DEMO_MILESTONES);

  // Auto-detect milestones from person data
  useEffect(() => {
    if (!people) return;

    const autoMilestones: DiscipleshipMilestone[] = [];

    people.forEach(person => {
      const personMilestones = milestones.filter(m => m.personId === person.id);
      const has = (type: MilestoneType) => personMilestones.some(m => m.milestoneType === type);

      // firstVisit → auto-create first_visit milestone
      if (person.firstVisit && !has('first_visit')) {
        autoMilestones.push({
          id: `auto-fv-${person.id}`,
          churchId: 'demo',
          personId: person.id,
          milestoneType: 'first_visit',
          completedAt: person.firstVisit,
          notes: 'Auto-detected from first visit date',
          createdAt: new Date().toISOString(),
        });
      }

      // status === 'leader' → auto-create leading milestone
      if (person.status === 'leader' && !has('leading')) {
        autoMilestones.push({
          id: `auto-lead-${person.id}`,
          churchId: 'demo',
          personId: person.id,
          milestoneType: 'leading',
          completedAt: person.joinDate || new Date().toISOString(),
          notes: 'Auto-detected from leader status',
          createdAt: new Date().toISOString(),
        });
      }

      // smallGroups.length > 0 → auto-create joined_group milestone
      if (person.smallGroups && person.smallGroups.length > 0 && !has('joined_group')) {
        autoMilestones.push({
          id: `auto-grp-${person.id}`,
          churchId: 'demo',
          personId: person.id,
          milestoneType: 'joined_group',
          completedAt: person.joinDate || new Date().toISOString(),
          notes: 'Auto-detected from group membership',
          createdAt: new Date().toISOString(),
        });
      }
    });

    if (autoMilestones.length > 0) {
      setMilestones(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newOnes = autoMilestones.filter(m => !existingIds.has(m.id));
        return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
      });
    }
  }, [people]); // eslint-disable-line react-hooks/exhaustive-deps

  const addMilestone = useCallback((data: {
    personId: string;
    milestoneType: MilestoneType;
    completedAt?: string;
    notes?: string;
    verifiedBy?: string;
  }) => {
    const newMilestone: DiscipleshipMilestone = {
      id: `dm-${Date.now()}`,
      churchId: 'demo',
      personId: data.personId,
      milestoneType: data.milestoneType,
      completedAt: data.completedAt || new Date().toISOString(),
      notes: data.notes,
      verifiedBy: data.verifiedBy,
      createdAt: new Date().toISOString(),
    };
    setMilestones(prev => [...prev, newMilestone]);
  }, []);

  const removeMilestone = useCallback((id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  }, []);

  const updateMilestone = useCallback((id: string, data: Partial<Pick<DiscipleshipMilestone, 'completedAt' | 'notes' | 'verifiedBy'>>) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
  }, []);

  const getPersonMilestones = useCallback((personId: string) => {
    return milestones.filter(m => m.personId === personId);
  }, [milestones]);

  return {
    milestones,
    addMilestone,
    removeMilestone,
    updateMilestone,
    getPersonMilestones,
  };
}
