import { useMemo, useState } from 'react';
import { Icon, type IconName } from './Icon';
import type { GraceData, GPerson } from './useGraceData';
import type { RedesignActions, InteractionType } from './actions';
import { PersonAvatar } from './PersonAvatar';
import { getLeaderByPersonId, isCentralStaffPerson } from '../../config/centralHendersonLeaders';

const INTER_ICON: Record<string, IconName> = { note: 'book', call: 'phone', email: 'mail', visit: 'user', text: 'chat', prayer: 'pray' };

const LOG_TYPES: { id: InteractionType; label: string }[] = [
  { id: 'note', label: 'Note' },
  { id: 'call', label: 'Call' },
  { id: 'email', label: 'Email' },
  { id: 'text', label: 'Text' },
  { id: 'visit', label: 'Visit' },
];

function LogComposer({ person, actions }: { person: GPerson; actions: RedesignActions }) {
  const [type, setType] = useState<InteractionType>('note');
  const [content, setContent] = useState('');
  const [isPrayer, setIsPrayer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function save() {
    if (!content.trim() || saving) return;
    setSaving(true);
    if (isPrayer) {
      await actions.addPrayer({ personId: person.id, content: content.trim(), isPrivate: false });
    } else {
      await actions.addInteraction({ personId: person.id, type, content: content.trim(), createdBy: 'Pastor' });
    }
    setContent(''); setSaving(false); setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  return (
    <div className="card" style={{ marginBottom: 'var(--gap, 18px)' }}>
      <div className="card-head"><h2>Log an interaction</h2>{done && <span className="badge badge-success dot">Saved</span>}</div>
      <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {LOG_TYPES.map(t => (
          <button key={t.id} className={`chip ${!isPrayer && type === t.id ? 'active' : ''}`} onClick={() => { setIsPrayer(false); setType(t.id); }}>{t.label}</button>
        ))}
        <button className={`chip ${isPrayer ? 'active' : ''}`} onClick={() => setIsPrayer(true)}><Icon name="pray" size={12} /> Prayer</button>
      </div>
      <textarea className="textarea" placeholder={isPrayer ? `Prayer request for ${person.firstName}…` : `What happened with ${person.firstName}?`} value={content} onChange={e => setContent(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={save} disabled={!content.trim() || saving}>{saving ? 'Saving…' : isPrayer ? 'Log prayer' : 'Log interaction'}</button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'inactive') return <span className="badge badge-muted dot">Inactive</span>;
  if (status === 'visitor') return <span className="badge badge-info dot">Visitor</span>;
  if (status === 'leader') return <span className="badge badge-warn dot">Leader</span>;
  return <span className="badge badge-success dot">{status === 'regular' ? 'Regular' : 'Member'}</span>;
}

function MemberDetail({ person, interactions, actions, onBack }: { person: GPerson; interactions: GraceData['interactions']; actions?: RedesignActions; onBack: () => void }) {
  const [tab, setTab] = useState<'overview' | 'groups' | 'contact'>('overview');
  const history = interactions.filter(i => i.personId === person.id).slice(0, 8);
  return (
    <div className="page">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 14 }}>
        <Icon name="arrow_left" size={14} /> Back to people
      </button>
      <div className="detail-head">
        <PersonAvatar name={person.name} initials={person.initials} size="xl" />
        <div className="meta">
          <h2>{person.name}</h2>
          <div className="role">{person.email || 'No email on file'}</div>
          <div className="tags">
            <StatusBadge status={person.status} />
            {person.groups.slice(0, 3).map(g => <span key={g} className="badge">{g}</span>)}
          </div>
        </div>
        <div className="actions">
          {isCentralStaffPerson(person.id) && getLeaderByPersonId(person.id) && (
            <a className="btn btn-sm" href={`#/leadership?leader=${getLeaderByPersonId(person.id)!.id}`}>
              Leadership
            </a>
          )}
          <button className="btn btn-sm"><Icon name="mail" size={13} /> Message</button>
          <button className="btn btn-sm"><Icon name="phone" size={13} /> Call</button>
        </div>
      </div>

      <div className="tabs">
        {(['overview', 'groups', 'contact'] as const).map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</div>
        ))}
      </div>

      {tab === 'overview' && actions && <LogComposer person={person} actions={actions} />}

      {tab === 'overview' && (
        <div className="card">
          <div className="card-head"><h2>Activity timeline</h2></div>
          {history.length === 0 ? <p className="mute" style={{ fontSize: 13 }}>No interactions logged for {person.firstName} yet.</p> : (
            <div className="timeline">
              {history.map(h => (
                <div key={h.id} className="timeline-item tone-indigo">
                  <div className="tdot"><Icon name={INTER_ICON[h.type] || 'book'} size={13} /></div>
                  <div className="ttext">
                    <div>{h.content}</div>
                    <div className="when">{new Date(h.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === 'groups' && (
        <div className="card">
          <div className="card-head"><h2>Groups</h2></div>
          {person.groups.length === 0 ? <p className="mute" style={{ fontSize: 13 }}>Not in any small groups.</p> : (
            <div className="col" style={{ gap: 6 }}>
              {person.groups.map(g => <div key={g} className="row"><Icon name="grid" size={14} className="mute" /><span style={{ fontSize: 13 }}>{g}</span></div>)}
            </div>
          )}
        </div>
      )}
      {tab === 'contact' && (
        <div className="card">
          <div className="card-head"><h2>Contact</h2></div>
          <div className="col" style={{ gap: 10 }}>
            <div className="row"><Icon name="mail" size={14} className="mute" /><span style={{ fontSize: 13 }}>{person.email || '—'}</span></div>
            <div className="row"><Icon name="phone" size={14} className="mute" /><span style={{ fontSize: 13 }}>{person.phone || '—'}</span></div>
            {person.joinDate && <div className="row"><Icon name="calendar" size={14} className="mute" /><span style={{ fontSize: 13 }}>Joined {new Date(person.joinDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function RedesignPeople({ data, actions, onAddPerson }: { data: GraceData; actions?: RedesignActions; onAddPerson?: () => void }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters = useMemo(() => [
    { id: 'all', label: 'All', n: data.people.length },
    { id: 'member', label: 'Members', n: data.people.filter(p => p.status === 'member' || p.status === 'regular').length },
    { id: 'visitor', label: 'Visitors', n: data.people.filter(p => p.status === 'visitor').length },
    { id: 'inactive', label: 'Inactive', n: data.people.filter(p => p.status === 'inactive').length },
    {
      id: 'leader',
      label: 'Leaders',
      n: data.people.filter(p => p.status === 'leader' && !isCentralStaffPerson(p.id)).length,
    },
    {
      id: 'central-staff',
      label: 'Central Staff',
      n: data.people.filter(p => isCentralStaffPerson(p.id)).length,
    },
  ], [data.people]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return data.people.filter(p => {
      if (filter === 'member' && !(p.status === 'member' || p.status === 'regular')) return false;
      if (filter === 'leader' && (p.status !== 'leader' || isCentralStaffPerson(p.id))) return false;
      if (filter === 'central-staff' && !isCentralStaffPerson(p.id)) return false;
      if (filter !== 'all' && filter !== 'member' && filter !== 'leader' && filter !== 'central-staff' && p.status !== filter) return false;
      if (query && !p.name.toLowerCase().includes(query) && !p.email.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [data.people, filter, q]);

  if (selectedId) {
    const person = data.people.find(p => p.id === selectedId);
    if (person) return <MemberDetail person={person} interactions={data.interactions} actions={actions} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="page">
      <div className="list-toolbar">
        <div className="chips">
          {filters.map(f => (
            <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}<span className="count">{f.n}</span>
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }} className="row">
          <div className="list-search">
            <Icon name="search" size={14} className="mute" />
            <input placeholder="Search people…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={onAddPerson}><Icon name="plus" size={14} /> Add person</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead><tr><th>Name</th><th>Status</th><th>Groups</th><th>Email</th></tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} onClick={() => setSelectedId(p.id)}>
                <td><div className="name"><PersonAvatar name={p.name} initials={p.initials} /><div>{p.name}</div></div></td>
                <td><StatusBadge status={p.status} /></td>
                <td className="mute" style={{ fontSize: 12 }}>{p.groups.slice(0, 2).join(', ')}{p.groups.length > 2 && ` +${p.groups.length - 2}`}</td>
                <td className="mute" style={{ fontSize: 12 }}>{p.email || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40 }} className="mute">No people match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
