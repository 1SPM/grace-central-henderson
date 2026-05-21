/* Preview for the GRACE redesign at /redesign. Isolated under .grace-v2 —
   does not touch the existing app. Full shell + all screens wired to live
   Supabase data (read-only via the anon client), with a palette/sidebar switcher. */
import { useState } from 'react';
import '../../styles/redesign.css';
import { Sidebar, Topbar, SHELL_TITLES } from './RedesignShell';
import { RedesignDashboard } from './RedesignDashboard';
import { useGraceData } from './useGraceData';
import { RedesignPeople } from './RedesignPeople';
import { RedesignAttendance, RedesignReports } from './RedesignAnalytics';
import { RedesignEngagement } from './RedesignEngagement';
import { RedesignAskGrace } from './RedesignAskGrace';
import { RedesignGroups, RedesignEvents, RedesignGiving, RedesignPlaceholder } from './RedesignMisc';

type Palette = 'sanctuary' | 'chapel' | 'garden';
type SidebarMode = 'full' | 'rail' | 'floating';

const PALETTES: Palette[] = ['sanctuary', 'chapel', 'garden'];
const SIDEBARS: SidebarMode[] = ['full', 'rail', 'floating'];

function DataScreen({ screen }: { screen: string }) {
  const { data, status } = useGraceData();

  if (status === 'loading') {
    return <div className="page"><div style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
      <div style={{ width: 28, height: 28, borderRadius: 999, border: '2px solid var(--line)', borderBottomColor: 'var(--primary)', animation: 'gv2-spin 0.7s linear infinite' }} />
    </div></div>;
  }
  if (status === 'error' || !data) {
    return <div className="page"><p className="mute">Couldn't load data. Check the connection and refresh.</p></div>;
  }

  switch (screen) {
    case 'members': return <RedesignPeople data={data} />;
    case 'attendance': return <RedesignAttendance data={data} />;
    case 'engagement': return <RedesignEngagement data={data} />;
    case 'reports': return <RedesignReports data={data} />;
    case 'ai': return <RedesignAskGrace data={data} />;
    case 'groups': return <RedesignGroups data={data} />;
    case 'events': return <RedesignEvents data={data} />;
    case 'giving': return <RedesignGiving data={data} />;
    case 'settings': return <RedesignPlaceholder title="Settings" icon="settings" />;
    default: return <RedesignPlaceholder title={SHELL_TITLES[screen] || screen} icon="grid" />;
  }
}

export function RedesignPreview() {
  const [palette, setPalette] = useState<Palette>('sanctuary');
  const [sidebar, setSidebar] = useState<SidebarMode>('full');
  const [screen, setScreen] = useState('dashboard');

  return (
    <div className="grace-v2" data-palette={palette} data-card="soft">
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
            <button key={p} onClick={() => setPalette(p)} className={`btn btn-sm ${palette === p ? 'btn-primary' : ''}`} style={{ textTransform: 'capitalize' }}>{p}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 4 }}>
          <span className="mute">Sidebar</span>
          {SIDEBARS.map(s => (
            <button key={s} onClick={() => setSidebar(s)} className={`btn btn-sm ${sidebar === s ? 'btn-primary' : ''}`} style={{ textTransform: 'capitalize' }}>{s}</button>
          ))}
        </div>
      </div>

      <div className="app" data-sidebar={sidebar}>
        <Sidebar active={screen} onNav={setScreen} />
        <div className="main">
          <Topbar title={SHELL_TITLES[screen] || screen} />
          {screen === 'dashboard' ? <RedesignDashboard /> : <DataScreen screen={screen} />}
        </div>
      </div>
    </div>
  );
}
