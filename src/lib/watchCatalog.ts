/**
 * Shared sermon catalog for admin Live Service UI and member Watch portal alignment.
 * Thumbnails live under previews/assets/watch/ (same art as grace_member_portal_central.html).
 */

import type { WatchSermonRow } from './database.types';

export const WATCH_LIVE_VIDEO_URL = '/previews/assets/watch/video/Church-Stage-video.mp4';

export const WATCH_THUMBNAIL_BASE = '/previews/assets/watch';

export const MEMBER_WATCH_PREVIEW_PATH = '/previews/grace_member_portal_central.html#watch';

export interface WatchCatalogEntry {
  catalogId: string;
  title: string;
  seriesTitle: string;
  partLabel?: string | null;
  speaker: string;
  preachedAt: string;
  durationSeconds: number;
  viewCount: number;
  /** Filename under previews/assets/watch/ or absolute path */
  thumbnailFile: string;
  videoUrl?: string | null;
  /** Index in member portal WATCH_STATE.sermons when aligned */
  memberPortalIndex?: number;
}

/** Resolve a catalog thumbnail to a public URL served by Vite. */
export function watchThumbnailUrl(thumbnailFile: string): string {
  if (thumbnailFile.startsWith('/') || thumbnailFile.startsWith('http')) {
    return thumbnailFile;
  }
  return `${WATCH_THUMBNAIL_BASE}/${thumbnailFile}`;
}

export const WATCH_CATALOG: WatchCatalogEntry[] = [
  {
    catalogId: 'honor-part-3',
    title: 'Part 3 — The Power of Forgiveness',
    seriesTitle: 'HONOR EACH OTHER',
    partLabel: 'Part 3',
    speaker: 'Pastor James Wilson',
    preachedAt: '2025-05-18',
    durationSeconds: 3134,
    viewCount: 1200,
    thumbnailFile: 'ondemand-forgiveness.jpg',
    videoUrl: WATCH_LIVE_VIDEO_URL,
    memberPortalIndex: 0,
  },
  {
    catalogId: 'honor-part-2',
    title: 'Part 2 — Speaking Life',
    seriesTitle: 'HONOR EACH OTHER',
    partLabel: 'Part 2',
    speaker: 'Pastor James Wilson',
    preachedAt: '2025-05-11',
    durationSeconds: 2980,
    viewCount: 980,
    thumbnailFile: 'ondemand-serving.jpg',
    videoUrl: WATCH_LIVE_VIDEO_URL,
    memberPortalIndex: 1,
  },
  {
    catalogId: 'honor-part-1',
    title: 'Part 1 — The Foundation',
    seriesTitle: 'HONOR EACH OTHER',
    partLabel: 'Part 1',
    speaker: 'Pastor James Wilson',
    preachedAt: '2025-05-04',
    durationSeconds: 3050,
    viewCount: 1100,
    thumbnailFile: 'ondemand-gift.jpg',
    videoUrl: WATCH_LIVE_VIDEO_URL,
  },
  {
    catalogId: 'rooted-grace',
    title: 'Rooted in Grace',
    seriesTitle: 'ROOTS',
    partLabel: null,
    speaker: 'Pastor James Wilson',
    preachedAt: '2025-04-27',
    durationSeconds: 2890,
    viewCount: 870,
    thumbnailFile: 'ondemand-rooted.jpg',
    videoUrl: WATCH_LIVE_VIDEO_URL,
    memberPortalIndex: 2,
  },
  {
    catalogId: 'compassion-broken',
    title: 'Help The Broken',
    seriesTitle: 'COMPASSION',
    partLabel: 'Week 2',
    speaker: 'Deacon Marcus Collins',
    preachedAt: '2025-04-20',
    durationSeconds: 2760,
    viewCount: 740,
    thumbnailFile: 'ondemand-serving.jpg',
    videoUrl: WATCH_LIVE_VIDEO_URL,
  },
  {
    catalogId: 'compassion-blessings',
    title: 'Speaking Blessings',
    seriesTitle: 'COMPASSION',
    partLabel: 'Week 1',
    speaker: 'Pastor James Wilson',
    preachedAt: '2025-04-13',
    durationSeconds: 2820,
    viewCount: 810,
    thumbnailFile: 'ondemand-gift.jpg',
    videoUrl: WATCH_LIVE_VIDEO_URL,
  },
  {
    catalogId: 'living-faith-fruit',
    title: 'Fruit Of The Spirit',
    seriesTitle: 'LIVING FAITH',
    partLabel: null,
    speaker: 'Pastor Sarah Chen',
    preachedAt: '2025-04-06',
    durationSeconds: 2950,
    viewCount: 920,
    thumbnailFile: 'ondemand-rooted.jpg',
    videoUrl: WATCH_LIVE_VIDEO_URL,
  },
  {
    catalogId: 'living-faith-truth',
    title: 'Unchanging Truth',
    seriesTitle: 'LIVING FAITH',
    partLabel: null,
    speaker: 'Pastor James Wilson',
    preachedAt: '2025-03-30',
    durationSeconds: 3010,
    viewCount: 880,
    thumbnailFile: 'ondemand-forgiveness.jpg',
    videoUrl: WATCH_LIVE_VIDEO_URL,
  },
  {
    catalogId: 'story-plot',
    title: 'Plot Of The Bible',
    seriesTitle: 'STORY OF GOD',
    partLabel: 'Part 1',
    speaker: 'Pastor Michael Hayes',
    preachedAt: '2025-03-23',
    durationSeconds: 2880,
    viewCount: 760,
    thumbnailFile: 'ondemand-rooted.jpg',
    videoUrl: WATCH_LIVE_VIDEO_URL,
  },
  {
    catalogId: 'family-fathers-day',
    title: 'Fathers Day — Speaking Life',
    seriesTitle: 'FAMILY',
    partLabel: null,
    speaker: 'Pastor James Wilson',
    preachedAt: '2025-03-16',
    durationSeconds: 2700,
    viewCount: 690,
    thumbnailFile: 'ondemand-serving.jpg',
    videoUrl: WATCH_LIVE_VIDEO_URL,
  },
];

export function catalogEntryToDemoSermon(
  entry: WatchCatalogEntry,
  churchId: string,
  index: number,
): WatchSermonRow {
  const preached = entry.preachedAt;
  return {
    id: `demo-sermon-${index + 1}`,
    church_id: churchId,
    title: entry.title,
    series_title: entry.seriesTitle,
    part_label: entry.partLabel ?? null,
    speaker: entry.speaker,
    preached_at: preached,
    duration_seconds: entry.durationSeconds,
    view_count: entry.viewCount,
    thumbnail_url: watchThumbnailUrl(entry.thumbnailFile),
    video_url: entry.videoUrl ?? null,
    created_at: `${preached}T12:00:00Z`,
    updated_at: `${preached}T12:00:00Z`,
  };
}

export function cloneCatalogDemoSermons(churchId: string): WatchSermonRow[] {
  return WATCH_CATALOG.map((entry, index) => catalogEntryToDemoSermon(entry, churchId, index));
}

/** True when the URL should render in a <video> tag instead of an iframe. */
export function isDirectVideoStreamUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return /\.(mp4|webm|ogg)(\?|$)/i.test(lower) || lower.includes('/mp4');
}
