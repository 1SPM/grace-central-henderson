import { useCallback, useEffect, useState } from 'react';
import { fetchLeadershipActivity, type LeadershipActivityData } from '../lib/services/leadershipApi';

const REFRESH_MS = 60_000;

export function useLeadershipActivity() {
  const [data, setData] = useState<LeadershipActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchLeadershipActivity();
      if (next) {
        setData(next);
        setIsLive(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { data, loading, isLive, refresh };
}
