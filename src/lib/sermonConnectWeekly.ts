import {
  illustrationTopics as fallbackIllustrations,
  scriptureRefs as fallbackScripture,
  sermonTopics as fallbackTopics,
  themeIllustrations,
  themeScripture,
} from '../config/sermonConnectSubjects';
import type { WatchSermon } from './services/liveService';

export interface LiveConnectSubjects {
  topics: string[];
  scripture: string[];
  illustrations: string[];
  weekKey: string;
  weekLabel: string;
  sourceCount: number;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function cleanSermonTitle(title: string): string {
  return title
    .replace(/^part\s+\d+\s*[—-]\s*/i, '')
    .replace(/\s*[—-]\s*speaking life$/i, '')
    .trim();
}

/** Week bucket starts on Sunday so Sunday Prep rotates with the service calendar. */
export function getSermonConnectWeekKey(date = new Date()): string {
  const d = new Date(date);
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  sunday.setHours(12, 0, 0, 0);
  return sunday.toISOString().slice(0, 10);
}

export function formatSermonConnectWeekLabel(weekKey: string): string {
  const start = new Date(`${weekKey}T12:00:00`);
  return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function weekOffset(weekKey: string, length: number): number {
  if (length <= 0) return 0;
  let hash = 0;
  for (const char of weekKey) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % length;
}

function pickRotated(items: string[], weekKey: string, count: number): string[] {
  const unique = [...new Set(items.map(item => item.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const offset = weekOffset(weekKey, unique.length);
  const limit = Math.min(count, unique.length);
  const picked: string[] = [];
  for (let i = 0; i < limit; i += 1) {
    picked.push(unique[(offset + i) % unique.length]);
  }
  return picked;
}

function matchThemeEntries(text: string, entries: Array<{ keywords: string[]; values: string[] }>): string[] {
  const haystack = text.toLowerCase();
  const matched: string[] = [];
  for (const entry of entries) {
    if (entry.keywords.some(keyword => haystack.includes(keyword))) {
      matched.push(...entry.values);
    }
  }
  return matched;
}

function topicsFromSermons(sermons: WatchSermon[]): string[] {
  const items: string[] = [];
  for (const sermon of sermons) {
    items.push(cleanSermonTitle(sermon.title));
    if (sermon.seriesTitle) items.push(titleCase(sermon.seriesTitle));
    if (sermon.partLabel) items.push(`${titleCase(sermon.seriesTitle ?? sermon.title)} ${sermon.partLabel}`);
  }
  return items;
}

function scriptureFromSermons(sermons: WatchSermon[]): string[] {
  const items: string[] = [];
  for (const sermon of sermons) {
    const text = `${sermon.title} ${sermon.seriesTitle ?? ''}`;
    items.push(...matchThemeEntries(text, themeScripture));
  }
  return items;
}

function illustrationsFromSermons(sermons: WatchSermon[]): string[] {
  const items: string[] = [];
  for (const sermon of sermons) {
    items.push(cleanSermonTitle(sermon.title));
    if (sermon.seriesTitle) items.push(titleCase(sermon.seriesTitle));
    const text = `${sermon.title} ${sermon.seriesTitle ?? ''}`;
    items.push(...matchThemeEntries(text, themeIllustrations));
  }
  return items;
}

export function buildLiveConnectSubjects(
  sermons: WatchSermon[],
  weekKey = getSermonConnectWeekKey(),
): LiveConnectSubjects {
  const sorted = [...sermons].sort((a, b) => {
    const aTime = a.preachedAt ? new Date(a.preachedAt).getTime() : 0;
    const bTime = b.preachedAt ? new Date(b.preachedAt).getTime() : 0;
    return bTime - aTime;
  });

  const topicPool = topicsFromSermons(sorted);
  const scripturePool = [...scriptureFromSermons(sorted), ...fallbackScripture];
  const illustrationPool = [...illustrationsFromSermons(sorted), ...fallbackIllustrations];

  return {
    topics: pickRotated(topicPool.length ? topicPool : [...fallbackTopics], weekKey, 12),
    scripture: pickRotated(scripturePool, weekKey, 12),
    illustrations: pickRotated(illustrationPool, weekKey, 12),
    weekKey,
    weekLabel: formatSermonConnectWeekLabel(weekKey),
    sourceCount: sorted.length,
  };
}
