import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  WATCH_CATALOG,
  watchThumbnailUrl,
  isDirectVideoStreamUrl,
  WATCH_LIVE_VIDEO_URL,
} from './watchCatalog';

describe('watchCatalog', () => {
  it('every sermon has a non-empty thumbnail path', () => {
    for (const entry of WATCH_CATALOG) {
      expect(entry.thumbnailFile).toBeTruthy();
      const url = watchThumbnailUrl(entry.thumbnailFile);
      expect(url).toMatch(/^\/previews\/assets\/watch\/.+\.jpg$/);
    }
  });

  it('known titles map to existing files under previews/assets/watch/', () => {
    const repoRoot = join(import.meta.dirname, '../..');
    for (const entry of WATCH_CATALOG) {
      const filePath = join(repoRoot, 'previews/assets/watch', entry.thumbnailFile);
      expect(existsSync(filePath), `${entry.title} → ${entry.thumbnailFile}`).toBe(true);
    }
  });

  it('detects direct video stream URLs', () => {
    expect(isDirectVideoStreamUrl(WATCH_LIVE_VIDEO_URL)).toBe(true);
    expect(isDirectVideoStreamUrl('https://www.youtube.com/embed/live_stream?channel=UCentralHenderson')).toBe(false);
  });
});
