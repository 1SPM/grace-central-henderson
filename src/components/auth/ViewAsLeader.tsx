/**
 * "View as [team member]" — a real, already-authenticated master admin
 * (the pastor) previewing another staff member's own scoped view.
 *
 * This does NOT grant anonymous access: it renders only for a visitor who
 * is genuinely signed in (isSignedIn — real Clerk, not the demo bypass)
 * and whose own resolved permissions already include admin.manage_settings
 * (isMasterAdmin). The selection is sent as a header alongside the real
 * bearer token (src/lib/services/workos.ts) and api/_lib/authz.ts only
 * honors it for a caller who independently already holds that permission
 * — closing the earlier version of this control, which worked from an
 * unauthenticated demo header and could be sent directly to the API by
 * anyone, bypassing the app's own sign-in requirement for this domain.
 *
 * Only Central Henderson has a named leader roster to preview as.
 */
import { useState } from 'react';
import { ChevronDown, Eye } from 'lucide-react';
import { CENTRAL_HENDERSON_LEADERS, getLeaderPhoto } from '../../config/centralHendersonLeaders';
import { setViewAsActor, getViewAsActor } from '../../lib/services/workos';
import { TENANT_CHURCH_ID } from '../../config/tenant';
import { useAuthContext } from '../../contexts/AuthContext';
import { useWorkOsPermissions } from '../../hooks/useWorkOsPermissions';

function leaderClerkId(leaderId: string): string {
  return `demo-leader-${leaderId.replace(/^ch-leader-/, '')}+${TENANT_CHURCH_ID}`;
}

const IS_CENTRAL_HENDERSON = TENANT_CHURCH_ID === '11111111-1111-1111-1111-111111111111';

export function ViewAsLeader() {
  const [open, setOpen] = useState(false);
  const { isSignedIn } = useAuthContext();
  const { isMasterAdmin, isLoading } = useWorkOsPermissions();

  if (!IS_CENTRAL_HENDERSON || !isSignedIn || isLoading || !isMasterAdmin) return null;

  const currentClerkId = getViewAsActor();
  const current = CENTRAL_HENDERSON_LEADERS.find(l => leaderClerkId(l.id) === currentClerkId);

  function chooseLeader(leaderId: string | null) {
    setViewAsActor(leaderId ? leaderClerkId(leaderId) : null);
    setOpen(false);
    window.location.reload();
  }

  return (
    <div className="mt-2 pt-2 border-t border-white/15 px-2.5 relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold bg-white/90 text-brand-800 hover:bg-white transition-colors"
        data-testid="view-as-leader-toggle"
      >
        <Eye size={12} />
        <span className="truncate flex-1 text-left">
          {current ? `Viewing as: ${current.displayName}` : 'View as a team member'}
        </span>
        <ChevronDown size={11} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 w-64 max-h-72 overflow-y-auto rounded-lg bg-white shadow-lg ring-1 ring-black/10 py-1 z-50"
          data-testid="view-as-leader-menu"
        >
          <button
            type="button"
            onClick={() => chooseLeader(null)}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${!current ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700'}`}
          >
            Yourself
            <span className="block text-[10px] text-gray-400">Your own master-admin view</span>
          </button>
          <div className="my-1 border-t border-gray-100" />
          {CENTRAL_HENDERSON_LEADERS.map(leader => (
            <button
              key={leader.id}
              type="button"
              onClick={() => chooseLeader(leader.id)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${
                current?.id === leader.id ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700'
              }`}
              data-testid={`view-as-leader-option-${leader.id}`}
            >
              <img
                src={getLeaderPhoto(leader.id)}
                alt=""
                className="w-6 h-6 rounded-full object-cover flex-shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{leader.displayName}</span>
                <span className="block text-[10px] text-gray-400 truncate">{leader.title}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
