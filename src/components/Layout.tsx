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
  Church,
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
  Cake
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
  { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { view: 'pipeline', label: 'Pipeline', icon: <TrendingUp size={20} /> },
  { view: 'people', label: 'People', icon: <Users size={20} /> },
  { view: 'tasks', label: 'Follow-Ups', icon: <CheckSquare size={20} /> },
  { view: 'attendance', label: 'Attendance', icon: <UserCheck size={20} /> },
  { view: 'calendar', label: 'Calendar', icon: <Calendar size={20} /> },
  { view: 'birthdays', label: 'Birthdays', icon: <Cake size={20} /> },
  { view: 'volunteers', label: 'Volunteers', icon: <ClipboardList size={20} /> },
  { view: 'groups', label: 'Groups', icon: <Users2 size={20} /> },
  { view: 'prayer', label: 'Prayer', icon: <Heart size={20} /> },
  { view: 'giving', label: 'Giving', icon: <DollarSign size={20} /> },
  { view: 'tags', label: 'Tags', icon: <Tag size={20} /> },
  { view: 'reports', label: 'Reports', icon: <FileText size={20} /> },
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
  tags: 'Tags',
  reports: 'Reports',
  settings: 'Settings',
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
    return [{ label: viewLabels[currentView], view: currentView }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-white dark:bg-dark-850 border-r border-gray-200 dark:border-dark-700 flex flex-col transform transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${sidebarCollapsed ? 'lg:w-[72px]' : 'w-64'}`}
      >
        {/* Logo */}
        <div className={`p-4 border-b border-gray-100 dark:border-dark-700 ${sidebarCollapsed ? 'lg:px-3' : 'p-6'}`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'lg:justify-center' : 'gap-3'}`}>
            <div className={`bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 ${sidebarCollapsed ? 'w-10 h-10' : 'w-10 h-10'}`}>
              <Church className="text-white" size={22} />
            </div>
            <div className={sidebarCollapsed ? 'lg:hidden' : ''}>
              <h1 className="text-xl font-bold text-gray-900 dark:text-dark-100">GRACE</h1>
              <p className="text-[10px] text-gray-400 dark:text-dark-500 tracking-wider hidden sm:block">
                CHURCH CRM
              </p>
            </div>
          </div>
        </div>

        {/* Search button */}
        {onOpenSearch && (
          <div className={`p-4 border-b border-gray-100 dark:border-dark-700 ${sidebarCollapsed ? 'lg:p-2' : ''}`}>
            <button
              onClick={onOpenSearch}
              className={`w-full flex items-center gap-3 bg-gray-50 dark:bg-dark-800 rounded-xl text-sm text-gray-500 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors ${
                sidebarCollapsed ? 'lg:justify-center lg:p-2.5 lg:px-2.5 px-4 py-2.5' : 'px-4 py-2.5'
              }`}
              title={sidebarCollapsed ? 'Search (⌘K)' : undefined}
            >
              <Search size={18} />
              <span className={`flex-1 text-left ${sidebarCollapsed ? 'lg:hidden' : ''}`}>Search...</span>
              <kbd className={`text-xs bg-gray-200 dark:bg-dark-700 px-1.5 py-0.5 rounded ${sidebarCollapsed ? 'lg:hidden' : 'hidden sm:inline-flex'}`}>
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className={`flex-1 p-4 space-y-1 overflow-y-auto ${sidebarCollapsed ? 'lg:p-2' : ''}`}>
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view)}
              className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all group relative ${
                sidebarCollapsed ? 'lg:justify-center lg:px-2.5 lg:py-2.5 px-4 py-2.5' : 'px-4 py-2.5'
              } ${
                currentView === item.view
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-dark-100'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              {item.icon}
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>

              {/* Tooltip for collapsed state */}
              {sidebarCollapsed && (
                <span className="hidden lg:group-hover:flex absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-dark-700 text-white text-xs rounded whitespace-nowrap z-50">
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className={`p-4 border-t border-gray-100 dark:border-dark-700 space-y-1 ${sidebarCollapsed ? 'lg:p-2' : ''}`}>
          {/* Collapse toggle - desktop only */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden lg:flex w-full items-center gap-3 rounded-lg text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-dark-100 transition-all ${
              sidebarCollapsed ? 'justify-center px-2.5 py-2.5' : 'px-4 py-2.5'
            }`}
            title={sidebarCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
          >
            {sidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
            <span className={sidebarCollapsed ? 'hidden' : ''}>Collapse</span>
          </button>

          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-dark-100 transition-all group relative ${
              sidebarCollapsed ? 'lg:justify-center lg:px-2.5 lg:py-2.5 px-4 py-2.5' : 'px-4 py-2.5'
            }`}
            title={sidebarCollapsed ? (theme === 'light' ? 'Dark Mode' : 'Light Mode') : undefined}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            {sidebarCollapsed && (
              <span className="hidden lg:group-hover:flex absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-dark-700 text-white text-xs rounded whitespace-nowrap z-50">
                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </span>
            )}
          </button>

          <button
            onClick={() => handleNavClick('settings')}
            className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 hover:text-gray-900 dark:hover:text-dark-100 transition-all group relative ${
              sidebarCollapsed ? 'lg:justify-center lg:px-2.5 lg:py-2.5 px-4 py-2.5' : 'px-4 py-2.5'
            }`}
            title={sidebarCollapsed ? 'Settings' : undefined}
          >
            <Settings size={20} />
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Settings</span>
            {sidebarCollapsed && (
              <span className="hidden lg:group-hover:flex absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-dark-700 text-white text-xs rounded whitespace-nowrap z-50">
                Settings
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with breadcrumbs */}
        <header className="flex items-center justify-between p-4 bg-white dark:bg-dark-850 border-b border-gray-200 dark:border-dark-700">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg mr-2"
          >
            <Menu size={24} className="text-gray-600 dark:text-dark-300" />
          </button>

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-sm flex-1">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.view} className="flex items-center">
                {index > 0 && (
                  <ChevronRight size={14} className="mx-1 text-gray-400 dark:text-dark-500" />
                )}
                <button
                  onClick={() => setView(crumb.view)}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    index === breadcrumbs.length - 1
                      ? 'font-medium text-gray-900 dark:text-dark-100'
                      : 'text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800'
                  }`}
                >
                  {crumb.label}
                </button>
              </div>
            ))}
          </nav>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Church className="text-white" size={18} />
            </div>
          </div>

          {/* Mobile search */}
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg ml-2"
            >
              <Search size={24} className="text-gray-600 dark:text-dark-300" />
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
