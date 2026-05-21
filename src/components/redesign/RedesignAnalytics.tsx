import { useMemo } from 'react';
import { Icon, type IconName } from './Icon';
import type { GraceData } from './useGraceData';

function Kpi({ label, val, delta, icon, tone }: { label: string; val: string | number; delta: string; icon: IconName; tone: string }) {
  return (
    <div className={`card kpi tone-${tone}`}>
      <div className="kpi-head"><div className="icon-chip"><Icon name={icon} size={15} /></div><div className="label">{label}</div></div>
      <div className="val">{val}</div>
      <div className="delta up"><b>{delta}</b></div>
    </div>
  );
}

function BarRow({ label, val, max }: { label: string; val: number; max: number }) {
  return (
    <div className="bar-row">
      <div style={{ fontSize: 13 }}>{label}</div>
      <div className="bar"><span style={{ width: `${max ? (val / max) * 100 : 0}%` }} /></div>
      <div className="serif" style={{ fontSize: 16, textAlign: 'right' }}>{val}</div>
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = { sunday: 'Sunday', wednesday: 'Wednesday', 'small-group': 'Small group', special: 'Special' };

export function RedesignAttendance({ data }: { data: GraceData }) {
  const personById = useMemo(() => new Map(data.people.map(p => [p.id, p])), [data.people]);
  const byType = useMemo(() => {
    const m = new Map<string, number>();
    data.attendance.forEach(a => m.set(a.eventType, (m.get(a.eventType) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [data.attendance]);
  const distinct = useMemo(() => new Set(data.attendance.map(a => a.personId)).size, [data.attendance]);
  const lastDate = data.attendance[0]?.date;
  const maxType = Math.max(1, ...byType.map(t => t[1]));

  return (
    <div className="page">
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <Kpi label="Total check-ins" val={data.attendance.length} delta="all recorded" icon="check" tone="emerald" />
        <Kpi label="People attended" val={distinct} delta="distinct members" icon="users" tone="indigo" />
        <Kpi label="Service types" val={byType.length} delta="tracked" icon="calendar" tone="sky" />
        <Kpi label="Last check-in" val={lastDate ? new Date(lastDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'} delta="most recent" icon="bell" tone="amber" />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div><h2>Check-ins by service</h2><div className="sub">Across all recorded attendance</div></div></div>
          {byType.length === 0 ? <p className="mute" style={{ fontSize: 13 }}>No attendance recorded yet.</p> : (
            <div className="col" style={{ gap: 0 }}>
              {byType.map(([type, n]) => <BarRow key={type} label={EVENT_LABELS[type] || type} val={n} max={maxType} />)}
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-head" style={{ padding: '16px 20px', marginBottom: 0, borderBottom: '1px solid var(--line-2)' }}><h2>Recent check-ins</h2></div>
          <table className="table">
            <thead><tr><th>Member</th><th>Service</th><th>Date</th></tr></thead>
            <tbody>
              {data.attendance.slice(0, 8).map(a => {
                const p = personById.get(a.personId);
                return (
                  <tr key={a.id} style={{ cursor: 'default' }}>
                    <td><div className="name"><div className="avatar sm">{p?.initials || '?'}</div><div>{p?.name || 'Unknown'}</div></div></td>
                    <td className="mute" style={{ fontSize: 12 }}>{EVENT_LABELS[a.eventType] || a.eventType}</td>
                    <td className="mute" style={{ fontSize: 12 }}>{new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  </tr>
                );
              })}
              {data.attendance.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 40 }} className="mute">No check-ins recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function RedesignReports({ data }: { data: GraceData }) {
  const active = data.people.filter(p => p.status !== 'inactive').length;
  const visitors = data.people.filter(p => p.status === 'visitor').length;
  const givingTotal = data.giving.reduce((s, g) => s + g.amount, 0);

  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    data.people.forEach(p => m.set(p.status, (m.get(p.status) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [data.people]);
  const maxStatus = Math.max(1, ...statusCounts.map(s => s[1]));

  const topEngaged = useMemo(() => {
    const count = new Map<string, number>();
    data.interactions.forEach(i => count.set(i.personId, (count.get(i.personId) ?? 0) + 1));
    return data.people
      .map(p => ({ p, n: count.get(p.id) ?? 0 }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [data.people, data.interactions]);

  const inactive = data.people.filter(p => p.status === 'inactive');

  return (
    <div className="page">
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <Kpi label="Total people" val={data.people.length} delta="in directory" icon="users" tone="indigo" />
        <Kpi label="Active" val={active} delta={`${Math.round((active / Math.max(1, data.people.length)) * 100)}% of people`} icon="check" tone="emerald" />
        <Kpi label="Visitors" val={visitors} delta="current" icon="heart" tone="rose" />
        <Kpi label="Giving" val={`$${givingTotal.toLocaleString()}`} delta={`${data.giving.length} gifts`} icon="dollar" tone="amber" />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div><h2>Membership by status</h2><div className="sub">Everyone in the directory</div></div></div>
          <div className="col" style={{ gap: 0 }}>
            {statusCounts.map(([s, n]) => <BarRow key={s} label={s[0].toUpperCase() + s.slice(1)} val={n} max={maxStatus} />)}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Most engaged</h2><span className="badge badge-info dot">by interactions</span></div>
          {topEngaged.length === 0 ? <p className="mute" style={{ fontSize: 13 }}>No interactions logged yet.</p> : (
            <div className="col" style={{ gap: 0 }}>
              {topEngaged.map((x, i) => (
                <div key={x.p.id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
                  <div className="serif" style={{ width: 24, color: 'var(--muted)', fontSize: 18 }}>{i + 1}</div>
                  <div className="avatar sm">{x.p.initials}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 500 }}>{x.p.name}</div></div>
                  <div className="serif" style={{ fontSize: 18 }}>{x.n}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Needs follow-up</h2><span className="badge badge-warn dot">{inactive.length} {inactive.length === 1 ? 'person' : 'people'}</span></div>
        {inactive.length === 0 ? <p className="mute" style={{ fontSize: 13 }}>No inactive members — everyone's engaged.</p> : (
          <div className="col" style={{ gap: 0 }}>
            {inactive.map(p => (
              <div key={p.id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
                <div className="avatar sm">{p.initials}</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 500 }}>{p.name}</div><div className="mute" style={{ fontSize: 11.5 }}>{p.email || 'No email'}</div></div>
                <button className="btn btn-sm"><Icon name="mail" size={12} /> Reach out</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
