import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  ListTodo,
  Users,
  Crown,
  DollarSign,
  Settings,
  Menu,
  Search,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  ChevronDown,
  Church,
  X,
  Smartphone,
  Heart,
  TrendingUp,
  MoreHorizontal,
  Sparkles,
  Wallet,
  Workflow,
  LogOut,
} from 'lucide-react';
import { View } from '../types';
import { TrialBanner } from './TrialBanner';
import { DemoEnvironmentBanner } from './DemoEnvironmentBanner';
import { NotificationCenter } from './NotificationCenter';
import { LiveClockDisplay } from './dashboard/ClockCalendarBanner';
import { TENANT_TIMEZONE, churchShortName } from '../config/tenant';
import { GraceOrb } from './grace/GraceOrb';
import { useGraceChat } from '../contexts/GraceChatContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useDecisionQueue } from '../hooks/useDecisionQueue';
import { navigateView } from '../lib/actionCenterNav';
import { resolveAddressee } from '../lib/greeting';

interface LayoutProps {
  currentView: View;
  setView: (view: View) => void;
  children: ReactNode;
  onOpenSearch?: () => void;
  isDemo?: boolean;
  churchId?: string;
  timezone?: string;
  churchName?: string;
  branding?: { primaryColor?: string; logoUrl?: string };
  /** Optional content injected into the sidebar above the footer (hidden when collapsed). */
  sidebarAddon?: ReactNode;
}

type Tone = 'indigo' | 'violet' | 'sky' | 'rose' | 'amber' | 'emerald';

interface NavSection {
  label?: string;
  items: { view: View; label: string; icon: ReactNode; tone: Tone }[];
}

// Single flat list — daily-driver views only. Everything else lives behind "More…"
const navSections: NavSection[] = [
  {
    label: 'Main',
    items: [
      { view: 'dashboard', label: 'Home', icon: <LayoutDashboard size={16} />, tone: 'indigo' },
      { view: 'workos', label: 'GRACE WorkOS', icon: <Workflow size={16} />, tone: 'violet' },
      { view: 'leadership', label: 'Leadership', icon: <Crown size={16} />, tone: 'violet' },
      { view: 'feed', label: 'Action Center', icon: <ListTodo size={16} />, tone: 'rose' },
      { view: 'people', label: 'Congregation', icon: <Users size={16} />, tone: 'sky' },
      { view: 'sunday-prep', label: 'Sunday Service Tools', icon: <Church size={16} />, tone: 'emerald' },
      { view: 'wallets', label: 'Impact Card Accounts', icon: <Wallet size={16} />, tone: 'indigo' },
      { view: 'giving', label: 'Impact Campaigns', icon: <DollarSign size={16} />, tone: 'emerald' },
      { view: 'pastoral-care', label: 'Pastoral Care', icon: <Heart size={16} />, tone: 'rose' },
      { view: 'discipleship-engagement', label: 'Growth & Engagement', icon: <TrendingUp size={16} />, tone: 'sky' },
    ],
  },
];

// Power-user views tucked behind "More…" to keep the primary nav clean.
// Every view is still reachable; just not promoted in daily-driver nav.
const moreItems: { view: View; label: string; icon: ReactNode }[] = [
  { view: 'grace-mobile', label: 'GRACE Mobile', icon: <Smartphone size={18} /> },
];

const givingSubViews = ['online-giving', 'batch-entry', 'pledges', 'campaigns', 'statements', 'charity-baskets', 'donation-tracker', 'member-stats'];
const peopleSubViews = ['person', 'groups', 'skills', 'families'];
const sundaySubViews = ['calendar', 'event-registration', 'attendance', 'announcements'];
const leadershipSubViews = ['grace', 'leader-management'];
const lifeServicesSubViews = ['wedding-services', 'funeral-services', 'estate-planning'];
const pastoralCareSubViews = ['life-services', ...lifeServicesSubViews];
const actionCenterSubViews = ['mail', 'tasks', 'birthdays', 'live-service', 'volunteers'];
const settingsSubViews = ['settings', 'forms', 'email-templates', 'reports', 'tags', 'analytics'];

