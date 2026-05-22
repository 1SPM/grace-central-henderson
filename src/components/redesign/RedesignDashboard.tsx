import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { useRedesignDashboard, type DashboardData } from './useRedesignDashboard';

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const MC_DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function ClockCalendar({ eventDays, onOpenCalendar }: { eventDays: string[]; onOpenCalendar?: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const eventSet = new Set(eventDays);
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });

  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

  return (
    <div className="card clock-cal">
      <div className="cc-clock">
        <div className="cc-time">{time}</div>
        <div className="cc-date">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      </div>
      <div className="cc-cal">
        <div className="cc-month">
          <span>{now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          {onOpenCalendar && <button className="btn btn-ghost btn-sm" onClick={onOpenCalendar}>Calendar <Icon name="arrow_right" size={12} /></button>}
        </div>
        <div className="mc-grid">
          {MC_DOW.map((d, i) => <div key={i} className="mc-dow">{d}</div>)}
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === month;
            const isToday = inMonth && d.getDate() === todayDate;
            const hasEvent = eventSet.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
            return (
              <div key={i} className={`mc-day${inMonth ? '' : ' other'}${isToday ? ' today' : ''}`}>
                <span>{d.getDate()}</span>
                {hasEvent && <i className="mc-dot" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, val, delta, icon, tone }: { label: string; val: string; delta: string; icon: IconName; tone: string }) {
  return (
    <div className={`card kpi tone-${tone}`}>
      <div className="kpi-head">
        <div className="icon-chip"><Icon name={icon} size={15} /></div>
        <div className="label">{label}</div>
      </div>
      <div className="val">{val}</div>
      <div className="delta up"><b>{delta}</b></div>
    </div>
  );
}

function NeedsCare({ d }: { d: DashboardData }) {
  if (d.needsCareTotal === 0) return null;
  const more = d.needsCareTotal - d.needsCare.length;
  return (
    <div className="needs-care">
      <div className="needs-care-glow" />
      <div className="needs-care-icon"><Icon name="heart" size={18} /></div>
      <div className="needs-care-text">
        <div className="needs-care-title">Members need care</div>
        <div className="needs-care-sub">
          <b>{d.needsCareTotal} {d.needsCareTotal === 1 ? 'person' : 'people'}</b> haven't been active recently. Reach out today.
        </div>
      </div>
      <div className="needs-care-people">
        {d.needsCare.map(p => (
          <div key={p.id} className="needs-care-chip">
            <div className="avatar sm">{p.initials}</div>
            <div className="needs-care-chip-text">
              <div className="needs-care-chip-name">{p.name}</div>
              <div className="needs-care-chip-reason">{p.reason}</div>
            </div>
          </div>
        ))}
        {more > 0 && <span className="mute" style={{ fontSize: 12, alignSelf: 'center' }}>+{more} more</span>}
      </div>
      <div className="needs-care-actions">
        <button className="btn btn-sm btn-primary">Review all <Icon name="arrow_right" size={12} /></button>
      </div>
    </div>
  );
}

export function RedesignDashboard() {
  const { data: d, status } = useRedesignDashboard();
  if (status === 'loading') {
    return (
      <div className="page"><div style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, border: '2px solid var(--line)', borderBottomColor: 'var(--primary)', animation: 'gv2-spin 0.7s linear infinite' }} />
      </div></div>
    );
  }
  if (status === 'error' || !d) {
    return <div className="page"><p className="mute">Couldn't load the dashboard. Check the connection and refresh.</p></div>;
  }
  return <DashboardView d={d} />;
}

