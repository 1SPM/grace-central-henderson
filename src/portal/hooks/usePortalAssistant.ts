import { useCallback, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch, WorkOsApiError } from '../../lib/services/workos';

export interface AssistantChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface AssistantReplyMeta {
  toolCalls: { name: string; success: boolean }[];
  crisisDetected: boolean;
}

interface AssistantResponse {
  reply: string;
  tool_calls: { name: string; success: boolean }[];
  crisis_detected: boolean;
  disclosure: string;
}

export function usePortalAssistant() {
  const { getAuthToken } = usePortalAuth();
  const [turns, setTurns] = useState<AssistantChatTurn[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<AssistantReplyMeta | null>(null);

  const send = useCallback(async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setIsSending(true);
    setError(null);
    const history = turns.slice(-10);
    setTurns(prev => [...prev, { role: 'user', text: trimmed }]);

    try {
      const result = await workosFetch<AssistantResponse>('/api/portal/assistant', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({ message: trimmed, history }),
      });
      setTurns(prev => [...prev, { role: 'model', text: result.reply }]);
      setLastMeta({ toolCalls: result.tool_calls, crisisDetected: result.crisis_detected });
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 402) {
        setError("GRACE has reached its monthly usage limit — please try again next month, or contact the church directly.");
      } else if (err instanceof WorkOsApiError && err.status === 422) {
        setError("I can't help with that message. If you need to reach someone, please use the Care & Prayer or Contact options.");
      } else {
        setError(err instanceof Error ? err.message : 'GRACE is unavailable right now.');
      }
    } finally {
      setIsSending(false);
    }
  }, [getAuthToken, turns]);

  const reset = useCallback(() => {
    setTurns([]);
    setError(null);
    setLastMeta(null);
  }, []);

  return { turns, isSending, error, lastMeta, send, reset };
}