// View labels for breadcrumbs
const viewLabels: Record<View, string> = {
  home: 'Home',
  dashboard: 'Home',
  feed: 'Action Center',
  pipeline: 'Pipeline',
  people: 'Congregation',
  person: 'Profile',
  tasks: 'Task List',
  attendance: 'Attendance',
  calendar: 'Calendar',
  birthdays: 'Birthdays',
  volunteers: 'Volunteers',
  groups: 'Groups',
  prayer: 'Prayer',
  giving: 'Impact Campaigns',
  'online-giving': 'Online Giving',
  'batch-entry': 'Batch Entry',
  pledges: 'Pledges',
  campaigns: 'Campaigns',
  statements: 'Statements',
  'charity-baskets': 'Charity Baskets',
  'donation-tracker': 'Donation Tracker',
  'member-stats': 'Member Stats',
  agents: 'Home',
  'follow-up-automation': 'Home',
  tags: 'Tags',
  reports: 'Reports',
  settings: 'Settings',
  'connect-card': 'Connect Card',
  directory: 'Directory',
  'child-checkin': 'Child Check-In',
  forms: 'Forms',
  'grace-mobile': 'GRACE Mobile',
  'sunday-prep': 'Sunday Service Tools',
  'live-service': 'Live Service',
  families: 'Families',
  skills: 'Skills & Talents',
  'email-templates': 'Email Templates',
  'event-registration': 'Event Registration',
  'reminders': 'Home',
  'planning-center-import': 'Home',
  'qr-checkin': 'QR Check-In',
  'pastoral-care': 'Pastoral Care',
  'life-services': 'Life Services',
  'wedding-services': 'Weddings',
  'funeral-services': 'Funerals',
  'estate-planning': 'Legacy Giving',
  'leader-management': 'Leader Management',
  analytics: 'Analytics',
  announcements: 'Announcements',
  'discipleship-engagement': 'Growth & Engagement',
  leadership: 'Leadership',
  grace: 'Leadership',
  mail: 'Mail',
  'financial-hub': 'Home',
  wallets: 'Impact Card Accounts',
  workos: 'GRACE WorkOS',
};

function adminRoleLabel(role?: string | null): string {
  if (role === 'pastor') return 'Admin · Pastor';
  if (role === 'admin') return 'Admin';
  if (role === 'staff') return 'Staff';
  return 'Signed in · Admin';
}