export function DashboardView({ d, onAddPerson, onOpenCalendar }: { d: DashboardData; onAddPerson?: () => void; onOpenCalendar?: () => void }) {
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const maxWeek = Math.max(1, ...d.attendanceWeeks.map(w => w.count));

  return (
    <div className="page">
      <div className="greeting">
        <div>
          <h2 className="hello">{greetingWord()}, <em>Pastor</em></h2>
          <div className="date">
            {dateStr} · <span style={{ color: 'var(--c-rose-ink)' }}>●</span> {d.prayersOpen} prayer {d.prayersOpen === 1 ? 'request' : 'requests'} open · {d.activeMembers} active members
          </div>
        </div>
        <div className="row">
          <button className="btn"><Icon name="calendar" size={14} /> This week</button>
          <button className="btn btn-primary" onClick={onAddPerson}><Icon name="plus" size={14} /> Add member</button>
        </div>
      </div>

      <div className="hero-card">
        <div className="hero-art" />
        <div className="hero-meta">
          <div>
            <div className="eyebrow">{d.churchName}</div>
            <h2 className="serif">A church that knows your name.</h2>
            <div className="hero-sub">{d.activeMembers} active members · {d.groups} small {d.groups === 1 ? 'group' : 'groups'} · {d.totalMembers} people in all.</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary btn-sm">Sunday plan <Icon name="arrow_right" size={12} /></button>
          </div>
        </div>
      </div>

      <NeedsCare d={d} />

      <div className="kpis">
        <KPI label="Active members" val={String(d.activeMembers)} delta={d.newThisMonth > 0 ? `+${d.newThisMonth} this month` : 'no change this month'} icon="users" tone="indigo" />
        <KPI label="Visitors" val={String(d.visitors)} delta="current" icon="heart" tone="amber" />
        <KPI label="Prayer requests" val={String(d.prayersOpen)} delta="open" icon="pray" tone="rose" />
        <KPI label="Small groups" val={String(d.groups)} delta="active" icon="grid" tone="emerald" />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Recent activity</h2>
              <div className="sub">Latest interactions logged across the church</div>
            </div>
          </div>
          {d.recentActivity.length === 0 ? (
            <p className="mute" style={{ fontSize: 13 }}>No interactions logged yet.</p>
          ) : (
            <div className="timeline">
              {d.recentActivity.map(a => (
                <div className={`timeline-item tone-${a.tone}`} key={a.id}>
                  <div className="tdot"><Icon name={a.icon} size={13} /></div>
                  <div className="ttext">
                    <div>{a.text}</div>
                    <div className="when">{a.when}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col" style={{ gap: 'var(--gap, 18px)' }}>
          <ClockCalendar eventDays={d.eventDays} onOpenCalendar={onOpenCalendar} />
          <div className="card">
            <div className="card-head"><h2>Upcoming</h2></div>
            {d.upcoming.length === 0 ? (
              <div style={{ padding: '8px 0' }}>
                <p className="mute" style={{ fontSize: 13, margin: 0 }}>Nothing on the calendar yet.</p>
                {d.lastEventLabel && <p className="mute" style={{ fontSize: 12, marginTop: 6 }}>Last event was {d.lastEventLabel}.</p>}
                <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={onOpenCalendar}><Icon name="plus" size={12} /> Schedule an event</button>
              </div>
            ) : (
              <div className="col" style={{ gap: 0 }}>
                {d.upcoming.map(e => (
                  <div key={e.id} className="row tone-indigo" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)', gap: 14 }}>
                    <div style={{ width: 48, height: 56, borderRadius: 10, background: 'var(--tc-soft)', color: 'var(--tc-ink)', display: 'grid', placeItems: 'center', flex: '0 0 auto', border: '1px solid color-mix(in oklab, var(--tc) 25%, transparent)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>{e.day}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, marginTop: 2 }}>{e.date}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13.5 }}>{e.title}</div>
                      <div className="mute" style={{ fontSize: 11.5 }}>{e.time}{e.location && ` · ${e.location}`}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Attendance</h2>
            <div className="sub">Check-ins over the last 8 weeks</div>
          </div>
        </div>
        {d.attendanceInWindow === 0 ? (
          <div style={{ padding: '8px 0' }}>
            <p className="mute" style={{ fontSize: 13, margin: 0 }}>No check-ins recorded in the last 8 weeks.</p>
            {d.lastAttendanceLabel && <p className="mute" style={{ fontSize: 12, marginTop: 6 }}>Last check-in was {d.lastAttendanceLabel}.</p>}
            <button className="btn btn-sm" style={{ marginTop: 12 }}><Icon name="check" size={12} /> Take attendance</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 10, alignItems: 'end', height: 120 }}>
            {d.attendanceWeeks.map(w => (
              <div key={w.label} style={{ textAlign: 'center' }}>
                <div style={{ height: 90, display: 'flex', alignItems: 'flex-end' }}>
                  <div title={`${w.count} check-ins`} style={{
                    width: '100%', borderRadius: '6px 6px 0 0',
                    background: w.count > 0 ? 'var(--primary)' : 'var(--bg-2)',
                    height: `${Math.max(4, (w.count / maxWeek) * 90)}px`,
                  }} />
                </div>
                <div className="mute" style={{ fontSize: 11, marginTop: 6 }}>{w.count}</div>
                <div className="mute" style={{ fontSize: 10 }}>{w.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
