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
    churchId: 'demo-church',
    title: 'Summer BBQ Fellowship — Save the Date',
    body: 'Join us Monday, July 27th at 7 AM for our Summer BBQ Fellowship! Food, games, and worship in the courtyard. Bring a friend and a side dish to share.',
    category: 'event',
    pinned: true,
    publishedAt: now,
    expiresAt: nextWeek,
    createdBy: 'Pastor James Wilson',
    createdAt: now,
  },
  {
    id: 'ann-2',
    churchId: 'demo-church',
    title: 'Volunteers Needed for Food Pantry Distribution',
    body: 'Our Food Pantry Distribution is this Thursday at 10 AM. We need volunteers to help sort, pack, and distribute to families in need. Sign up in the Connect tab.',
    category: 'general',
    pinned: false,
    publishedAt: weekAgo,
    createdBy: 'Deacon Marcus Collins',
    createdAt: weekAgo,
  },
  {
    id: 'ann-3',
    churchId: 'demo-church',
    title: 'Building Fund Update: 68% to Goal',
    body: 'Thanks to your generous giving, the Building Fund is now 68% of the way to our youth center goal. Every gift routed through your Impact Card counts toward this.',
    category: 'update',
    pinned: false,
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Pastor James Wilson',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ann-4',
    churchId: 'demo-church',
    title: 'Baptism Sunday — Coming Up',
    body: 'We’re celebrating baptisms this Sunday! If you or a family member would like to be baptized, stop by the welcome desk or message Pastor James this week.',
    category: 'celebration',
    pinned: false,
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Pastor James Wilson',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ann-5',
    churchId: 'demo-church',
    title: 'Parking Lot Closure This Sunday',
    body: 'The east parking lot will be closed for repaving this Sunday. Please use the west lot or street parking. Shuttle service available from the overflow lot.',
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
      const rows = (data ?? []) as AnnouncementRow[];
      // Real-data-with-demo-fallback: a successful query with zero rows
      // (no announcements published yet) is a different case from an
      // error, but reads just as empty to a visitor — same pattern as the
      // Leadership/Attendance fallbacks elsewhere in this app.
      setAnnouncements(rows.length > 0 ? rows.map(fromRow) : DEMO_ANNOUNCEMENTS);
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
