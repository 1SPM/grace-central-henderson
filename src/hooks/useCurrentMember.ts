/**
 * useCurrentMember — resolves the signed-in user to their CRM people record.
 *
 * Resolution order:
 *   1. people.clerk_user_id === auth user's Clerk ID (set at invitation acceptance)
 *   2. Email match against portal-enabled people (covers operator-linked rows
 *      that predate the invitation flow)
 *   3. Demo mode: first person with status 'member' so the portal demos
 *      personalized flows end-to-end
 *
 * Also handles:
 *   - `?invite=<token>` redemption: posts the token to the API so the
 *     backend binds people.clerk_user_id, then reloads the page state
 *   - portal_last_seen_at heartbeat (best-effort, once per session)
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { logMemberActivity } from '../lib/services/memberActivity';
import { createLogger } from '../utils/logger';
import type { Person as DbPerson } from '../lib/database.types';

const log = createLogger('current-member');

export interface CurrentMemberState {
  member: DbPerson | null;
  /** True while an ?invite= token is being redeemed. */
  isRedeemingInvite: boolean;
  inviteError: string | null;
}

export function useCurrentMember(dbPeople: DbPerson[], isDemo: boolean): CurrentMemberState {
  const { user, isSignedIn } = useAuthContext();
  const [redeemedAt, setRedeemedAt] = useState<number | null>(null);
  const [isRedeemingInvite, setIsRedeemingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [linkedPerson, setLinkedPerson] = useState<DbPerson | null>(null);
  const heartbeatSent = useRef(false);

  // Redeem an invitation token if present in the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (!token || !isSignedIn || isDemo || redeemedAt) return;

    let cancelled = false;
    void (async () => {
      setIsRedeemingInvite(true);
      try {
        const res = await fetch('/api/members/accept-invitation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && body.person) {
          setLinkedPerson(body.person as DbPerson);
          // Strip the token from the URL so refreshes don't re-redeem.
          params.delete('invite');
          const qs = params.toString();
          window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
        } else {
          setInviteError(body.error || 'Invitation could not be accepted.');
        }
      } catch (err) {
        if (!cancelled) setInviteError('Invitation could not be accepted.');
        log.warn('Invite redemption failed', err);
      } finally {
        if (!cancelled) {
          setIsRedeemingInvite(false);
          setRedeemedAt(Date.now());
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isSignedIn, isDemo, redeemedAt]);

  const member = useMemo<DbPerson | null>(() => {
    if (linkedPerson) return linkedPerson;
    if (!isSignedIn || !user) return null;

    // 1. Clerk linkage
    const byClerk = dbPeople.find(p => p.clerk_user_id && p.clerk_user_id === user.clerkId);
    if (byClerk) return byClerk;

    // 2. Email fallback (portal-enabled rows only — prevents a staff login
    //    from silently impersonating an arbitrary person record)
    if (user.email) {
      const emailLower = user.email.toLowerCase();
      const byEmail = dbPeople.find(
        p => p.portal_enabled && p.email && p.email.toLowerCase() === emailLower
      );
      if (byEmail) return byEmail;
    }

    // 3. Demo mode: prefer Maya Thompson as the showcase portal member,
    //    fall back to any other member so personalized flows always work
    if (isDemo) {
      return (
        dbPeople.find(p => p.id === 'maya-001') ??
        dbPeople.find(p => p.status === 'member') ??
        null
      );
    }

    return null;
  }, [linkedPerson, isSignedIn, user, dbPeople, isDemo]);

  // Heartbeat: record the portal visit on the person row + activity feed
  // (best-effort, once per session).
  useEffect(() => {
    if (!member || isDemo || heartbeatSent.current || !supabase) return;
    heartbeatSent.current = true;
    void supabase
      .from('people')
      .update({ portal_last_seen_at: new Date().toISOString() })
      .eq('id', member.id)
      .then(({ error }) => {
        if (error) log.warn('portal_last_seen_at update failed', error.message);
      });
    logMemberActivity({
      churchId: member.church_id,
      personId: member.id,
      eventType: 'login',
    });
  }, [member, isDemo]);

  return { member, isRedeemingInvite, inviteError };
}
