/**
 * Demo "sign in as [leader]" switcher.
 *
 * Demo mode collapses every unauthenticated visitor into one shared
 * `demo-workos-admin` actor (see api/_lib/authz.ts) — deliberate, since a
 * live public demo has no real Clerk sign-in step. That also means it
 * cannot show what individual, permission-scoped staff access actually
 * looks like: every leader sees the same master-admin view.
 *
 * This switcher picks one of Central Henderson's real named leaders
 * (src/config/centralHendersonLeaders.ts) and sends their synthetic
 * demo clerk_id on subsequent requests (src/lib/services/workos.ts),
 * which api/_lib/authz.ts resolves to that leader's own `users` row and
 * their own RBAC permissions — Pastor James Wilson sees master admin,
 * everyone else sees only what their role grants. Reloading is
 * deliberate: several places in this app cache actor-derived state in
 * React memory for the life of the tab (AskGrace's campusCollapsed is
 * one), and a bare localStorage write does not reach them.
 */
import { useState } from 'react';
import { ChevronDown, UserCircle2 } from 'lucide-react';
import { CENTRAL_HENDERSON_LEADERS, getLeaderPhoto } from '../../config/centralHendersonLeaders';
import { setDemoActor, getDemoActor } from '../../lib/services/workos';
import { TENANT_CHURCH_ID } from '../../config/tenant';

function leaderClerkId(leaderId: string): string {
  return `demo-leader-${leaderId.replace(/^ch-leader-/, '')}+${TENANT_CHURCH_ID}`;
}

function leaderEmail(leaderId: string): string {
  return `${leaderId.replace(/^ch-leader-/, '').replace(/-/g, '.')}@centralhenderson.internal`;
}

/** Only Central Henderson has a named leader roster to sign in as. */
const IS_CENTRAL_HENDERSON = TENANT_CHURCH_ID === '11111111-1111-1111-1111-111111111111';

export function DemoLeaderSignIn() {
  const [open, setOpen] = useState(false);
  if (!IS_CENTRAL_HENDERSON) return null;

  const currentClerkId = getDemoActor();
  const current = CENTRAL_HENDERSON_LEADERS.find(l => leaderClerkId(l.id) === currentClerkId);

  function chooseLeader(leaderId: string | null) {
    setDemoActor(leaderId ? leaderClerkId(leaderId) : null);
    setOpen(false);
    window.location.reload();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold bg-white/90 text-brand-800 hover:bg-white transition-colors"
        data-testid="demo-leader-signin-toggle"
      >
        <UserCircle2 size={12} />
        <span className="truncate flex-1 text-left">
          {current ? `Signed in: ${current.displayName}` : 'Signed in: Demo Administrator'}
        </span>
        <ChevronDown size={11} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 w-64 max-h-72 overflow-y-auto rounded-lg bg-white shadow-lg ring-1 ring-black/10 py-1 z-50"
          data-testid="demo-leader-signin-menu"
        >
          <button
            type="button"
            onClick={() => chooseLeader(null)}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${!current ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700'}`}
          >
            Demo Administrator
            <span className="block text-[10px] text-gray-400">Shared master-admin demo actor</span>
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
              data-testid={`demo-leader-option-${leader.id}`}
            >
              <img
                src={getLeaderPhoto(leader.id)}
                alt=""
                className="w-6 h-6 rounded-full object-cover flex-shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{leader.displayName}</span>
                <span className="block text-[10px] text-gray-400 truncate">{leader.title} · {leaderEmail(leader.id)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
