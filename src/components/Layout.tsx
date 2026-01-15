import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Calendar,
  Users2,
  Heart,
  DollarSign,
  Settings,
  Moon,
  Sun,
  Menu,
  Search,
  TrendingUp,
  UserCheck,
  ClipboardList,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  Tag,
  FileText,
  Cake,
  X,
  Bot,
  QrCode,
  Contact,
} from 'lucide-react';
import { View } from '../types';
import { useTheme } from '../ThemeContext';

interface LayoutProps {
  currentView: View;
  setView: (view: View) => void;
  children: ReactNode;
  onOpenSearch?: () => void;
}

const navItems: { view: View; label: string; icon: ReactNode }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { view: 'pipeline', label: 'Pipeline', icon: <TrendingUp size={18} /> },
  { view: 'people', label: 'People', icon: <Users size={18} /> },
  { view: 'tasks', label: 'Follow-Ups', icon: <CheckSquare size={18} /> },
  { view: 'attendance', label: 'Attendance', icon: <UserCheck size={18} /> },
  { view: 'calendar', label: 'Calendar', icon: <Calendar size={18} /> },
  { view: 'birthdays', label: 'Birthdays', icon: <Cake size={18} /> },
  { view: 'volunteers', label: 'Volunteers', icon: <ClipboardList size={18} /> },
  { view: 'groups', label: 'Groups', icon: <Users2 size={18} /> },
  { view: 'prayer', label: 'Prayer', icon: <Heart size={18} /> },
  { view: 'giving', label: 'Giving', icon: <DollarSign size={18} /> },
  { view: 'agents', label: 'AI Agents', icon: <Bot size={18} /> },
  { view: 'tags', label: 'Tags', icon: <Tag size={18} /> },
  { view: 'reports', label: 'Reports', icon: <FileText size={18} /> },
  { view: 'directory', label: 'Directory', icon: <Contact size={18} /> },
  { view: 'connect-card', label: 'Connect Card', icon: <QrCode size={18} /> },
];

// View labels for breadcrumbs
const viewLabels: Record<View, string> = {
  dashboard: 'Dashboard',
  pipeline: 'Pipeline',
  people: 'People',
  person: 'Profile',
  tasks: 'Follow-Ups',
  attendance: 'Attendance',
  calendar: 'Calendar',
  birthdays: 'Birthdays',
  volunteers: 'Volunteers',
  groups: 'Groups',
  prayer: 'Prayer',
  giving: 'Giving',
  'online-giving': 'Online Giving',
  'batch-entry': 'Batch Entry',
  pledges: 'Pledges',
  campaigns: 'Campaigns',
  statements: 'Statements',
  'charity-baskets': 'Charity Baskets',
  'donation-tracker': 'Donation Tracker',
  'member-stats': 'Member Stats',
  agents: 'AI Agents',
  tags: 'Tags',
  reports: 'Reports',
  settings: 'Settings',
  'connect-card': 'Connect Card',
  directory: 'Directory',
};

