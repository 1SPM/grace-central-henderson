/* Ported sidebar + topbar shell from the redesign prototype. */
import { Icon, type IconName } from './Icon';
import { LiveClockDisplay } from '../dashboard/ClockCalendarBanner';

type Tone = 'indigo' | 'ai' | 'sky' | 'emerald' | 'rose' | 'amber' | 'violet';
interface NavItem { id: string; label: string; icon: IconName; tone: Tone; count?: number; }

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home', tone: 'indigo' },
  { id: 'ai', label: 'AI Clergy', icon: 'sparkle', tone: 'ai' },
  { id: 'members', label: 'People', icon: 'users', tone: 'sky', count: 312 },
  { id: 'attendance', label: 'Attendance', icon: 'check', tone: 'emerald' },
  { id: 'engagement', label: 'Engagement', icon: 'chat', tone: 'rose', count: 5 },
  { id: 'reports', label: 'Reports', icon: 'chart', tone: 'amber' },
];
const NAV_2: NavItem[] = [
  { id: 'events', label: 'Events', icon: 'calendar', tone: 'violet' },
  { id: 'groups', label: 'Groups', icon: 'grid', tone: 'sky' },
  { id: 'giving', label: 'Giving', icon: 'dollar', tone: 'emerald' },
  { id: 'settings', label: 'Settings', icon: 'settings', tone: 'indigo' },
];

function NavList({ items, active, onNav }: { items: NavItem[]; active: string; onNav: (id: string) => void }) {
  return (
    <>
      {items.map(item => (
        <div
          key={item.id}
          className={`nav-item tone-${item.tone} ${active === item.id ? 'active' : ''}`}
          onClick={() => onNav(item.id)}
          title={item.label}
        >
          <div className="nav-icon"><Icon name={item.icon} size={15} /></div>
          <span className="label">{item.label}</span>
          {item.count != null && <span className="count">{item.count}</span>}
        </div>
      ))}
    </>
  );
}

export function Sidebar({ active, onNav, brandName = 'GRACE' }: { active: string; onNav: (id: string) => void; brandName?: string; timezone?: string }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">{brandName.charAt(0).toUpperCase()}</div>
        <div className="brand-name">{brandName.toUpperCase()}</div>
      </div>

      <div className="nav-section">
        <div className="nav-label">Main</div>
        <NavList items={NAV} active={active} onNav={onNav} />
      </div>

      <div className="nav-section">
        <div className="nav-label">Workspace</div>
        <NavList items={NAV_2} active={active} onNav={onNav} />
      </div>

      <div className="side-foot">
        <div className="side-user">
          <div className="avatar sm">PT</div>
          <div className="side-user-text" style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>Pastor Thomas</div>
            <div className="mute" style={{ fontSize: 11 }}>Admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function Topbar({ title, action, timezone }: { title: string; action?: React.ReactNode; timezone?: string }) {
  return (
    <div className="topbar">
      <h1>{title}</h1>
      <div style={{ marginLeft: 'auto' }} className="row">
        <LiveClockDisplay variant="redesign" timezone={timezone} />
        <div className="search-box">
          <Icon name="search" size={14} />
          <span>Search people, events, messages…</span>
          <kbd>⌘ K</kbd>
        </div>
        <button className="btn btn-icon" title="Notifications"><Icon name="bell" size={16} /></button>
        {action}
      </div>
    </div>
  );
}

export const SHELL_TITLES: Record<string, string> = {
  dashboard: 'Home', members: 'People', attendance: 'Attendance', engagement: 'Engagement',
  reports: 'Reports', ai: 'AI Clergy', events: 'Events', groups: 'Groups', giving: 'Giving', settings: 'Settings',
};