function AdminUserAvatar({ name, initials }: { name: string; initials: string }) {
  const [failed, setFailed] = useState(false);
  const cls = 'w-10 h-10 rounded-full ring-2 ring-rose-400 object-cover flex-shrink-0 bg-rose-50 flex items-center justify-center text-xs font-semibold text-rose-700';
  if (failed || !name.trim()) {
    return <div className={cls}>{initials}</div>;
  }
  const url = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,ffd5dc&radius=50`;
  return (
    <img
      className={cls}
      src={url}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function Layout({ currentView, setView, children, onOpenSearch, isDemo = false, churchId, timezone, churchName, branding, sidebarAddon }: LayoutProps) {
  const grace = useGraceChat();
  const { user, signOut } = useAuthContext();
  const { counts: decisionQueueCounts } = useDecisionQueue();
  const addressee = resolveAddressee(user?.firstName, user?.role);
  const displayChurch = churchShortName(churchName || 'Central Henderson Church');
  const avatarInitials = `${user?.firstName?.charAt(0) || 'P'}${user?.lastName?.charAt(0) || 'N'}`;
  const logoUrl = branding?.logoUrl;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [moreOpen, setMoreOpen] = useState(() => {
    // Auto-open when current view lives inside More…
    return moreItems.some(item => item.view === currentView);
  });

  // Save collapsed state
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenSearch?.();
      }
      // Toggle sidebar with Cmd/Ctrl + B
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenSearch]);

  // Close sidebar when view changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentView]);

  const handleNavClick = (view: View) => {
    navigateView(view, setView);
    setSidebarOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/sign-in';
  };

  const handleMoreToggle = () => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      setMoreOpen(true);
      return;
    }
    setMoreOpen(o => !o);
  };

  const isMoreItemActive = (view: View) => currentView === view;

  // Breadcrumb paths
  const getBreadcrumbs = () => {
    if (currentView === 'person') {
      return [
        { label: 'Congregation', view: 'people' as View },
        { label: 'Profile', view: currentView },
      ];
    }
    // Sub-pages under Giving
    if (givingSubViews.includes(currentView)) {
      return [
        { label: 'Impact Campaigns', view: 'giving' as View },
        { label: viewLabels[currentView], view: currentView },
      ];
    }
    // Sub-pages under Life Services
    if (lifeServicesSubViews.includes(currentView)) {
      return [
        { label: 'Pastoral Care', view: 'pastoral-care' as View },
        { label: 'Life Services', view: 'life-services' as View },
        { label: viewLabels[currentView], view: currentView },
      ];
    }
    if (currentView === 'life-services') {
      return [
        { label: 'Pastoral Care', view: 'pastoral-care' as View },
        { label: viewLabels[currentView], view: currentView },
      ];
    }
    // Sub-pages under Action Center
    if (actionCenterSubViews.includes(currentView)) {
      return [
        { label: 'Action Center', view: 'feed' as View },
        { label: viewLabels[currentView], view: currentView },
      ];
    }
    // Sub-pages under Sunday
    if (sundaySubViews.includes(currentView)) {
      return [
        { label: 'Sunday Service Tools', view: 'sunday-prep' as View },
        { label: viewLabels[currentView], view: currentView },
      ];
    }
    if (settingsSubViews.includes(currentView)) {
      return [{ label: 'Settings', view: 'settings' as View }];
    }
    return [{ label: viewLabels[currentView], view: currentView }];
  };

  const breadcrumbs = getBreadcrumbs();
  const moreActive = moreItems.some(item => isMoreItemActive(item.view));

  return (
    <div className="flex h-screen dark:bg-dark-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-white dark:bg-dark-900 flex flex-col transform transition-all duration-200 ease-out border-r border-stone-200 dark:border-white/5 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${sidebarCollapsed ? 'lg:w-16' : 'w-60'}`}
      >
        {/* Brand header — matches member portal: blue orb, centered church name */}
        <div className={`relative border-b border-gray-200/60 dark:border-white/5 ${sidebarCollapsed ? 'lg:px-2 px-4 py-3' : 'px-4 py-5'}`}>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-3 right-3 p-1.5 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg shrink-0 z-10"
          >
            <X size={18} className="text-gray-500" />
          </button>
          <div className={`flex flex-col items-center text-center ${sidebarCollapsed ? 'lg:gap-2' : 'gap-3'}`}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={displayChurch}
                className={`rounded-full object-cover flex-shrink-0 ${sidebarCollapsed ? 'w-10 h-10' : 'w-[72px] h-[72px]'}`}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  grace.openPanel();
                  setSidebarOpen(false);
                }}
                className="rounded-full flex-shrink-0 overflow-visible p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 hover:opacity-90 transition-opacity"
                title="Ask Grace"
                aria-label="Ask Grace"
              >
                <GraceOrb
                  size={sidebarCollapsed ? 'sm' : 'sb'}
                  rings
                />
              </button>
            )}
            <div className={`min-w-0 w-full ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-snug">
                {displayChurch}
              </h2>
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1 tracking-wide">
                My GRACE Admin Panel
              </p>
            </div>
          </div>
        </div>
        {/* Navigation */}
        <nav className={`flex-1 px-3 py-2 overflow-y-auto ${sidebarCollapsed ? 'lg:px-2' : ''}`} data-tutorial="sidebar-main-nav">
          {navSections.map((section, sectionIdx) => (
            <div key={sectionIdx} className={sectionIdx > 0 ? 'mt-4' : ''}>
              {section.label && !sidebarCollapsed && (
                <p className="px-2.5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-dark-500">
                  {section.label}
                </p>
              )}
              {section.label && sidebarCollapsed && (
                <div className="hidden lg:block mx-auto w-5 border-t border-gray-200 dark:border-dark-700 mb-1" />
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = currentView === item.view ||
                    (item.view === 'feed' && actionCenterSubViews.includes(currentView)) ||
                    (item.view === 'giving' && givingSubViews.includes(currentView)) ||
                    (item.view === 'people' && peopleSubViews.includes(currentView)) ||
                    (item.view === 'sunday-prep' && sundaySubViews.includes(currentView)) ||
                    (item.view === 'leadership' && leadershipSubViews.includes(currentView)) ||
                    (item.view === 'pastoral-care' && pastoralCareSubViews.includes(currentView));

                  return (
                    <button
                      key={item.view}
                      onClick={() => handleNavClick(item.view)}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13.5px] transition-colors group relative ${
                        sidebarCollapsed ? 'lg:justify-center' : ''
                      } ${
                        isActive
                          ? 'bg-gray-100/90 dark:bg-white/5 text-gray-900 dark:text-gray-100 font-medium'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-black/[0.03] dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                      aria-label={sidebarCollapsed ? item.label : undefined}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <span className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-colors ${
                        isActive ? 'bg-rose-500 text-white shadow-sm' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                      }`}>
                        {item.icon}
                      </span>
                      <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
                      {item.view === 'workos' && decisionQueueCounts.total > 0 && (
                        <span
                          className={`ml-auto text-[10.5px] px-1.5 py-0.5 rounded-full font-semibold ${sidebarCollapsed ? 'lg:hidden' : ''} ${
                            decisionQueueCounts.critical > 0
                              ? 'bg-rose-500 text-white'
                              : 'bg-gray-200 text-gray-700 dark:bg-dark-700 dark:text-dark-200'
                          }`}
                        >
                          {decisionQueueCounts.total}
                        </span>
                      )}

                      {/* Tooltip for collapsed state */}
                      {sidebarCollapsed && (
                        <span aria-hidden="true" className="hidden lg:group-hover:flex absolute left-full ml-2 px-2.5 py-1.5 bg-gray-900/95 dark:bg-gray-800/95 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg backdrop-blur-sm font-medium">
                          {item.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* More… — collapsible power-user views */}
          <div className="mt-4 relative group">
            <button
              onClick={handleMoreToggle}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm hover:bg-gray-100/80 dark:hover:bg-white/5 transition-colors ${
                sidebarCollapsed ? 'lg:justify-center' : ''
              } ${
                moreActive
                  ? 'bg-slate-50/80 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-medium'
                  : 'text-gray-500 dark:text-dark-400'
              }`}
              title={sidebarCollapsed ? 'Expand More views' : undefined}
              aria-label={sidebarCollapsed ? 'More views' : undefined}
              aria-expanded={moreOpen}
            >
              <MoreHorizontal size={18} className={moreActive ? 'text-slate-600 dark:text-slate-300' : 'text-gray-400'} />
              <span className={`flex-1 text-left ${sidebarCollapsed ? 'lg:hidden' : ''}`}>More</span>
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform ${moreOpen ? 'rotate-180' : ''} ${sidebarCollapsed ? 'lg:hidden' : ''}`}
              />
            </button>
            {sidebarCollapsed && (
              <span aria-hidden="true" className="hidden lg:group-hover:flex absolute left-full ml-2 px-2.5 py-1.5 bg-gray-900/95 dark:bg-gray-800/95 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg backdrop-blur-sm font-medium">
                Expand More views
              </span>
            )}
            {moreOpen && !sidebarCollapsed && (
              <div className="mt-1 space-y-0.5">
                {moreItems.map(item => {
                  const isActive = isMoreItemActive(item.view);
                  return (
                    <button
                      key={item.view}
                      onClick={() => handleNavClick(item.view)}
                      className={`w-full flex items-center gap-2.5 pl-5 pr-2.5 py-1.5 rounded-xl text-sm transition-all duration-200 ${
                        isActive
                          ? 'bg-slate-50/80 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 font-medium'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <span className={isActive ? 'text-slate-600 dark:text-slate-400' : 'text-gray-400 dark:text-gray-500'}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Sidebar addon slot */}
        {sidebarAddon && !sidebarCollapsed && (
          <div className="px-3 pb-2">
            {sidebarAddon}
          </div>
        )}
        {sidebarAddon && sidebarCollapsed && (
          <div className="hidden lg:flex px-2 pb-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="w-full flex items-center justify-center p-2 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group relative"
              title="Show setup checklist"
            >
              <Sparkles size={16} />
              <span aria-hidden="true" className="hidden group-hover:flex absolute left-full ml-2 px-2.5 py-1.5 bg-gray-900/95 dark:bg-gray-800/95 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg backdrop-blur-sm font-medium">
                Show setup checklist
              </span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className={`px-3 py-2 border-t border-gray-200/50 dark:border-white/5 space-y-0.5 ${sidebarCollapsed ? 'lg:px-2' : ''}`}>
          {/* Signed-in admin profile */}
          <div
            className={`mb-2 pb-2 border-b border-gray-200/50 dark:border-white/5 ${
              sidebarCollapsed ? 'lg:flex lg:justify-center lg:pb-2' : ''
            }`}
          >
            <div className={`flex items-center gap-2.5 ${sidebarCollapsed ? 'lg:justify-center' : 'px-1 py-1'}`}>
              <AdminUserAvatar name={addressee} initials={avatarInitials} />
              <div className={`min-w-0 flex-1 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{addressee}</p>
                <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {adminRoleLabel(user?.role)}
                </span>
              </div>
            </div>
          </div>

          {/* Collapse toggle - desktop only */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden lg:flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand (⌘B)' : 'Collapse (⌘B)'}
          >
            {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            <span className={sidebarCollapsed ? 'hidden' : ''}>Collapse</span>
          </button>

          <button
            onClick={() => handleNavClick('settings')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors group relative ${
              sidebarCollapsed ? 'lg:justify-center' : ''
            } ${
              settingsSubViews.includes(currentView)
                ? 'bg-gray-100/90 dark:bg-white/5 text-gray-900 dark:text-gray-100 font-medium'
                : 'text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800'
            }`}
            title={sidebarCollapsed ? 'Settings' : undefined}
            aria-label="Settings"
          >
            <Settings size={18} />
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Settings</span>
            {sidebarCollapsed && (
              <span aria-hidden="true" className="hidden lg:group-hover:flex absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-dark-700 text-white text-xs rounded-md whitespace-nowrap z-50 shadow-lg">
                Settings
              </span>
            )}
          </button>

          <button
            onClick={handleSignOut}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors group relative ${
              sidebarCollapsed ? 'lg:justify-center' : ''
            }`}
            title={sidebarCollapsed ? 'Sign out' : undefined}
            aria-label="Sign out"
          >
            <LogOut size={18} />
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Sign out</span>
            {sidebarCollapsed && (
              <span aria-hidden="true" className="hidden lg:group-hover:flex absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-dark-700 text-white text-xs rounded-md whitespace-nowrap z-50 shadow-lg">
                Sign out
              </span>
            )}
          </button>

          {/* Demo Mode indicator — only shown when in demo mode */}
          {isDemo && (
            <div className={`mt-2 pt-2 border-t border-gray-200/50 dark:border-white/5 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              <div className="px-2.5">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Demo Mode
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center h-12 px-4 border-b border-stone-300/60 dark:border-white/5">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 mr-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
          >
            <Menu size={20} className="text-gray-600 dark:text-dark-400" />
          </button>

          {/* Breadcrumbs — only show when nested (single-page crumbs are redundant) */}
          <nav className="flex items-center gap-1 text-sm flex-1">
            {breadcrumbs.length > 1 ? (
              breadcrumbs.map((crumb, index) => (
                <div key={crumb.view} className="flex items-center">
                  {index > 0 && (
                    <ChevronRight size={14} className="mx-1 text-gray-300 dark:text-dark-600" />
                  )}
                  <button
                    onClick={() => navigateView(crumb.view, setView)}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      index === breadcrumbs.length - 1
                        ? 'font-medium text-gray-900 dark:text-dark-100'
                        : 'text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-300'
                    }`}
                  >
                    {crumb.label}
                  </button>
                </div>
              ))
            ) : (
              <span className="px-1.5 font-medium text-gray-900 dark:text-dark-100">
                {breadcrumbs[0]?.label}
              </span>
            )}
          </nav>

          {/* Live clock + search */}
          <LiveClockDisplay timezone={timezone || TENANT_TIMEZONE} className="mr-2" />
          {onOpenSearch && (
            <>
              <button
                onClick={onOpenSearch}
                className="hidden lg:flex items-center gap-2 px-2.5 py-1 text-xs text-gray-500 dark:text-dark-400 hover:bg-stone-200/70 dark:hover:bg-dark-800 rounded-md transition-colors"
              >
                <Search size={13} />
                <span>Jump to…</span>
                <kbd className="ml-1 text-[10px] font-medium text-gray-400 dark:text-dark-500 bg-stone-100 dark:bg-dark-700 px-1.5 py-0.5 rounded">⌘K</kbd>
              </button>
              <button
                onClick={onOpenSearch}
                className="lg:hidden p-2 hover:bg-stone-200/70 dark:hover:bg-dark-800 rounded-lg"
              >
                <Search size={20} className="text-gray-500 dark:text-dark-400" />
              </button>
            </>
          )}

          {/* Live notification center (Supabase Realtime) */}
          <NotificationCenter churchId={churchId} onNavigate={(v) => navigateView(v, setView)} />
        </header>

        <DemoEnvironmentBanner />
        <TrialBanner />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