export function Layout({ currentView, setView, children, onOpenSearch }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
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
    setView(view);
    setSidebarOpen(false);
  };

  // Breadcrumb paths
  const getBreadcrumbs = () => {
    if (currentView === 'person') {
      return [
        { label: 'People', view: 'people' as View },
        { label: 'Profile', view: currentView },
      ];
    }
    // Sub-pages under Giving
    const givingSubViews = ['online-giving', 'batch-entry', 'pledges', 'campaigns', 'statements', 'charity-baskets', 'donation-tracker', 'member-stats'];
    if (givingSubViews.includes(currentView)) {
      return [
        { label: 'Giving', view: 'giving' as View },
        { label: viewLabels[currentView], view: currentView },
      ];
    }
    return [{ label: viewLabels[currentView], view: currentView }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-white dark:bg-dark-850 flex flex-col transform transition-all duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${sidebarCollapsed ? 'lg:w-16' : 'w-60'}`}
        style={{ boxShadow: '1px 0 0 0 rgba(0,0,0,0.05)' }}
      >
        {/* Logo */}
        <div className={`flex items-center h-14 border-b border-gray-100 dark:border-dark-700 ${sidebarCollapsed ? 'lg:justify-center lg:px-0 px-4' : 'px-4'}`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'lg:justify-center' : 'gap-2.5'}`}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <span className={`font-semibold text-gray-900 dark:text-dark-100 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              Grace
            </span>
          </div>
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden ml-auto p-1.5 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Search */}
        {onOpenSearch && (
          <div className={`px-3 py-2 ${sidebarCollapsed ? 'lg:px-2' : ''}`}>
            <button
              onClick={onOpenSearch}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-500 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors ${
                sidebarCollapsed ? 'lg:justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Search (⌘K)' : undefined}
            >
              <Search size={16} />
              <span className={`flex-1 text-left ${sidebarCollapsed ? 'lg:hidden' : ''}`}>Search</span>
              <kbd className={`text-[10px] font-medium text-gray-400 dark:text-dark-500 bg-gray-100 dark:bg-dark-700 px-1.5 py-0.5 rounded ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className={`flex-1 px-3 py-2 space-y-0.5 overflow-y-auto ${sidebarCollapsed ? 'lg:px-2' : ''}`}>
          {navItems.map((item) => {
            const isActive = currentView === item.view ||
              (item.view === 'giving' && ['online-giving', 'batch-entry', 'pledges', 'campaigns', 'statements', 'charity-baskets', 'donation-tracker', 'member-stats'].includes(currentView)) ||
              (item.view === 'people' && currentView === 'person');

            return (
              <button
                key={item.view}
                onClick={() => handleNavClick(item.view)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors group relative ${
                  sidebarCollapsed ? 'lg:justify-center' : ''
                } ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium'
                    : 'text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-dark-200'
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-dark-500 group-hover:text-gray-600 dark:group-hover:text-dark-400'}>
                  {item.icon}
                </span>
                <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>

                {/* Tooltip for collapsed state */}
                {sidebarCollapsed && (
                  <span className="hidden lg:group-hover:flex absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-dark-700 text-white text-xs rounded-md whitespace-nowrap z-50 shadow-lg">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`px-3 py-2 border-t border-gray-100 dark:border-dark-700 space-y-0.5 ${sidebarCollapsed ? 'lg:px-2' : ''}`}>
          {/* Collapse toggle - desktop only */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden lg:flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
            title={sidebarCollapsed ? 'Expand (⌘B)' : 'Collapse (⌘B)'}
          >
            {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            <span className={sidebarCollapsed ? 'hidden' : ''}>Collapse</span>
          </button>

          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors group relative ${
              sidebarCollapsed ? 'lg:justify-center' : ''
            }`}
            title={sidebarCollapsed ? (theme === 'light' ? 'Dark mode' : 'Light mode') : undefined}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
            {sidebarCollapsed && (
              <span className="hidden lg:group-hover:flex absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-dark-700 text-white text-xs rounded-md whitespace-nowrap z-50 shadow-lg">
                {theme === 'light' ? 'Dark mode' : 'Light mode'}
              </span>
            )}
          </button>

          <button
            onClick={() => handleNavClick('settings')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors group relative ${
              sidebarCollapsed ? 'lg:justify-center' : ''
            }`}
            title={sidebarCollapsed ? 'Settings' : undefined}
          >
            <Settings size={18} />
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Settings</span>
            {sidebarCollapsed && (
              <span className="hidden lg:group-hover:flex absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-dark-700 text-white text-xs rounded-md whitespace-nowrap z-50 shadow-lg">
                Settings
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center h-14 px-4 bg-white dark:bg-dark-850 border-b border-gray-100 dark:border-dark-700">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 mr-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
          >
            <Menu size={20} className="text-gray-600 dark:text-dark-400" />
          </button>

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-sm flex-1">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.view} className="flex items-center">
                {index > 0 && (
                  <ChevronRight size={14} className="mx-1 text-gray-300 dark:text-dark-600" />
                )}
                <button
                  onClick={() => setView(crumb.view)}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    index === breadcrumbs.length - 1
                      ? 'font-medium text-gray-900 dark:text-dark-100'
                      : 'text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-300'
                  }`}
                >
                  {crumb.label}
                </button>
              </div>
            ))}
          </nav>

          {/* Mobile search */}
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
            >
              <Search size={20} className="text-gray-500 dark:text-dark-400" />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-dark-900">
          {children}
        </main>
      </div>
    </div>
  );
}
