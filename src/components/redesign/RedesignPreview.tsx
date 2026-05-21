/* Foundation preview for the GRACE redesign. Standalone route (/redesign),
   isolated under .grace-v2 — does not touch the existing app. Shows the
   ported shell + design tokens with a palette / sidebar switcher.
   No real screens yet (foundation pass). */
import { useState } from 'react';
import '../../styles/redesign.css';
import { Sidebar, Topbar, SHELL_TITLES } from './RedesignShell';
import { Icon } from './Icon';

type Palette = 'sanctuary' | 'chapel' | 'garden';
type SidebarMode = 'full' | 'rail' | 'floating';

const PALETTES: Palette[] = ['sanctuary', 'chapel', 'garden'];
const SIDEBARS: SidebarMode[] = ['full', 'rail', 'floating'];

function FoundationBody({ screen }: { screen: string }) {
  return (
    <div className="page">
      <div style={{ marginBottom: 22 }}>
        <p className="mute" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>
          Foundation preview
        </p>
        <h2 className="serif" style={{ fontSize: 40, margin: '6px 0 0', color: 'var(--ink)' }}>
          The design system is in place.
        </h2>
        <p className="mute" style={{ fontSize: 15, maxWidth: 560, marginTop: 8 }}>
          Fonts (Instrument Serif + Geist), the three palettes, and the sidebar shell are ported and
          isolated under <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>.grace-v2</code>.
          The existing app is untouched. Screens get built on top of this next.
        </p>
      </div>

      {/* token / primitive showcase so the foundation is visible */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--gap, 18px)' }}>
        <div className="card" style={{ padding: 'var(--pad-card, 22px)' }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="icon-chip tone-indigo"><Icon name="users" size={18} /></div>
            <strong>Buttons</strong>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button className="btn btn-primary"><Icon name="plus" size={14} /> Primary</button>
            <button className="btn">Secondary</button>
            <button className="btn btn-ghost">Ghost</button>
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--pad-card, 22px)' }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="icon-chip tone-rose"><Icon name="heart" size={18} /></div>
            <strong>Tones</strong>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {(['indigo', 'sky', 'emerald', 'amber', 'rose', 'violet'] as const).map(t => (
              <div key={t} className={`icon-chip tone-${t}`}><Icon name="star" size={16} /></div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--pad-card, 22px)' }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="icon-chip tone-emerald"><Icon name="book" size={18} /></div>
            <strong>Type</strong>
          </div>
          <p className="serif" style={{ fontSize: 26, margin: '0 0 4px' }}>Instrument Serif</p>
          <p style={{ margin: 0, fontSize: 14 }}>Geist — the UI sans.</p>
          <p className="mute" style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Geist Mono 012345</p>
        </div>
      </div>

      <p className="mute" style={{ fontSize: 13, marginTop: 24 }}>Active nav: <strong>{SHELL_TITLES[screen] || screen}</strong></p>
    </div>
  );
}

export function RedesignPreview() {
  const [palette, setPalette] = useState<Palette>('sanctuary');
  const [sidebar, setSidebar] = useState<SidebarMode>('full');
  const [screen, setScreen] = useState('dashboard');

  return (
    <div className="grace-v2" data-palette={palette} data-card="soft">
      {/* foundation switcher (preview-only chrome) */}
      <div style={{
        position: 'fixed', top: 12, right: 12, zIndex: 60,
        display: 'flex', gap: 12, alignItems: 'center',
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 999, padding: '6px 10px', boxShadow: 'var(--shadow-sm)',
        fontFamily: 'var(--font-ui)', fontSize: 12,
      }}>
        <div className="row" style={{ gap: 4 }}>
          <span className="mute">Palette</span>
          {PALETTES.map(p => (
            <button key={p} onClick={() => setPalette(p)}
              className={`btn btn-sm ${palette === p ? 'btn-primary' : ''}`} style={{ textTransform: 'capitalize' }}>
              {p}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 4 }}>
          <span className="mute">Sidebar</span>
          {SIDEBARS.map(s => (
            <button key={s} onClick={() => setSidebar(s)}
              className={`btn btn-sm ${sidebar === s ? 'btn-primary' : ''}`} style={{ textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="app" data-sidebar={sidebar}>
        <Sidebar active={screen} onNav={setScreen} />
        <div className="main">
          <Topbar title={SHELL_TITLES[screen] || screen} />
          <FoundationBody screen={screen} />
        </div>
      </div>
    </div>
  );
}
