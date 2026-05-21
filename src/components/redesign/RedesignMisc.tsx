import { Icon, type IconName } from './Icon';
import type { GraceData } from './useGraceData';

export function RedesignGroups({ data }: { data: GraceData }) {
  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 18 }}>
        <h2 className="serif" style={{ fontSize: 26, margin: 0 }}>Small groups</h2>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }}><Icon name="plus" size={14} /> New group</button>
      </div>
      {data.groups.length === 0 ? (
        <div className="card"><p className="mute" style={{ fontSize: 13 }}>No small groups yet.</p></div>
      ) : (
        <div className="grid-3">
          {data.groups.map(g => (
            <div key={g.id} className="card">
              <div className="row" style={{ marginBottom: 10 }}>
                <div className="icon-chip tone-sky"><Icon name="grid" size={16} /></div>
                <strong style={{ fontSize: 14 }}>{g.name}</strong>
              </div>
              <div className="serif" style={{ fontSize: 30, lineHeight: 1 }}>{g.memberCount}</div>
              <div className="mute" style={{ fontSize: 12, marginTop: 2 }}>{g.memberCount === 1 ? 'member' : 'members'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RedesignEvents({ data }: { data: GraceData }) {
  const now = Date.now();
  const upcoming = data.events.filter(e => new Date(e.startDate).getTime() >= now);
  const past = data.events.filter(e => new Date(e.startDate).getTime() < now);
  const list = upcoming.length > 0 ? upcoming : past;
  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 18 }}>
        <h2 className="serif" style={{ fontSize: 26, margin: 0 }}>Events</h2>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }}><Icon name="plus" size={14} /> New event</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-head" style={{ padding: '16px 20px', marginBottom: 0, borderBottom: '1px solid var(--line-2)' }}>
          <h2>{upcoming.length > 0 ? 'Upcoming' : 'Recent events'}</h2>
          <span className="mute" style={{ fontSize: 12 }}>{list.length} {list.length === 1 ? 'event' : 'events'}</span>
        </div>
        {list.length === 0 ? <p className="mute" style={{ fontSize: 13, padding: 20 }}>No events on the calendar.</p> : (
          <div style={{ padding: '4px 20px 12px' }}>
            {list.slice(0, 12).map(e => {
              const d = new Date(e.startDate);
              return (
                <div key={e.id} className="row" style={{ padding: '12px 0', borderBottom: '1px solid var(--line-2)', gap: 14 }}>
                  <div className="tone-indigo" style={{ width: 48, height: 56, borderRadius: 10, background: 'var(--tc-soft)', color: 'var(--tc-ink)', display: 'grid', placeItems: 'center', flex: '0 0 auto', border: '1px solid color-mix(in oklab, var(--tc) 25%, transparent)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700 }}>{d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{d.getDate()}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13.5 }}>{e.title}</div>
                    <div className="mute" style={{ fontSize: 11.5 }}>{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}{e.location && ` · ${e.location}`}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function RedesignGiving({ data }: { data: GraceData }) {
  const total = data.giving.reduce((s, g) => s + g.amount, 0);
  const byFund = new Map<string, number>();
  data.giving.forEach(g => byFund.set(g.fund, (byFund.get(g.fund) ?? 0) + g.amount));
  const funds = Array.from(byFund.entries()).sort((a, b) => b[1] - a[1]);
  const maxFund = Math.max(1, ...funds.map(f => f[1]));
  return (
    <div className="page">
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card kpi tone-amber"><div className="kpi-head"><div className="icon-chip"><Icon name="dollar" size={15} /></div><div className="label">Total given</div></div><div className="val">${total.toLocaleString()}</div><div className="delta up"><b>{data.giving.length} gifts</b></div></div>
        <div className="card kpi tone-emerald"><div className="kpi-head"><div className="icon-chip"><Icon name="check" size={15} /></div><div className="label">Average gift</div></div><div className="val">${data.giving.length ? Math.round(total / data.giving.length).toLocaleString() : 0}</div><div className="delta up"><b>per gift</b></div></div>
        <div className="card kpi tone-indigo"><div className="kpi-head"><div className="icon-chip"><Icon name="grid" size={15} /></div><div className="label">Funds</div></div><div className="val">{funds.length}</div><div className="delta up"><b>active</b></div></div>
      </div>
      <div className="card">
        <div className="card-head"><h2>Giving by fund</h2></div>
        {funds.length === 0 ? <p className="mute" style={{ fontSize: 13 }}>No giving recorded yet.</p> : (
          <div className="col" style={{ gap: 0 }}>
            {funds.map(([fund, amt]) => (
              <div key={fund} className="bar-row">
                <div style={{ fontSize: 13, textTransform: 'capitalize' }}>{fund}</div>
                <div className="bar"><span style={{ width: `${(amt / maxFund) * 100}%` }} /></div>
                <div className="serif" style={{ fontSize: 15, textAlign: 'right' }}>${amt.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function RedesignPlaceholder({ title, icon }: { title: string; icon: IconName }) {
  return (
    <div className="page">
      <div className="card" style={{ display: 'grid', placeItems: 'center', minHeight: 360, textAlign: 'center', padding: 40 }}>
        <div>
          <div className="icon-chip lg" style={{ margin: '0 auto 16px', width: 60, height: 60, borderRadius: 14 }}><Icon name={icon} size={26} /></div>
          <h2 className="serif" style={{ fontSize: 28, margin: 0, fontWeight: 400 }}>{title}</h2>
          <div className="mute" style={{ marginTop: 6, fontSize: 13 }}>This section is coming next on the new design.</div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 18, gap: 8 }}>
            <button className="btn btn-primary">Set up {title.toLowerCase()}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
