import { useMemo, useState } from 'react';
import { Icon, type IconName } from './Icon';
import type { GraceData, GPerson } from './useGraceData';
import type { RedesignActions, SendChannel, SendResult } from './actions';

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

interface AudienceDef { label: string; members: GPerson[]; }
type SendPhase = 'compose' | 'confirm' | 'sending' | 'done';

function ComposeModal({ audiences, onSend, onClose }: { audiences: AudienceDef[]; onSend: RedesignActions['sendMessage']; onClose: () => void }) {
  const [channel, setChannel] = useState<SendChannel>('email');
  const [audienceLabel, setAudienceLabel] = useState(audiences[0]?.label ?? 'Whole church');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [phase, setPhase] = useState<SendPhase>('compose');
  const [result, setResult] = useState<SendResult | null>(null);

  const selected = audiences.find(a => a.label === audienceLabel) ?? audiences[0];
  // only people reachable on the chosen channel
  const reachable = useMemo(
    () => (selected?.members ?? []).filter(p => channel === 'email' ? !!p.email : !!p.phone),
    [selected, channel],
  );
  const unreachable = (selected?.members.length ?? 0) - reachable.length;
  const canSend = body.trim().length > 0 && reachable.length > 0 && (channel === 'sms' || subject.trim().length > 0);

  async function doSend() {
    setPhase('sending');
    const r = await onSend({ channel, recipientIds: reachable.map(p => p.id), subject: subject.trim() || undefined, body: body.trim() });
    setResult(r);
    setPhase('done');
  }

  return (
    <div className="modal-mask" onClick={phase === 'sending' ? undefined : onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {phase === 'done' && result ? (
          <>
            <h2>Sent</h2>
            <div className="sub">Your message went out.</div>
            <div className="row" style={{ gap: 18, margin: '14px 0' }}>
              <div><div className="serif" style={{ fontSize: 30 }}>{result.sent}</div><div className="mute" style={{ fontSize: 12 }}>delivered</div></div>
              {result.failed > 0 && <div><div className="serif" style={{ fontSize: 30, color: 'var(--c-rose-ink)' }}>{result.failed}</div><div className="mute" style={{ fontSize: 12 }}>failed</div></div>}
              {result.skipped > 0 && <div><div className="serif" style={{ fontSize: 30, color: 'var(--muted)' }}>{result.skipped}</div><div className="mute" style={{ fontSize: 12 }}>no {channel === 'email' ? 'email' : 'phone'}</div></div>}
            </div>
            <div className="modal-actions"><button className="btn btn-primary" onClick={onClose}>Done</button></div>
          </>
        ) : (
          <>
            <h2>New message</h2>
            <div className="sub">Reach your people via email or SMS — sends for real.</div>
            <div className="row" style={{ gap: 6, marginBottom: 14 }}>
              {(['email', 'sms'] as const).map(c => (
                <button key={c} className={`chip ${channel === c ? 'active' : ''}`} onClick={() => { setChannel(c); setPhase('compose'); }} disabled={phase === 'sending'}>
                  <Icon name={c === 'email' ? 'mail' : 'chat'} size={12} /> {c === 'email' ? 'Email' : 'SMS'}
                </button>
              ))}
            </div>
            <div className="field">
              <label>Send to</label>
              <select className="select" value={audienceLabel} onChange={e => { setAudienceLabel(e.target.value); setPhase('compose'); }} disabled={phase === 'sending'}>
                {audiences.map(a => <option key={a.label}>{a.label} ({a.members.length})</option>)}
              </select>
            </div>
            {channel === 'email' && <div className="field"><label>Subject</label><input className="input" placeholder="Sunday service update" value={subject} onChange={e => setSubject(e.target.value)} disabled={phase === 'sending'} /></div>}
            <div className="field"><label>Message</label><textarea className="textarea" placeholder="Grace and peace…" value={body} onChange={e => setBody(e.target.value)} disabled={phase === 'sending'} /></div>

            <div className="mute" style={{ fontSize: 12, marginBottom: 8 }}>
              Will send to <b style={{ color: 'var(--ink)' }}>{reachable.length}</b> {reachable.length === 1 ? 'person' : 'people'} with {channel === 'email' ? 'an email address' : 'a phone number'}
              {unreachable > 0 && <> · {unreachable} skipped (no {channel === 'email' ? 'email' : 'phone'})</>}
            </div>

            {phase === 'confirm' && (
              <div className="card" style={{ background: 'var(--c-amber-soft)', border: '1px solid color-mix(in oklab, var(--accent) 30%, transparent)', padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Send to {reachable.length} {reachable.length === 1 ? 'person' : 'people'} now?</div>
                <div className="mute" style={{ fontSize: 12, marginTop: 2 }}>This delivers real {channel === 'email' ? 'emails' : 'text messages'}.</div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose} disabled={phase === 'sending'}>Cancel</button>
              {phase === 'sending' ? (
                <button className="btn btn-primary" disabled>Sending…</button>
              ) : phase === 'confirm' ? (
                <button className="btn btn-primary" onClick={doSend}><Icon name="check" size={13} /> Confirm send</button>
              ) : (
                <button className="btn btn-primary" onClick={() => setPhase('confirm')} disabled={!canSend}><Icon name="sparkle" size={13} /> Send</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const MSG_ICON: Record<string, IconName> = { email: 'mail', text: 'chat', call: 'phone' };

export function RedesignEngagement({ data, actions }: { data: GraceData; actions?: RedesignActions }) {
  const [composeOpen, setComposeOpen] = useState(false);
  const personById = useMemo(() => new Map(data.people.map(p => [p.id, p])), [data.people]);

  const emails = data.interactions.filter(i => i.type === 'email').length;
  const texts = data.interactions.filter(i => i.type === 'text').length;
  const calls = data.interactions.filter(i => i.type === 'call').length;
  const recentMsgs = data.interactions.filter(i => i.type === 'email' || i.type === 'text' || i.type === 'call').slice(0, 6);

  const audienceDefs: AudienceDef[] = [
    { label: 'Whole church', members: data.people },
    { label: 'Members', members: data.people.filter(p => p.status === 'member' || p.status === 'regular') },
    { label: 'Visitors', members: data.people.filter(p => p.status === 'visitor') },
    { label: 'Leaders', members: data.people.filter(p => p.status === 'leader') },
    { label: 'Inactive', members: data.people.filter(p => p.status === 'inactive') },
  ].filter(a => a.members.length > 0);
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
          {actions && <button className="btn btn-primary" onClick={() => setComposeOpen(true)}><Icon name="plus" size={14} /> New message</button>}
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
            {audienceDefs.filter(a => a.label !== 'Inactive').map(a => <Audience key={a.label} label={a.label} n={a.members.length} />)}
            {inactiveN > 0 && <Audience label="Inactive — needs follow-up" n={inactiveN} highlight />}
          </div>
          <div className="divider" />
          <div className="card-head"><h2>Archive</h2></div>
          <p className="mute" style={{ fontSize: 13 }}>{data.archiveCount} sent {data.archiveCount === 1 ? 'message' : 'messages'} in the archive.</p>
        </div>
      </div>

      {composeOpen && actions && <ComposeModal audiences={audienceDefs} onSend={actions.sendMessage} onClose={() => setComposeOpen(false)} />}
    </div>
  );
}
