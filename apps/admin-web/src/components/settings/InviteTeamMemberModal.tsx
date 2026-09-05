/**
 * Invite Team Member modal — Settings → Team Members.
 *
 * Collects name, email, and CRM role, then calls POST /api/team/invite.
 * The invitee sets their own password through Clerk's hosted sign-up
 * form after clicking the emailed invite link — this app (and this
 * modal) never sees or transmits a password for them.
 */

import { useState } from 'react';
import { X, UserPlus, Loader2, Check } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';

const TEAM_ROLES = [
  { value: 'admin', label: 'Admin', hint: 'Full access, including billing and team invites' },
  { value: 'pastor', label: 'Pastor', hint: 'Full ministry access, no billing' },
  { value: 'staff', label: 'Staff', hint: 'Day-to-day operations' },
  { value: 'volunteer', label: 'Volunteer', hint: 'Limited, task-scoped access' },
] as const;

type TeamRole = typeof TEAM_ROLES[number]['value'];

interface InviteTeamMemberModalProps {
  onClose: () => void;
}

export function InviteTeamMemberModal({ onClose }: InviteTeamMemberModalProps) {
  const { getAuthToken } = useAuthContext();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('staff');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValid) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          full_name: fullName.trim() || undefined,
          role,
        }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.status === 503) {
        setError('Clerk authentication isn’t configured on this deployment yet, so invitations can’t be sent. Set VITE_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY, then try again.');
        return;
      }
      if (!res.ok) {
        setError(body.error || `Could not send the invitation (HTTP ${res.status}).`);
        return;
      }
      if (body.status === 'skipped' && body.reason === 'already_team_member') {
        setError(`${email.trim()} is already on the team at this church.`);
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="invite-team-title">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-700">
          <h2 id="invite-team-title" className="font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-2">
            <UserPlus size={18} className="text-indigo-600 dark:text-indigo-400" />
            Invite team member
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-200">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="px-5 py-8 text-center">
            <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Check size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm text-gray-700 dark:text-dark-200">
              Invitation sent to <strong>{email.trim()}</strong>. They'll set their own password when they accept it — nothing was shared here.
            </p>
            <button
              onClick={onClose}
              className="mt-5 px-4 py-2 rounded-lg bg-gray-900 dark:bg-dark-700 text-white text-sm font-medium"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="px-5 py-5 space-y-4">
            <div>
              <label htmlFor="invite-name" className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Full name</label>
              <input
                id="invite-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Richard Kern"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-600 bg-gray-50 dark:bg-dark-850 text-gray-900 dark:text-dark-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">Email</label>
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-600 bg-gray-50 dark:bg-dark-850 text-gray-900 dark:text-dark-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">Role</span>
              <div className="grid grid-cols-2 gap-2">
                {TEAM_ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={[
                      'text-left rounded-lg border px-3 py-2 text-sm transition-colors',
                      role === r.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-200'
                        : 'border-gray-200 dark:border-dark-700 text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-750',
                    ].join(' ')}
                  >
                    <div className="font-medium">{r.label}</div>
                    <div className="text-[11px] opacity-80 mt-0.5">{r.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-dark-400">
              They'll get an email with a link to set up their own login. You never enter a password on their behalf.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-600 text-sm text-gray-700 dark:text-dark-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {busy ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
