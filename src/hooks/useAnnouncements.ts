/**
 * Announcements — church-published content rendered in the member portal
 * feed and managed from the admin Announcements page.
 *
 * Backed by the `announcements` table (migration 018). Falls back to
 * in-memory demo data when Supabase is not configured so the demo
 * experience is unchanged.
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createLogger } from '../utils/logger';
import type { Announcement, AnnouncementCategory } from '../types';
import type { AnnouncementRow } from '../lib/database.types';

const log = createLogger('announcements');

const now = new Date().toISOString();
const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const DEMO_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    churchId: 'demo',
    title: 'Easter Service — Special Schedule',
    body: 'Join us for our Easter celebration! Services at 7 AM (Sunrise), 9 AM, and 11 AM. Invite your friends and family for this special day.',
    category: 'event',
    pinned: true,
    publishedAt: now,
    expiresAt: nextWeek,
    createdBy: 'Pastor Mike',
    createdAt: now,
  },
  {
    id: 'ann-2',
    churchId: 'demo',
    title: 'Volunteers Needed for Food Drive',
    body: 'Our annual food drive is coming up next Saturday. We need 20 volunteers to help sort and distribute donations. Sign up at the welcome desk.',
    category: 'general',
    pinned: false,
    publishedAt: weekAgo,
    createdBy: 'Admin',
    createdAt: weekAgo,
  },
  {
    id: 'ann-3',
    churchId: 'demo',
    title: 'Building Expansion Update',
    body: 'Construction on the new youth center is on track! Expected completion in June. Thank you for your generous giving that made this possible.',
    category: 'update',
    pinned: false,
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Pastor Mike',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ann-4',
    churchId: 'demo',
    title: 'Parking Lot Closure This Sunday',
    body: 'The east parking lot will be closed for repaving. Please use the west lot or street parking. Shuttle service available from the overflow lot.',
    category: 'urgent',
    pinned: true,
    publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Admin',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function fromRow(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    churchId: row.church_id,
    title: row.title,
    body: row.body ?? undefined,
    imageUrl: row.image_url ?? undefined,
    category: row.category as AnnouncementCategory,
    pinned: row.pinned,
    publishedAt: row.published_at,
    expiresAt: row.expires_at ?? undefined,
    createdBy: row.created_by_name ?? undefined,
    createdAt: row.created_at,
  };
}

export function useAnnouncements(churchId: string = 'demo-church') {
  const useDb = isSupabaseConfigured() && !!supabase;
  const [announcements, setAnnouncements] = useState<Announcement[]>(useDb ? [] : DEMO_ANNOUNCEMENTS);

  // Hydrate from Supabase.
  useEffect(() => {
    if (!useDb || !supabase) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('church_id', churchId)
        .order('published_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        // Table may not exist yet in older deployments — keep demo data usable.
        log.warn('announcements load failed, using demo data', error.message);
        setAnnouncements(DEMO_ANNOUNCEMENTS);
        return;
      }
      setAnnouncements(((data ?? []) as AnnouncementRow[]).map(fromRow));
    })();
    return () => { cancelled = true; };
  }, [useDb, churchId]);

  const addAnnouncement = useCallback((data: {
    title: string;
    body?: string;
    imageUrl?: string;
    category: AnnouncementCategory;
    pinned: boolean;
    expiresAt?: string;
  }) => {
    const local: Announcement = {
      id: `ann-${Date.now()}`,
      churchId,
      title: data.title,
      body: data.body,
      imageUrl: data.imageUrl,
      category: data.category,
      pinned: data.pinned,
      publishedAt: new Date().toISOString(),
      expiresAt: data.expiresAt,
      createdBy: 'You',
      createdAt: new Date().toISOString(),
    };
    setAnnouncements(prev => [local, ...prev]);

    if (useDb && supabase) {
      void supabase
        .from('announcements')
        .insert({
          church_id: churchId,
          title: data.title,
          body: data.body ?? null,
          image_url: data.imageUrl ?? null,
          category: data.category,
          pinned: data.pinned,
          expires_at: data.expiresAt ?? null,
        })
        .select()
        .single()
        .then(({ data: row, error }) => {
          if (error || !row) {
            log.warn('announcement insert failed', error?.message);
            return;
          }
          // Swap the optimistic row for the persisted one.
          setAnnouncements(prev => prev.map(a => (a.id === local.id ? fromRow(row as AnnouncementRow) : a)));
        });
    }
  }, [useDb, churchId]);

  const updateAnnouncement = useCallback((id: string, data: Partial<Omit<Announcement, 'id' | 'churchId' | 'createdAt'>>) => {
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));

    if (useDb && supabase) {
      const updates: Record<string, unknown> = {};
      if (data.title !== undefined) updates.title = data.title;
      if (data.body !== undefined) updates.body = data.body ?? null;
      if (data.imageUrl !== undefined) updates.image_url = data.imageUrl ?? null;
      if (data.category !== undefined) updates.category = data.category;
      if (data.pinned !== undefined) updates.pinned = data.pinned;
      if (data.expiresAt !== undefined) updates.expires_at = data.expiresAt ?? null;
      if (Object.keys(updates).length === 0) return;
      void supabase
        .from('announcements')
        .update(updates)
        .eq('id', id)
        .then(({ error }) => {
          if (error) log.warn('announcement update failed', error.message);
        });
    }
  }, [useDb]);

  const deleteAnnouncement = useCallback((id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));

    if (useDb && supabase) {
      void supabase
        .from('announcements')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) log.warn('announcement delete failed', error.message);
        });
    }
  }, [useDb]);

  // Filter out expired announcements for display
  const activeAnnouncements = announcements.filter(a => {
    if (!a.expiresAt) return true;
    return new Date(a.expiresAt) > new Date();
  });

  return {
    announcements,
    activeAnnouncements,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
  };
}
