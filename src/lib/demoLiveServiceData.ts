/**
 * Demo data for Live Service dashboard — mirrors Central Henderson Watch page.
 */

import type { WatchChatMessageRow, WatchSermonRow } from './database.types';

export const DEMO_CHURCH_ID = 'demo-church';

export const DEMO_VIEWER_COUNT = 342;

export const DEMO_GIFTS_THIS_SERVICE = 387;

export interface DemoGiftNotification {
  id: string;
  personName: string;
  amount: number;
  fund: string;
  createdAt: string;
}

export function cloneDemoChat(): WatchChatMessageRow[] {
  const now = Date.now();
  return [
    {
      id: 'demo-chat-1',
      church_id: DEMO_CHURCH_ID,
      person_id: 'person-rachel',
      author_name: 'Rachel G.',
      body: 'This message is for me today.',
      is_hidden: false,
      created_at: new Date(now - 120_000).toISOString(),
    },
    {
      id: 'demo-chat-2',
      church_id: DEMO_CHURCH_ID,
      person_id: 'person-kevin',
      author_name: 'Kevin H.',
      body: 'Watching with the whole family.',
      is_hidden: false,
      created_at: new Date(now - 90_000).toISOString(),
    },
    {
      id: 'demo-chat-3',
      church_id: DEMO_CHURCH_ID,
      person_id: 'person-maria',
      author_name: 'Maria S.',
      body: 'Amen! Powerful word.',
      is_hidden: false,
      created_at: new Date(now - 60_000).toISOString(),
    },
    {
      id: 'demo-chat-4',
      church_id: DEMO_CHURCH_ID,
      person_id: 'person-david',
      author_name: 'David T.',
      body: 'Praying for everyone tuning in.',
      is_hidden: false,
      created_at: new Date(now - 45_000).toISOString(),
    },
    {
      id: 'demo-chat-5',
      church_id: DEMO_CHURCH_ID,
      person_id: 'person-sarah',
      author_name: 'Sarah J.',
      body: 'So grateful for online church.',
      is_hidden: false,
      created_at: new Date(now - 30_000).toISOString(),
    },
  ];
}

export function cloneDemoSermons(): WatchSermonRow[] {
  return [
    {
      id: 'demo-sermon-1',
      church_id: DEMO_CHURCH_ID,
      title: 'Part 3 — The Power of Forgiveness',
      series_title: 'HONOR EACH OTHER',
      part_label: 'Part 3',
      speaker: 'Pastor James Wilson',
      preached_at: '2025-05-18',
      duration_seconds: 3134,
      view_count: 1200,
      thumbnail_url: 'https://images.unsplash.com/photo-1501386761578-eacae83a7a62?w=400&h=225&fit=crop',
      video_url: null,
      created_at: '2025-05-18T12:00:00Z',
      updated_at: '2025-05-18T12:00:00Z',
    },
    {
      id: 'demo-sermon-2',
      church_id: DEMO_CHURCH_ID,
      title: 'Part 2 — Speaking Life',
      series_title: 'HONOR EACH OTHER',
      part_label: 'Part 2',
      speaker: 'Pastor James Wilson',
      preached_at: '2025-05-11',
      duration_seconds: 2980,
      view_count: 980,
      thumbnail_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=225&fit=crop',
      video_url: null,
      created_at: '2025-05-11T12:00:00Z',
      updated_at: '2025-05-11T12:00:00Z',
    },
    {
      id: 'demo-sermon-3',
      church_id: DEMO_CHURCH_ID,
      title: 'Part 1 — The Foundation',
      series_title: 'HONOR EACH OTHER',
      part_label: 'Part 1',
      speaker: 'Pastor James Wilson',
      preached_at: '2025-05-04',
      duration_seconds: 3050,
      view_count: 1100,
      thumbnail_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=225&fit=crop',
      video_url: null,
      created_at: '2025-05-04T12:00:00Z',
      updated_at: '2025-05-04T12:00:00Z',
    },
    {
      id: 'demo-sermon-4',
      church_id: DEMO_CHURCH_ID,
      title: 'Rooted in Grace',
      series_title: 'ROOTS',
      part_label: null,
      speaker: 'Pastor James Wilson',
      preached_at: '2025-04-27',
      duration_seconds: 2890,
      view_count: 870,
      thumbnail_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop',
      video_url: null,
      created_at: '2025-04-27T12:00:00Z',
      updated_at: '2025-04-27T12:00:00Z',
    },
  ];
}

export const DEMO_GIFT_NOTIFICATIONS: DemoGiftNotification[] = [
  { id: 'demo-gift-1', personName: 'sarah j.', amount: 25, fund: 'Tithe', createdAt: new Date(Date.now() - 180_000).toISOString() },
  { id: 'demo-gift-2', personName: 'michael r.', amount: 50, fund: 'Missions', createdAt: new Date(Date.now() - 300_000).toISOString() },
  { id: 'demo-gift-3', personName: 'lisa m.', amount: 100, fund: 'Tithe', createdAt: new Date(Date.now() - 420_000).toISOString() },
];

export const DEMO_CHAT_SNIPPETS = [
  { author: 'James P.', body: 'Praise God for this message!' },
  { author: 'Emily W.', body: 'First time watching online — love it!' },
  { author: 'Chris L.', body: 'Sending love from Henderson.' },
  { author: 'Anna K.', body: 'This series has been incredible.' },
];

let demoChatStore = cloneDemoChat();

export function getDemoChatStore(): WatchChatMessageRow[] {
  return demoChatStore;
}

export function resetDemoChatStore(): void {
  demoChatStore = cloneDemoChat();
}

export function hideDemoChatMessage(id: string): void {
  demoChatStore = demoChatStore.map(m =>
    m.id === id ? { ...m, is_hidden: true } : m,
  );
}

export function appendDemoChatMessage(msg: WatchChatMessageRow): void {
  demoChatStore = [...demoChatStore, msg];
}
