/**
 * Live Service data layer — sermons, chat, service window helpers.
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import { createLogger } from '../../utils/logger';
import type { ServiceTime } from '../../hooks/useChurchSettings';
import type { ZonedTimeParts } from '../../hooks/useChurchClock';
import type { MemberActivityEvent, WatchChatMessageRow, WatchSermonRow } from '../database.types';
import {
  cloneDemoSermons,
  getDemoChatStore,
  hideDemoChatMessage,
  DEMO_CHURCH_ID,
} from '../demoLiveServiceData';

const log = createLogger('live-service');

export interface ActiveServiceSlot {
  day: string;
  time: string;
  name: string;
  label: string;
  windowStart: Date;
  windowEnd: Date;
}

export interface WatchSermon {
  id: string;
  title: string;
  seriesTitle?: string;
  partLabel?: string;
  speaker?: string;
  preachedAt?: string;
  durationSeconds?: number;
  viewCount: number;
  thumbnailUrl?: string;
  videoUrl?: string;
}

export interface WatchChatMessage {
  id: string;
  personId?: string;
  authorName: string;
  body: string;
  isHidden: boolean;
  createdAt: string;
}

export interface GiftTickerItem {
  id: string;
  personId?: string;
  personName: string;
  amount: number;
  fund: string;
  createdAt: string;
}

export interface LiveServiceCtaCounts {
  followJesus: number;
  getConnected: number;
  giveOnline: number;
}

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function parseTime12h(time: string): { hour: number; minute: number } {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hour: 10, minute: 0 };
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return { hour, minute };
}

function sermonFromRow(row: WatchSermonRow): WatchSermon {
  return {
    id: row.id,
    title: row.title,
    seriesTitle: row.series_title ?? undefined,
    partLabel: row.part_label ?? undefined,
    speaker: row.speaker ?? undefined,
    preachedAt: row.preached_at ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    viewCount: row.view_count,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    videoUrl: row.video_url ?? undefined,
  };
}

function chatFromRow(row: WatchChatMessageRow): WatchChatMessage {
  return {
    id: row.id,
    personId: row.person_id ?? undefined,
    authorName: row.author_name,
    body: row.body,
    isHidden: row.is_hidden,
    createdAt: row.created_at,
  };
}

/** Returns the service slot whose ±90 min window contains now, if any. */
export function getActiveServiceSlot(
  serviceTimes: ServiceTime[],
  zoned: ZonedTimeParts,
  now: Date = new Date(),
): ActiveServiceSlot | null {
  const currentDow = new Date(zoned.year, zoned.month, zoned.day).getDay();
  const nowMinutes = zoned.hour24 * 60 + zoned.minute;

  let best: ActiveServiceSlot | null = null;
  let bestDist = Infinity;

  for (const st of serviceTimes) {
    const dow = DAY_MAP[st.day.toLowerCase()];
    if (dow === undefined) continue;

    const { hour, minute } = parseTime12h(st.time);
    const serviceMinutes = hour * 60 + minute;

    // Same day check
    const dayDiff = Math.abs(dow - currentDow);
    if (dayDiff > 0 && dayDiff !== 6) continue; // only today or adjacent for Sat/Sun edge

    const dist = Math.abs(nowMinutes - serviceMinutes);
    if (dist <= 90 && dist < bestDist) {
      const windowStart = new Date(now);
      windowStart.setHours(hour, minute - 90, 0, 0);
      const windowEnd = new Date(now);
      windowEnd.setHours(hour, minute + 90, 0, 0);

      bestDist = dist;
      best = {
        day: st.day,
        time: st.time,
        name: st.name,
        label: `${st.time} ${st.day} — ${st.name}`,
        windowStart,
        windowEnd,
      };
    }
  }

  return best;
}

export function countGiftsForService(
  events: MemberActivityEvent[],
  windowStart: Date,
  windowEnd: Date,
): number {
  return events.filter(e => {
    if (e.event_type !== 'gift') return false;
    const t = new Date(e.created_at).getTime();
    return t >= windowStart.getTime() && t <= windowEnd.getTime();
  }).length;
}

export function extractGiftTicker(
  events: MemberActivityEvent[],
  personNames: Map<string, string>,
  windowStart: Date,
  windowEnd: Date,
): GiftTickerItem[] {
  return events
    .filter(e => e.event_type === 'gift')
    .filter(e => {
      const t = new Date(e.created_at).getTime();
      return t >= windowStart.getTime() && t <= windowEnd.getTime();
    })
    .map(e => {
      const meta = e.metadata ?? {};
      const personId = e.person_id ?? undefined;
      const personName = personId
        ? (personNames.get(personId) ?? 'A member')
        : 'A member';
      return {
        id: e.id,
        personId,
        personName,
        amount: Number(meta.amount ?? 0),
        fund: String(meta.fund ?? 'Offering'),
        createdAt: e.created_at,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function countCtaEvents(
  events: MemberActivityEvent[],
  windowStart: Date,
  windowEnd: Date,
): LiveServiceCtaCounts {
  const inWindow = (e: MemberActivityEvent) => {
    const t = new Date(e.created_at).getTime();
    return t >= windowStart.getTime() && t <= windowEnd.getTime();
  };

  return {
    followJesus: events.filter(e => inWindow(e) && e.event_type === 'help_request').length,
    getConnected: events.filter(e => inWindow(e) && (e.event_type === 'connection_request' || e.event_type === 'connection_accept')).length,
    giveOnline: events.filter(e => inWindow(e) && e.event_type === 'gift').length,
  };
}

export async function fetchWatchSermons(churchId: string): Promise<WatchSermon[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return cloneDemoSermons()
      .filter(s => s.church_id === churchId || churchId === DEMO_CHURCH_ID)
      .map(sermonFromRow);
  }

  const { data, error } = await supabase
    .from('watch_sermons')
    .select('*')
    .eq('church_id', churchId)
    .order('preached_at', { ascending: false })
    .limit(12);

  if (error) {
    log.warn('fetchWatchSermons failed', error);
    return cloneDemoSermons().map(sermonFromRow);
  }

  if (!data?.length) {
    return cloneDemoSermons().map(sermonFromRow);
  }

  return (data as WatchSermonRow[]).map(sermonFromRow);
}

export async function fetchWatchChat(churchId: string, limit = 100): Promise<WatchChatMessage[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return getDemoChatStore()
      .filter(m => m.church_id === churchId || churchId === DEMO_CHURCH_ID)
      .map(chatFromRow);
  }

  const { data, error } = await supabase
    .from('watch_chat_messages')
    .select('*')
    .eq('church_id', churchId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    log.warn('fetchWatchChat failed', error);
    return getDemoChatStore().map(chatFromRow);
  }

  if (!data?.length) {
    return getDemoChatStore().map(chatFromRow);
  }

  return (data as WatchChatMessageRow[]).map(chatFromRow);
}

export async function hideChatMessage(messageId: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    hideDemoChatMessage(messageId);
    return;
  }

  const { error } = await supabase
    .from('watch_chat_messages')
    .update({ is_hidden: true })
    .eq('id', messageId);

  if (error) {
    log.warn('hideChatMessage failed', error);
    hideDemoChatMessage(messageId);
  }
}

export async function fetchServiceActivity(
  churchId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<MemberActivityEvent[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from('member_activity_events')
    .select('*')
    .eq('church_id', churchId)
    .gte('created_at', windowStart.toISOString())
    .lte('created_at', windowEnd.toISOString())
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    log.warn('fetchServiceActivity failed', error);
    return [];
  }

  return (data ?? []) as MemberActivityEvent[];
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatViewCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k views`;
  return `${count} views`;
}
