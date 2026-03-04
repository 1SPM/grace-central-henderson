import { useState, useCallback } from 'react';
import type { Announcement, AnnouncementCategory } from '../types';

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

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(DEMO_ANNOUNCEMENTS);

  const addAnnouncement = useCallback((data: {
    title: string;
    body?: string;
    imageUrl?: string;
    category: AnnouncementCategory;
    pinned: boolean;
    expiresAt?: string;
  }) => {
    const newAnnouncement: Announcement = {
      id: `ann-${Date.now()}`,
      churchId: 'demo',
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
    setAnnouncements(prev => [newAnnouncement, ...prev]);
  }, []);

  const updateAnnouncement = useCallback((id: string, data: Partial<Omit<Announcement, 'id' | 'churchId' | 'createdAt'>>) => {
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
  }, []);

  const deleteAnnouncement = useCallback((id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  }, []);

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
