import { useState, useEffect, useCallback } from 'react';
import {
  fetchConnections,
  fetchConnectionRequests,
  acceptConnectionRequest,
  sendConnectionRequest,
} from '../lib/services/community';
import type { MemberConnection, MemberConnectionRequest, Person } from '../types';

function enrichRequests(
  requests: MemberConnectionRequest[],
  people: Person[],
): MemberConnectionRequest[] {
  const personMap = new Map(people.map(p => [p.id, p]));
  return requests.map(r => {
    const from = personMap.get(r.fromPersonId);
    return {
      ...r,
      fromName: r.fromName ?? (from ? `${from.firstName} ${from.lastName}` : 'Member'),
      fromPhoto: from?.photo,
    };
  });
}

export function useMemberConnections(
  churchId: string | undefined,
  people: Person[],
  currentPersonId?: string,
) {
  const [connections, setConnections] = useState<MemberConnection[]>([]);
  const [requests, setRequests] = useState<MemberConnectionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!churchId) {
      setConnections([]);
      setRequests([]);
      setIsLoading(false);
      return;
    }
    const [conns, reqs] = await Promise.all([
      fetchConnections(churchId),
      fetchConnectionRequests(churchId, currentPersonId),
    ]);
    setConnections(conns);
    setRequests(enrichRequests(reqs, people));
    setIsLoading(false);
  }, [churchId, currentPersonId, people]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const accept = useCallback(async (requestId: string) => {
    if (!churchId || !currentPersonId) return;
    await acceptConnectionRequest(churchId, requestId, currentPersonId);
    await reload();
  }, [churchId, currentPersonId, reload]);

  const connect = useCallback(async (toPersonId: string) => {
    if (!churchId || !currentPersonId) return;
    await sendConnectionRequest(churchId, currentPersonId, toPersonId);
    await reload();
  }, [churchId, currentPersonId, reload]);

  return { connections, requests, isLoading, reload, accept, connect, connectionCount: connections.length };
}
