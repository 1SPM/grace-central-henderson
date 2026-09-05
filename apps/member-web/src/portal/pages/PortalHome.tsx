import { Bell, CalendarDays, Users, Heart, ArrowRight } from 'lucide-react';
import { usePortalHome } from '../hooks/usePortalHome';
import type { PortalTab } from '../portalNav';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function PortalHome({ onNavigate }: { onNavigate: (tab: PortalTab) => void }) {
  const { data, isLoading, error, forbidden, refresh } = usePortalHome();

  if (forbidden) {
    return <div className="p-6 text-sm text-stone-500">We couldn't verify your member access. Please contact your church administrator.</div>;
  }
  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-600 mb-3">{error}</p>
        <button onClick={() => void refresh()} className="text-sm font-medium text-rose-700">Try again</button>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="p-4 sm:p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-stone-100 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Good to see you, {data.greeting_name}</h1>
        <p className="text-sm text-stone-500 mt-1">Here's what's happening at your church.</p>
      </div>

      {data.next_actions.length > 0 && (
        <div className="rounded-2xl bg-rose-600 text-white p-4" data-testid="portal-next-actions">
          <p className="text-xs font-medium text-rose-100 uppercase tracking-wide mb-2">Next steps</p>
          <ul className="space-y-1.5">
            {data.next_actions.map(a => (
              <li key={a.action}>
                <button
                  onClick={() => onNavigate(a.action === 'events' || a.action === 'groups' ? 'community' : 'journey')}
                  className="flex items-center justify-between w-full text-left text-sm font-medium py-1"
                >
                  {a.label} <ArrowRight size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="portal-home-events" className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 id="portal-home-events" className="text-sm font-semibold text-stone-900 flex items-center gap-1.5"><CalendarDays size={16} /> Upcoming events</h2>
          <button onClick={() => onNavigate('community')} className="text-xs font-medium text-rose-700">See all</button>
        </div>
        {data.upcoming_events.length === 0 ? (
          <p className="text-sm text-stone-400">No upcoming events yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.upcoming_events.slice(0, 3).map(e => (
              <li key={e.id} className="flex items-center justify-between text-sm">
                <span className="text-stone-700">{e.title}</span>
                <span className="text-stone-400">{formatDate(e.start_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="portal-home-groups" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-home-groups" className="text-sm font-semibold text-stone-900 flex items-center gap-1.5 mb-2"><Users size={16} /> Your groups</h2>
        <p className="text-sm text-stone-600">{data.group_activity.count === 0 ? "You haven't joined a group yet." : `You're part of ${data.group_activity.count} group${data.group_activity.count === 1 ? '' : 's'}.`}</p>
      </section>

      <section aria-labelledby="portal-home-volunteer" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-home-volunteer" className="text-sm font-semibold text-stone-900 flex items-center gap-1.5 mb-2"><Heart size={16} /> Volunteer opportunities</h2>
        <ul className="space-y-1.5">
          {data.volunteer_opportunities.map(o => (
            <li key={o.key} className="text-sm text-stone-600">
              <span className="font-medium text-stone-800">{o.title}</span> — {o.description}
            </li>
          ))}
        </ul>
      </section>

      {data.notifications.length > 0 && (
        <section aria-labelledby="portal-home-notifications" className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 id="portal-home-notifications" className="text-sm font-semibold text-stone-900 flex items-center gap-1.5 mb-2"><Bell size={16} /> Notifications</h2>
          <ul className="space-y-2">
            {data.notifications.map(n => (
              <li key={n.id} className="text-sm text-stone-600">{n.title}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
