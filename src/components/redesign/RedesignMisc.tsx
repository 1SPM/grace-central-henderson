import { useMemo, useState } from 'react';
import { Icon, type IconName } from './Icon';
import type { GraceData } from './useGraceData';
import type { RedesignActions, RedesignEventCategory } from './actions';

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

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const EVENT_CATEGORIES: RedesignEventCategory[] = ['service', 'meeting', 'event', 'small-group', 'class', 'outreach', 'other'];

function NewEventModal({ defaultDate, onClose, onCreate }: { defaultDate?: Date; onClose: () => void; onCreate: RedesignActions['addEvent'] }) {
  const initial = defaultDate ?? new Date();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initial.toISOString().split('T')[0]);
  const [time, setTime] = useState('09:00');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<RedesignEventCategory>('service');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    const startDate = new Date(`${date}T${time}`).toISOString();
    await onCreate({ title: title.trim(), startDate, allDay: false, location: location.trim() || undefined, category });
    onClose();
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>New event</h2>
        <div className="sub">Add it to the calendar</div>
        <div className="field"><label>Title</label><input className="input" placeholder="Sunday Service" value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>Date</label><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="field" style={{ flex: 1 }}><label>Time</label><input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} /></div>
        </div>
        <div className="field"><label>Location</label><input className="input" placeholder="Main Sanctuary" value={location} onChange={e => setLocation(e.target.value)} /></div>
        <div className="field"><label>Category</label>
          <select className="select" value={category} onChange={e => setCategory(e.target.value as RedesignEventCategory)}>
            {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!title.trim() || saving}>{saving ? 'Saving…' : 'Create event'}</button>
        </div>
      </div>
    </div>
  );
}

export function RedesignEvents({ data, actions }: { data: GraceData; actions?: RedesignActions }) {
  const [showNew, setShowNew] = useState(false);
  // events grouped by local day
  const eventsByDay = useMemo(() => {
    const m = new Map<string, GraceData['events']>();
    for (const e of data.events) {
      const d = new Date(e.startDate);
      if (isNaN(d.getTime())) continue;
      const k = dayKey(d);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    for (const arr of m.values()) arr.sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));
    return m;
  }, [data.events]);

  // start on the month of the most recent event (so a real grid shows up even though all events are past)
  const initialMonth = useMemo(() => {
    const times = data.events.map(e => +new Date(e.startDate)).filter(t => !isNaN(t));
    const ref = times.length ? new Date(Math.max(...times)) : new Date();
    return new Date(ref.getFullYear(), ref.getMonth(), 1);
  }, [data.events]);

  const [month, setMonth] = useState(initialMonth);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const today = new Date();
  const todayKey = dayKey(today);

  // build 6-week grid starting Sunday
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const selectedEvents = selectedKey ? (eventsByDay.get(selectedKey) ?? []) : [];
  const selectedDate = selectedKey ? (() => { const [y, mo, da] = selectedKey.split('-').map(Number); return new Date(y, mo, da); })() : null;
  const monthCount = data.events.filter(e => { const d = new Date(e.startDate); return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth(); }).length;

  const shiftMonth = (delta: number) => { setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1)); setSelectedKey(null); };

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 18 }}>
        <h2 className="serif" style={{ fontSize: 26, margin: 0 }}>Calendar</h2>
        <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
          <button className="btn btn-sm btn-icon" onClick={() => shiftMonth(-1)} title="Previous month"><Icon name="arrow_left" size={14} /></button>
          <button className="btn btn-sm" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedKey(null); }}>Today</button>
          <button className="btn btn-sm btn-icon" onClick={() => shiftMonth(1)} title="Next month"><Icon name="arrow_right" size={14} /></button>
          {actions && <button className="btn btn-primary" onClick={() => setShowNew(true)}><Icon name="plus" size={14} /> New event</button>}
        </div>
      </div>

      {showNew && actions && (
        <NewEventModal
          defaultDate={selectedDate ?? undefined}
          onClose={() => setShowNew(false)}
          onCreate={actions.addEvent}
        />
      )}

      <div className="card">
        <div className="card-head">
          <h2>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
          <span className="mute" style={{ fontSize: 12 }}>{monthCount} {monthCount === 1 ? 'event' : 'events'} this month</span>
        </div>
        <div className="cal-grid">
          {DOW.map(d => <div key={d} className="cal-dow">{d}</div>)}
          {cells.map((d, i) => {
            const k = dayKey(d);
            const inMonth = d.getMonth() === month.getMonth();
            const dayEvents = eventsByDay.get(k) ?? [];
            return (
              <div
                key={i}
                className={`cal-cell${inMonth ? '' : ' other'}${k === todayKey ? ' today' : ''}${k === selectedKey ? ' selected' : ''}`}
                onClick={() => setSelectedKey(k === selectedKey ? null : k)}
              >
                <div className="cal-num">{d.getDate()}</div>
                {dayEvents.slice(0, 2).map(e => <div key={e.id} className="cal-ev tone-violet" title={e.title}>{e.title}</div>)}
                {dayEvents.length > 2 && <div className="cal-more">+{dayEvents.length - 2} more</div>}
              </div>
            );
          })}
        </div>
      </div>

      {selectedKey && selectedDate && (
        <div className="card" style={{ marginTop: 'var(--gap, 18px)' }}>
          <div className="card-head"><h2>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2></div>
          {selectedEvents.length === 0 ? <p className="mute" style={{ fontSize: 13 }}>Nothing scheduled this day.</p> : (
            <div className="col" style={{ gap: 0 }}>
              {selectedEvents.map(e => {
                const d = new Date(e.startDate);
                return (
                  <div key={e.id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)', gap: 12 }}>
                    <div className="icon-chip tone-violet"><Icon name="calendar" size={15} /></div>
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
      )}
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
