import { useEffect, useState } from 'react';
import {
  buildLiveConnectSubjects,
  getSermonConnectWeekKey,
  type LiveConnectSubjects,
} from '../lib/sermonConnectWeekly';
import { fetchWatchSermons } from '../lib/services/liveService';

const CACHE_PREFIX = 'grace-sermon-connect';

interface CachedPayload extends LiveConnectSubjects {
  cachedAt: string;
}

function readCache(churchId: string, weekKey: string): LiveConnectSubjects | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}:${churchId}:${weekKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (parsed.weekKey !== weekKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(churchId: string, payload: LiveConnectSubjects): void {
  try {
    const cached: CachedPayload = { ...payload, cachedAt: new Date().toISOString() };
    localStorage.setItem(`${CACHE_PREFIX}:${churchId}:${payload.weekKey}`, JSON.stringify(cached));
  } catch {
    // Ignore quota or private-mode failures.
  }
}

export function useSermonConnectSubjects(churchId: string) {
  const weekKey = getSermonConnectWeekKey();
  const [subjects, setSubjects] = useState<LiveConnectSubjects>(() =>
    readCache(churchId, weekKey) ?? buildLiveConnectSubjects([], weekKey),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache(churchId, weekKey);
    if (cached) {
      setSubjects(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchWatchSermons(churchId)
      .then(sermons => {
        if (cancelled) return;
        const next = buildLiveConnectSubjects(sermons, weekKey);
        writeCache(churchId, next);
        setSubjects(next);
        setError(null);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to refresh sermon subjects.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [churchId, weekKey]);

  return { subjects, loading, error, weekKey };
}
