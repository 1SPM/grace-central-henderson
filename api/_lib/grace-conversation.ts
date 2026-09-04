/**
 * Shared conversation + message persistence for the Ask GRACE surfaces.
 *
 * Extracted from api/grace/_chat.ts when a second surface
 * (api/grace/_entity-memory.ts) began answering staff questions. A
 * deterministic answer is still a turn: if it is not written to
 * grace_messages it vanishes from history, and the NEXT turn's prompt has no
 * referent for "what about her?" — quietly breaking the cross-session
 * continuity ADR-014 exists to provide.
 *
 * One implementation, not two: the ownership check (church_id AND user_id)
 * is the thing that must never drift between callers.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolves the caller's conversation, creating one when needed.
 *
 * A supplied `conversationId` is honoured only if it belongs to THIS church
 * and THIS user; anything else silently starts a new conversation rather than
 * appending to someone else's thread.
 */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  churchId: string,
  userId: string,
  conversationId: string | undefined,
  firstMessage: string,
): Promise<{ id: string } | null> {
  if (conversationId) {
    const { data } = await supabase
      .from('grace_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('church_id', churchId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data) return data as { id: string };
  }

  const { data, error } = await supabase
    .from('grace_conversations')
    .insert({ church_id: churchId, user_id: userId, title: firstMessage.slice(0, 80) })
    .select('id')
    .single();
  if (error || !data) return null;
  return data as { id: string };
}

/**
 * Writes a completed question/answer pair and bumps the conversation.
 *
 * Never throws: a persistence failure must not fail a turn the user has
 * already been shown. Returns false so the caller can decide whether to
 * surface it (see _chat.ts's TD-065 handling for the loud-but-not-fatal
 * precedent).
 */
export async function persistTurn(
  supabase: SupabaseClient,
  args: { churchId: string; userId: string; conversationId: string; question: string; reply: string },
): Promise<boolean> {
  const { error } = await supabase.from('grace_messages').insert([
    { conversation_id: args.conversationId, church_id: args.churchId, user_id: args.userId, role: 'user', content: args.question },
    { conversation_id: args.conversationId, church_id: args.churchId, user_id: args.userId, role: 'assistant', content: args.reply },
  ]);
  await supabase.from('grace_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', args.conversationId);
  return !error;
}
