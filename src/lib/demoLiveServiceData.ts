/**
 * Demo data for Live Service dashboard — mirrors Central Henderson Watch page.
 */

import type { WatchChatMessageRow, WatchSermonRow } from './database.types';
import { cloneCatalogDemoSermons } from './watchCatalog';

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
      person_id: '11',
      author_name: 'Rachel G.',
      body: 'This message is for me today.',
      is_hidden: false,
      created_at: new Date(now - 120_000).toISOString(),
    },
    {
      id: 'demo-chat-2',
      church_id: DEMO_CHURCH_ID,
      person_id: '10',
      author_name: 'Kevin H.',
      body: 'Watching with the whole family.',
      is_hidden: false,
      created_at: new Date(now - 90_000).toISOString(),
    },
    {
      id: 'demo-chat-3',
      church_id: DEMO_CHURCH_ID,
      person_id: '3',
      author_name: 'Maria S.',
      body: 'Amen! Powerful word.',
      is_hidden: false,
      created_at: new Date(now - 60_000).toISOString(),
    },
    {
      id: 'demo-chat-4',
      church_id: DEMO_CHURCH_ID,
      person_id: '00000000-0000-0000-0000-000000000106',
      author_name: 'David T.',
      body: 'Praying for everyone tuning in.',
      is_hidden: false,
      created_at: new Date(now - 45_000).toISOString(),
    },
    {
      id: 'demo-chat-5',
      church_id: DEMO_CHURCH_ID,
      person_id: '1',
      author_name: 'Sarah J.',
      body: 'So grateful for online church.',
      is_hidden: false,
      created_at: new Date(now - 30_000).toISOString(),
    },
  ];
}

export function cloneDemoSermons(): WatchSermonRow[] {
  return cloneCatalogDemoSermons(DEMO_CHURCH_ID);
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
