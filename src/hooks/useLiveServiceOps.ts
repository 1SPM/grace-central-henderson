/**
 * useLiveServiceOps — real-time admin monitoring for Live Service dashboard.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createLogger } from '../utils/logger';
import { useChurchClock } from './useChurchClock';
import type { ChurchProfile } from './useChurchSettings';
import type { Person } from '../types';
import type { MemberActivityEvent, WatchChatMessageRow } from '../lib/database.types';
import {
  fetchWatchSermons,
  fetchWatchChat,
  hideChatMessage,
  fetchServiceActivity,
  getActiveServiceSlot,
  countGiftsForService,
  extractGiftTicker,
  countCtaEvents,
  type WatchSermon,
  type WatchChatMessage,
  type GiftTickerItem,
  type LiveServiceCtaCounts,
  type ActiveServiceSlot,
} from '../lib/services/liveService';
import {
  DEMO_VIEWER_COUNT,
  DEMO_GIFTS_THIS_SERVICE,
  DEMO_GIFT_NOTIFICATIONS,
  DEMO_CHAT_SNIPPETS,
  appendDemoChatMessage,
  getDemoChatStore,
} from '../lib/demoLiveServiceData';
import { CENTRAL_HENDERSON_TIMEZONE } from '../config/centralHenderson';

const log = createLogger('live-service-ops');

export interface LiveServiceStats {
  watchingNow: number;
  currentSeries: string;
  giftsThisService: number;
}

interface UseLiveServiceOpsOptions {
  churchId: string;
  churchProfile?: ChurchProfile;
  timezone?: string;
  people?: Person[];
}

interface UseLiveServiceOpsResult {
  stats: LiveServiceStats;
  chat: WatchChatMessage[];
  sermons: WatchSermon[];
  giftTicker: GiftTickerItem[];
  ctaCounts: LiveServiceCtaCounts;
  activeSlot: ActiveServiceSlot | null;
  isLive: boolean;
  isConnected: boolean;
  isDemo: boolean;
  isLoading: boolean;
  hideMessage: (id: string) => Promise<void>;
  reload: () => void;
}

function defaultWindow(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(start.getHours() - 2);
  const end = new Date();
  end.setHours(end.getHours() + 2);
  return { start, end };
}

export function useLiveServiceOps({
  churchId,
  churchProfile,
  timezone = CENTRAL_HENDERSON_TIMEZONE,
  people = [],
}: UseLiveServiceOpsOptions): UseLiveServiceOpsResult {
  const { zoned } = useChurchClock(timezone);
  const isDemo = !isSupabaseConfigured();

  const [sermons, setSermons] = useState<WatchSermon[]>([]);
  const [chat, setChat] = useState<WatchChatMessage[]>([]);
  const [activityEvents, setActivityEvents] = useState<MemberActivityEvent[]>([]);
  const [watchingNow, setWatchingNow] = useState(DEMO_VIEWER_COUNT);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadCounter, setReloadCounter] = useState(0);

  const personMap = useMemo(
    () => new Map(people.map(p => [p.id, `${p.firstName} ${p.lastName}`])),
    [people],
  );

  const activeSlot = useMemo(
    () => getActiveServiceSlot(churchProfile?.serviceTimes ?? [], zoned),
    [churchProfile?.serviceTimes, zoned],
  );

  const serviceWindow = useMemo(() => {
    if (activeSlot) {
      return { start: activeSlot.windowStart, end: activeSlot.windowEnd };
    }
    return defaultWindow();
  }, [activeSlot]);

  const currentSeries = useMemo(() => {
    const cs = churchProfile?.currentSeries;
    if (cs?.title) {
      return cs.part ? `${cs.title} — ${cs.part}` : cs.title;
    }
    return 'Current Series';
  }, [churchProfile?.currentSeries]);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);

  const hideMessage = useCallback(async (id: string) => {
    await hideChatMessage(id);
    setChat(prev => prev.map(m => (m.id === id ? { ...m, isHidden: true } : m)));
  }, []);

  // Initial data load
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      const [sermonData, chatData, activityData] = await Promise.all([
        fetchWatchSermons(churchId),
        fetchWatchChat(churchId),
        fetchServiceActivity(churchId, serviceWindow.start, serviceWindow.end),
      ]);

      if (cancelled) return;

      setSermons(sermonData);
      setChat(chatData);
      setActivityEvents(activityData);
      setIsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [churchId, reloadCounter, serviceWindow.start.getTime(), serviceWindow.end.getTime()]);

  // Supabase Realtime subscriptions
  useEffect(() => {
    if (!churchId || !isSupabaseConfigured() || !supabase) return;
    const sb = supabase;

    const channel = sb
      .channel(`live-service-${churchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'watch_chat_messages', filter: `church_id=eq.${churchId}` },
        (payload) => {
          const row = payload.new as WatchChatMessageRow;
          setChat(prev => {
            if (prev.some(m => m.id === row.id)) return prev;
            return [...prev, {
              id: row.id,
              personId: row.person_id ?? undefined,
              authorName: row.author_name,
              body: row.body,
              isHidden: row.is_hidden,
              createdAt: row.created_at,
            }];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'watch_chat_messages', filter: `church_id=eq.${churchId}` },
        (payload) => {
          const row = payload.new as WatchChatMessageRow;
          setChat(prev => prev.map(m =>
            m.id === row.id
              ? { ...m, isHidden: row.is_hidden, body: row.body }
              : m,
          ));
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'member_activity_events', filter: `church_id=eq.${churchId}` },
        (payload) => {
          const row = payload.new as MemberActivityEvent;
          const relevant = ['gift', 'checkin', 'help_request', 'connection_request', 'connection_accept', 'watch_join'];
          if (!relevant.includes(row.event_type)) return;
          setActivityEvents(prev => {
            if (prev.some(e => e.id === row.id)) return prev;
            return [row, ...prev];
          });
        },
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') log.warn('Live service realtime channel error');
      });

    return () => { void sb.removeChannel(channel); };
  }, [churchId]);

  // Demo mode: simulate viewer jitter + occasional chat/gifts
  useEffect(() => {
    if (!isDemo) return;

    const viewerInterval = setInterval(() => {
      setWatchingNow(prev => {
        const delta = Math.floor(Math.random() * 7) - 3;
        return Math.max(280, Math.min(420, prev + delta));
      });
    }, 8000);

    const chatInterval = setInterval(() => {
      const snippet = DEMO_CHAT_SNIPPETS[Math.floor(Math.random() * DEMO_CHAT_SNIPPETS.length)];
      const msg: WatchChatMessageRow = {
        id: `demo-chat-live-${Date.now()}`,
        church_id: churchId,
        person_id: null,
        author_name: snippet.author,
        body: snippet.body,
        is_hidden: false,
        created_at: new Date().toISOString(),
      };
      appendDemoChatMessage(msg);
      setChat(getDemoChatStore().map(m => ({
        id: m.id,
        personId: m.person_id ?? undefined,
        authorName: m.author_name,
        body: m.body,
        isHidden: m.is_hidden,
        createdAt: m.created_at,
      })));
    }, 15000);

    return () => {
      clearInterval(viewerInterval);
      clearInterval(chatInterval);
    };
  }, [isDemo, churchId]);

  const giftTicker = useMemo(() => {
    const real = extractGiftTicker(activityEvents, personMap, serviceWindow.start, serviceWindow.end);
    if (real.length > 0) return real;
    if (isDemo) {
      return DEMO_GIFT_NOTIFICATIONS.map(g => ({
        id: g.id,
        personName: g.personName,
        amount: g.amount,
        fund: g.fund,
        createdAt: g.createdAt,
      }));
    }
    return [];
  }, [activityEvents, personMap, serviceWindow, isDemo]);

  const giftsThisService = useMemo(() => {
    const real = countGiftsForService(activityEvents, serviceWindow.start, serviceWindow.end);
    if (real > 0) return real;
    if (isDemo) return DEMO_GIFTS_THIS_SERVICE;
    return 0;
  }, [activityEvents, serviceWindow, isDemo]);

  const ctaCounts = useMemo(() => {
    const real = countCtaEvents(activityEvents, serviceWindow.start, serviceWindow.end);
    if (!isDemo && (real.followJesus > 0 || real.getConnected > 0 || real.giveOnline > 0)) {
      return real;
    }
    if (isDemo) {
      return { followJesus: 12, getConnected: 28, giveOnline: giftsThisService };
    }
    return real;
  }, [activityEvents, serviceWindow, isDemo, giftsThisService]);

  const stats: LiveServiceStats = {
    watchingNow,
    currentSeries,
    giftsThisService,
  };

  return {
    stats,
    chat,
    sermons,
    giftTicker,
    ctaCounts,
    activeSlot,
    isLive: !!activeSlot,
    isConnected: isDemo ? false : isConnected,
    isDemo,
    isLoading,
    hideMessage,
    reload,
  };
}
