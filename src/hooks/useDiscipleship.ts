/**
 * useDiscipleship — loads and mutates discipleship milestones.
 *
 * When Supabase is configured milestones are persisted to the
 * `discipleship_milestones` table (migration 026). In demo / offline
 * mode the hook falls back to in-memory state seeded with sample data
 * so the UI always renders something useful.
 *
 * Auto-detection: on first load we check each person's CRM fields
 * (firstVisit, status, smallGroups) and upsert the implied milestones
 * to Supabase so historical data is not lost.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { DiscipleshipMilestone, MilestoneType, Person } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logMemberActivity } from '../lib/services/memberActivity';
import { createLogger } from '../utils/logger';

const log = createLogger('useDiscipleship');

// ---------------------------------------------------------------------------
// Demo seed (used when Supabase is not configured)
// ---------------------------------------------------------------------------
const DEMO_MILESTONES: DiscipleshipMilestone[] = [
  // Maya Thompson — "Beginning" stage (first_visit only, step-request on attended_class)
  {
    id: 'dm-maya-1', churchId: 'demo', personId: 'maya-001',
    milestoneType: 'first_visit', completedAt: '2022-01-09T00:00:00Z',
    notes: 'Welcome Sunday — came alone, introduced herself after service',
    verifiedBy: 'Pastor James Wilson', createdAt: '2022-01-09T00:00:00Z',
  },
  {
    id: 'dm-1', churchId: 'demo', personId: 'person-1',
    milestoneType: 'first_visit', completedAt: '2024-06-15T00:00:00Z',
    notes: 'Came with a friend from work', verifiedBy: 'Pastor Mike',
    createdAt: '2024-06-15T00:00:00Z',
  },
  {
    id: 'dm-2', churchId: 'demo', personId: 'person-1',
    milestoneType: 'attended_class', completedAt: '2024-08-20T00:00:00Z',
    notes: 'Completed New Members Class', verifiedBy: 'Pastor Sarah',
    createdAt: '2024-08-20T00:00:00Z',
  },
  {
    id: 'dm-3', churchId: 'demo', personId: 'person-1',
    milestoneType: 'baptized', completedAt: '2024-10-06T00:00:00Z',
    notes: 'Baptized during Sunday service', verifiedBy: 'Pastor Mike',
    createdAt: '2024-10-06T00:00:00Z',
  },
  {
    id: 'dm-4', churchId: 'demo', personId: 'person-1',
    milestoneType: 'joined_group', completedAt: '2024-11-01T00:00:00Z',
    notes: "Joined Men's Bible Study", createdAt: '2024-11-01T00:00:00Z',
  },
  {
    id: 'dm-5', churchId: 'demo', personId: 'person-2',
    milestoneType: 'first_visit', completedAt: '2024-09-01T00:00:00Z',
    createdAt: '2024-09-01T00:00:00Z',
  },
  {
    id: 'dm-6', churchId: 'demo', personId: 'person-2',
    milestoneType: 'attended_class', completedAt: '2024-11-15T00:00:00Z',
    createdAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'dm-7', churchId: 'demo', personId: 'person-3',
    milestoneType: 'first_visit', completedAt: '2025-01-10T00:00:00Z',
    createdAt: '2025-01-10T00:00:00Z',
  },
];

function rowToMilestone(row: Record<string, unknown>): DiscipleshipMilestone {
  return {
    id: row.id as string,
    churchId: row.church_id as string,
    personId: row.person_id as string,
    milestoneType: row.milestone_type as MilestoneType,
    completedAt: row.completed_at as string,
    notes: (row.notes as string | null) ?? undefined,
    verifiedBy: (row.verified_by as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export function useDiscipleship(people?: Person[], churchId?: string) {
  const [milestones, setMilestones] = useState<DiscipleshipMilestone[]>(
    isSupabaseConfigured() ? [] : DEMO_MILESTONES,
  );
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());
  const autoDetectedRef = useRef(false);

  // ----- Load from Supabase -----------------------------------------------
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase || !churchId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      const { data, error } = await supabase!
        .from('discipleship_milestones')
        .select('*')
        .eq('church_id', churchId)
        .order('completed_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        log.warn('milestone load failed', error.message);
      } else {
        setMilestones((data ?? []).map(rowToMilestone));
      }
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [churchId]);

  // ----- Auto-detect from person CRM fields --------------------------------
  useEffect(() => {
    if (!people || !churchId || !isSupabaseConfigured() || !supabase) return;
    if (autoDetectedRef.current || isLoading) return;
    autoDetectedRef.current = true;

    const toUpsert: Array<{
      church_id: string; person_id: string; milestone_type: string; completed_at: string; notes: string;
    }> = [];

    people.forEach(person => {
      const personMilestones = milestones.filter(m => m.personId === person.id);
      const has = (type: MilestoneType) => personMilestones.some(m => m.milestoneType === type);

      if (person.firstVisit && !has('first_visit')) {
        toUpsert.push({
          church_id: churchId, person_id: person.id,
          milestone_type: 'first_visit', completed_at: person.firstVisit,
          notes: 'Auto-detected from first visit date',
        });
      }
      if (person.status === 'leader' && !has('leading')) {
        toUpsert.push({
          church_id: churchId, person_id: person.id,
          milestone_type: 'leading',
          completed_at: person.joinDate || new Date().toISOString(),
          notes: 'Auto-detected from leader status',
        });
      }
      if (person.smallGroups && person.smallGroups.length > 0 && !has('joined_group')) {
        toUpsert.push({
          church_id: churchId, person_id: person.id,
          milestone_type: 'joined_group',
          completed_at: person.joinDate || new Date().toISOString(),
          notes: 'Auto-detected from group membership',
        });
      }
    });

    if (toUpsert.length === 0) return;

    void supabase!
      .from('discipleship_milestones')
      .upsert(toUpsert, { onConflict: 'church_id,person_id,milestone_type', ignoreDuplicates: true })
      .select('*')
      .then(({ data, error }) => {
        if (error) { log.warn('auto-detect upsert failed', error.message); return; }
        if (data && data.length > 0) {
          setMilestones(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = (data as Record<string, unknown>[])
              .map(rowToMilestone)
              .filter(m => !existingIds.has(m.id));
            return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
          });
        }
      });
  }, [people, churchId, isLoading, milestones]);

  // ----- Mutations --------------------------------------------------------
  const addMilestone = useCallback(async (data: {
    personId: string;
    milestoneType: MilestoneType;
    completedAt?: string;
    notes?: string;
    verifiedBy?: string;
  }) => {
    if (!isSupabaseConfigured() || !supabase || !churchId) {
      // Demo mode — in-memory only
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
      return;
    }

    const { data: rows, error } = await supabase!
      .from('discipleship_milestones')
      .upsert({
        church_id: churchId,
        person_id: data.personId,
        milestone_type: data.milestoneType,
        completed_at: data.completedAt || new Date().toISOString(),
        notes: data.notes ?? null,
        verified_by: data.verifiedBy ?? null,
      }, { onConflict: 'church_id,person_id,milestone_type' })
      .select('*')
      .single();

    if (error) { log.warn('addMilestone failed', error.message); return; }
    if (rows) {
      const milestone = rowToMilestone(rows as Record<string, unknown>);
      setMilestones(prev => {
        const without = prev.filter(
          m => !(m.personId === data.personId && m.milestoneType === data.milestoneType),
        );
        return [...without, milestone];
      });

      // Fire a portal activity event so admin Portal Activity captures the milestone
      logMemberActivity({
        churchId,
        personId: data.personId,
        eventType: 'milestone_achieved',
        entityType: 'discipleship_milestone',
        entityId: milestone.id,
        metadata: { milestone_type: data.milestoneType, verified_by: data.verifiedBy },
      });
    }
  }, [churchId]);

  const removeMilestone = useCallback(async (id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
    if (!isSupabaseConfigured() || !supabase) return;
    const { error } = await supabase!
      .from('discipleship_milestones')
      .delete()
      .eq('id', id);
    if (error) {
      log.warn('removeMilestone failed', error.message);
      // Note: we already removed from local state; a reload will reconcile
    }
  }, []);

  const updateMilestone = useCallback(async (
    id: string,
    data: Partial<Pick<DiscipleshipMilestone, 'completedAt' | 'notes' | 'verifiedBy'>>,
  ) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
    if (!isSupabaseConfigured() || !supabase) return;
    const { error } = await supabase!
      .from('discipleship_milestones')
      .update({
        ...(data.completedAt ? { completed_at: data.completedAt } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.verifiedBy !== undefined ? { verified_by: data.verifiedBy } : {}),
      })
      .eq('id', id);
    if (error) log.warn('updateMilestone failed', error.message);
  }, []);

  const getPersonMilestones = useCallback((personId: string) => {
    return milestones.filter(m => m.personId === personId);
  }, [milestones]);

  return {
    milestones,
    isLoading,
    addMilestone,
    removeMilestone,
    updateMilestone,
    getPersonMilestones,
  };
}
