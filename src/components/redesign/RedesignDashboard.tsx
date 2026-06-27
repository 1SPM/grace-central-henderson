import { useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { useRedesignDashboard, type DashboardData } from './useRedesignDashboard';
import { PersonAvatar } from './PersonAvatar';
import { ClockCalendarBanner } from '../dashboard/ClockCalendarBanner';
import { useChurchClock } from '../../hooks/useChurchClock';
import { greetingWord } from '../../lib/greeting';
import { CENTRAL_HENDERSON_TIMEZONE } from '../../config/centralHenderson';

const WALLPAPER_KEY = 'grace-hero-wallpaper';

function downscaleImage(file: File, maxW = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no ctx'));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function HeroArt() {
  const [src, setSrc] = useState<string | null>(() => { try { return localStorage.getItem(WALLPAPER_KEY); } catch { return null; } });
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await downscaleImage(file);
      try { localStorage.setItem(WALLPAPER_KEY, dataUrl); } catch { /* quota — keep in-memory only */ }
      setSrc(dataUrl);
    } finally {
      setBusy(false);
    }
  }
  function remove() { try { localStorage.removeItem(WALLPAPER_KEY); } catch { /* ignore */ } setSrc(null); }

  return (
    <div className="hero-art" style={src ? { background: `url(${src}) center/cover no-repeat` } : undefined}>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFile} />
      {!src ? (
        <button className="hero-art-add" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Icon name="plus" size={18} />
          {busy ? 'Uploading…' : 'Add a photo of your church'}
        </button>
      ) : (
        <div className="hero-art-tools">
          <button className="btn btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>Change</button>
          <button className="btn btn-sm" onClick={remove}>Remove</button>
        </div>
      )}
    </div>
  );
}

function GreetingBlock({
  addressee,
  timezone,
  prayersOpen,
  activeMembers,
}: {
  addressee: string;
  timezone?: string;
  prayersOpen: number;
  activeMembers: number;
}) {
  const { zoned, format } = useChurchClock(timezone || CENTRAL_HENDERSON_TIMEZONE);
  const salutation = greetingWord(zoned.hour24);
  const dateStr = format({ weekday: 'long', month: 'long', day: 'numeric' });
  const time = format({ hour: 'numeric', minute: '2-digit', second: '2-digit' });
  return (
    <div>
      <h2 className="hello">{salutation}, <em>{addressee}</em></h2>
      <div className="date">
        {dateStr} · <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{time}</span> · <span style={{ color: 'var(--c-rose-ink)' }}>●</span> {prayersOpen} prayer {prayersOpen === 1 ? 'request' : 'requests'} open · {activeMembers} active members
      </div>
    </div>
  );
}

const HEAT_DOW = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

/* GitHub-style attendance heatmap: 26 weeks x 7 days, colored by check-in count. */
function AttendanceHeatmap({ byDay }: { byDay: Record<string, number> }) {
  const WEEKS = 26;
  const today = new Date();
  // start = Sunday of the week (WEEKS-1) ago
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7);
  const counts: number[] = [];
  const cols: { date: Date; count: number }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: { date: Date; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const c = byDay[`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`] ?? 0;
      col.push({ date, count: c });
      if (c > 0) counts.push(c);
    }
    cols.push(col);
  }
  const max = Math.max(1, ...counts);
  const level = (c: number) => c === 0 ? 0 : c >= max * 0.75 ? 4 : c >= max * 0.5 ? 3 : c >= max * 0.25 ? 2 : 1;
  const total = counts.reduce((s, c) => s + c, 0);
  const future = (d: Date) => d.getTime() > today.getTime();

  return (
    <div className="card">
      <div className="card-head">
        <div><h2>Attendance</h2><div className="sub">{total} check-ins across the last {WEEKS} weeks</div></div>
      </div>
      <div className="heatmap">
        <div className="heatmap-days">{HEAT_DOW.map((d, i) => <div key={i} className="heatmap-day">{d}</div>)}</div>
        <div className="heatmap-grid">
          {cols.map((col, w) => col.map(({ date, count }, d) => (
            <div
              key={`${w}-${d}`}
              className={`heatmap-cell l${future(date) ? 0 : level(count)}`}
              style={{ gridColumn: w + 1, gridRow: d + 1, ...(future(date) ? { opacity: 0.35 } : {}) }}
              title={future(date) ? '' : `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${count} check-in${count === 1 ? '' : 's'}`}
            />
          )))}
        </div>
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map(l => <span key={l} className={`sq heatmap-cell l${l}`} />)}
        <span>More</span>
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
            <PersonAvatar name={p.name} initials={p.initials} />
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

export function DashboardView({
  d,
  onAddPerson,
  onOpenCalendar,
  addressee = 'Pastor',
  timezone,
}: {
  d: DashboardData;
  onAddPerson?: () => void;
  onOpenCalendar?: () => void;
  addressee?: string;
  timezone?: string;
}) {
  return (
    <div className="page">
      <div className="greeting">
        <GreetingBlock addressee={addressee} timezone={timezone} prayersOpen={d.prayersOpen} activeMembers={d.activeMembers} />
        <div className="row">
          <button className="btn"><Icon name="calendar" size={14} /> This week</button>
          <button className="btn btn-primary" onClick={onAddPerson}><Icon name="plus" size={14} /> Add member</button>
        </div>
      </div>

      <ClockCalendarBanner
        variant="redesign"
        eventDays={d.eventDays}
        eventsByDay={d.eventsByDay as Record<string, import('../../lib/calendarEvents').DayAgendaEvent[]>}
        onOpenCalendar={onOpenCalendar}
        timezone={timezone}
      />

      <div className="hero-card">
        <HeroArt />
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

      <AttendanceHeatmap byDay={d.attendanceByDay} />
    </div>
  );
}
