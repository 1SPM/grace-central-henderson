import { MapPin, Phone, Clock } from 'lucide-react';
import { usePortalChurch } from '../hooks/usePortalChurch';

export function PortalChurch() {
  const { data, isLoading, error, forbidden, refresh } = usePortalChurch();

  if (forbidden) {
    return <div className="p-6 text-sm text-stone-500">We couldn't verify your member access.</div>;
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
        <h1 className="text-2xl font-semibold text-stone-900">{data.church?.name ?? 'My Church'}</h1>
        <div className="mt-2 space-y-1 text-sm text-stone-500">
          {data.church?.address && (
            <p className="flex items-center gap-1.5"><MapPin size={14} /> {data.church.address}, {data.church.city} {data.church.state} {data.church.zip}</p>
          )}
          {data.church?.phone && <p className="flex items-center gap-1.5"><Phone size={14} /> {data.church.phone}</p>}
          {data.service_times.length > 0 && (
            <p className="flex items-center gap-1.5"><Clock size={14} /> {data.service_times.map((s) => s.label ?? `${s.day} ${s.time}`).join(' · ')}</p>
          )}
        </div>
      </div>

      {data.announcements.length > 0 && (
        <section aria-labelledby="portal-church-announcements" className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 id="portal-church-announcements" className="text-sm font-semibold text-stone-900 mb-3">Announcements</h2>
          <ul className="space-y-3">
            {data.announcements.map(a => (
              <li key={a.id}>
                <p className="text-sm font-medium text-stone-800">{a.title}</p>
                {a.body && <p className="text-sm text-stone-500 mt-0.5">{a.body}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="portal-church-leadership" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-church-leadership" className="text-sm font-semibold text-stone-900 mb-3">Leadership</h2>
        {data.leadership.length === 0 ? (
          <p className="text-sm text-stone-400">No leadership profiles published yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {data.leadership.map(l => (
              <li key={l.id} className="text-sm">
                <p className="font-medium text-stone-800">{l.name}</p>
                <p className="text-stone-500">{l.title}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="portal-church-ministries" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-church-ministries" className="text-sm font-semibold text-stone-900 mb-3">Ministries &amp; groups</h2>
        {data.ministries.length === 0 ? (
          <p className="text-sm text-stone-400">No groups published yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.ministries.map(m => (
              <li key={m.id} className="text-sm">
                <span className="font-medium text-stone-800">{m.name}</span>
                {m.description && <span className="text-stone-500"> — {m.description}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="portal-church-events" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-church-events" className="text-sm font-semibold text-stone-900 mb-3">Upcoming events</h2>
        {data.events.length === 0 ? (
          <p className="text-sm text-stone-400">No upcoming events yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.events.map(e => (
              <li key={e.id} className="text-sm text-stone-700">{e.title} — {new Date(e.start_date).toLocaleDateString()}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
