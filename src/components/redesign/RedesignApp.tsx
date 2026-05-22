/* In-app (authed) version of the redesign — the live landing at /.
   Consumes the real, church-scoped app data and renders the redesign
   screens. A "Classic" action jumps to the full existing app so no
   feature is lost. Isolated under .grace-v2. */
import { useState } from 'react';
import '../../styles/redesign.css';
import { Sidebar, Topbar, SHELL_TITLES } from './RedesignShell';
import { Icon } from './Icon';
import { DashboardView } from './RedesignDashboard';
import { dashboardFromGraceData } from './useRedesignDashboard';
import type { GraceData } from './useGraceData';
import type { RedesignActions } from './actions';
import { RedesignPeople } from './RedesignPeople';
import { RedesignAttendance, RedesignReports } from './RedesignAnalytics';
import { RedesignEngagement } from './RedesignEngagement';
import { RedesignAskGrace } from './RedesignAskGrace';
import { RedesignGroups, RedesignEvents, RedesignGiving, RedesignPlaceholder } from './RedesignMisc';

export function RedesignApp({ data, actions, onAddPerson, onOpenClassic }: {
  data: GraceData;
  actions: RedesignActions;
  onAddPerson: () => void;
  onOpenClassic: () => void;
}) {
  const [screen, setScreen] = useState('dashboard');

  let body: React.ReactNode;
  switch (screen) {
    case 'dashboard': body = <DashboardView d={dashboardFromGraceData(data)} onAddPerson={onAddPerson} />; break;
    case 'members': body = <RedesignPeople data={data} actions={actions} onAddPerson={onAddPerson} />; break;
    case 'attendance': body = <RedesignAttendance data={data} actions={actions} />; break;
    case 'engagement': body = <RedesignEngagement data={data} actions={actions} />; break;
    case 'reports': body = <RedesignReports data={data} />; break;
    case 'ai': body = <RedesignAskGrace data={data} />; break;
    case 'groups': body = <RedesignGroups data={data} />; break;
    case 'events': body = <RedesignEvents data={data} actions={actions} />; break;
    case 'giving': body = <RedesignGiving data={data} />; break;
    default: body = <RedesignPlaceholder title={SHELL_TITLES[screen] || screen} icon="settings" />;
  }

  return (
    <div className="grace-v2" data-palette="sanctuary" data-card="soft">
      <div className="app" data-sidebar="full">
        <Sidebar active={screen} onNav={setScreen} />
        <div className="main">
          <Topbar
            title={SHELL_TITLES[screen] || screen}
            action={<button className="btn" onClick={onOpenClassic}><Icon name="grid" size={14} /> Classic view</button>}
          />
          {body}
        </div>
      </div>
    </div>
  );
}
