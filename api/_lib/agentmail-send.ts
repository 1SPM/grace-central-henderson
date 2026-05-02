const AGENTMAIL_BASE = 'https://api.agentmail.to/v0';

export interface AgentMailSendResult {
  ok: boolean;
  status: number;
  message_id?: string;
  thread_id?: string;
  error?: string;
}

interface ResponseShape {
  message_id?: string;
  thread_id?: string;
  message?: string;
}

/**
 * POST /v0/inboxes/{inbox_id}/messages/{message_id}/reply — threads the reply
 * back into the existing AgentMail conversation. Used by the Mail-tab inline
 * reply, the inbound webhook's auto-reply path, and the chat-driven reply via
 * the send_email action when there's an active replyContext.
 */
export async function replyToThread(args: {
  apiKey: string;
  inboxId: string;
  messageId: string;
  text: string;
}): Promise<AgentMailSendResult> {
  try {
    const r = await fetch(
      `${AGENTMAIL_BASE}/inboxes/${encodeURIComponent(args.inboxId)}/messages/${encodeURIComponent(args.messageId)}/reply`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${args.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: args.text }),
      },
    );
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return { ok: false, status: r.status, error: detail.slice(0, 200) };
    }
    const data = (await r.json().catch(() => ({}))) as ResponseShape;
    return { ok: true, status: r.status, message_id: data.message_id, thread_id: data.thread_id };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : 'fetch failed' };
  }
}

/**
 * POST /v0/inboxes/{inbox_id}/messages/send — fresh outbound that starts a new
 * thread. Used when the chat asks Grace to email someone who hasn't reached
 * out first (e.g. "send Sarah a check-in note").
 */
export async function sendFresh(args: {
  apiKey: string;
  inboxId: string;
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<AgentMailSendResult> {
  try {
    const r = await fetch(
      `${AGENTMAIL_BASE}/inboxes/${encodeURIComponent(args.inboxId)}/messages/send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${args.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: args.to,
          subject: args.subject,
          text: args.text,
          html: args.html,
        }),
      },
    );
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return { ok: false, status: r.status, error: detail.slice(0, 200) };
    }
    const data = (await r.json().catch(() => ({}))) as ResponseShape;
    return { ok: true, status: r.status, message_id: data.message_id, thread_id: data.thread_id };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : 'fetch failed' };
  }
}
