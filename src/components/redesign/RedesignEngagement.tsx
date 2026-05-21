import { useMemo, useState } from 'react';
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

function Audience({ label, n, highlight }: { label: string; n: number; highlight?: boolean }) {
  return (
    <div className="row" style={{ padding: '8px 10px', borderRadius: 8, background: highlight ? 'var(--c-amber-soft)' : 'transparent' }}>
      <Icon name="users" size={14} className="mute" />
      <span style={{ fontSize: 13, flex: 1 }}>{label}</span>
      <span className="mute" style={{ fontSize: 12 }}>{n}</span>
    </div>
  );
}

function ComposeModal({ audiences, onClose }: { audiences: { label: string; n: number }[]; onClose: () => void }) {
  const [channel, setChannel] = useState('email');
  const [audience, setAudience] = useState(audiences[0]?.label ?? 'Whole church');
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>New message</h2>
        <div className="sub">Reach your people via email or SMS</div>
        <div className="row" style={{ gap: 6, marginBottom: 14 }}>
          {(['email', 'sms', 'phone'] as const).map(c => (
            <button key={c} className={`chip ${channel === c ? 'active' : ''}`} onClick={() => setChannel(c)}>
              <Icon name={c === 'email' ? 'mail' : c === 'sms' ? 'chat' : 'phone'} size={12} /> {c[0].toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
        <div className="field">
          <label>Send to</label>
          <select className="select" value={audience} onChange={e => setAudience(e.target.value)}>
            {audiences.map(a => <option key={a.label}>{a.label} ({a.n})</option>)}
          </select>
        </div>
        {channel === 'email' && <div className="field"><label>Subject</label><input className="input" placeholder="Sunday service update" /></div>}
        <div className="field"><label>Message</label><textarea className="textarea" placeholder="Grace and peace…" /></div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn">Save draft</button>
          <button className="btn btn-primary" onClick={onClose}><Icon name="sparkle" size={13} /> Send</button>
        </div>
      </div>
    </div>
  );
}

const MSG_ICON: Record<string, IconName> = { email: 'mail', text: 'chat', call: 'phone' };

export function RedesignEngagement({ data }: { data: GraceData }) {
  const [composeOpen, setComposeOpen] = useState(false);
  const personById = useMemo(() => new Map(data.people.map(p => [p.id, p])), [data.people]);

  const emails = data.interactions.filter(i => i.type === 'email').length;
  const texts = data.interactions.filter(i => i.type === 'text').length;
  const calls = data.interactions.filter(i => i.type === 'call').length;
  const recentMsgs = data.interactions.filter(i => i.type === 'email' || i.type === 'text' || i.type === 'call').slice(0, 6);

  const audiences = [
    { label: 'Whole church', n: data.people.length },
    { label: 'Members', n: data.people.filter(p => p.status === 'member' || p.status === 'regular').length },
    { label: 'Visitors', n: data.people.filter(p => p.status === 'visitor').length },
    { label: 'Leaders', n: data.people.filter(p => p.status === 'leader').length },
  ];
  const inactiveN = data.people.filter(p => p.status === 'inactive').length;

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 18 }}>
        <div className="chips">
          <button className="chip active">All channels</button>
          <button className="chip"><Icon name="mail" size={12} /> Email</button>
          <button className="chip"><Icon name="chat" size={12} /> SMS</button>
        </div>
        <div style={{ marginLeft: 'auto' }} className="row">
          <button className="btn btn-primary" onClick={() => setComposeOpen(true)}><Icon name="plus" size={14} /> New message</button>
        </div>
      </div>

      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <Kpi label="Emails logged" val={emails} delta="all time" icon="mail" tone="indigo" />
        <Kpi label="Texts logged" val={texts} delta="all time" icon="chat" tone="rose" />
        <Kpi label="Calls logged" val={calls} delta="all time" icon="phone" tone="sky" />
        <Kpi label="Scheduled" val={data.scheduledCount} delta="queued to send" icon="bell" tone="amber" />
      </div>

      <div className="grid-2">
        <div className="card" style={{ padding: 0 }}>
          <div className="card-head" style={{ padding: '16px 20px', marginBottom: 0, borderBottom: '1px solid var(--line-2)' }}><h2>Recent messages</h2></div>
          {recentMsgs.length === 0 ? <p className="mute" style={{ fontSize: 13, padding: 20 }}>No messages logged yet.</p> : (
            <div>
              {recentMsgs.map(m => {
                const p = personById.get(m.personId);
                return (
                  <div key={m.id} className="campaign">
                    <div className="ctype"><Icon name={MSG_ICON[m.type] || 'mail'} size={16} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div className="title">{p?.name || 'Unknown'}</div>
                      <div className="meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{m.content}</div>
                    </div>
                    <div className="metric-pill"><b>{m.type[0].toUpperCase() + m.type.slice(1)}</b><span>{new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
                    <span />
                    <button className="btn btn-sm btn-icon"><Icon name="dots" size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h2>Audiences</h2></div>
          <div className="col" style={{ gap: 6 }}>
            {audiences.map(a => <Audience key={a.label} label={a.label} n={a.n} />)}
            {inactiveN > 0 && <Audience label="Inactive — needs follow-up" n={inactiveN} highlight />}
          </div>
          <div className="divider" />
          <div className="card-head"><h2>Archive</h2></div>
          <p className="mute" style={{ fontSize: 13 }}>{data.archiveCount} sent {data.archiveCount === 1 ? 'message' : 'messages'} in the archive.</p>
        </div>
      </div>

      {composeOpen && <ComposeModal audiences={audiences} onClose={() => setComposeOpen(false)} />}
    </div>
  );
}
