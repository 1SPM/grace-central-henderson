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
  Search
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
  { view: 'people', label: 'People', icon: <Users size={20} /> },
  { view: 'tasks', label: 'Follow-Ups', icon: <CheckSquare size={20} /> },
  { view: 'calendar', label: 'Calendar', icon: <Calendar size={20} /> },
  { view: 'groups', label: 'Groups', icon: <Users2 size={20} /> },
  { view: 'prayer', label: 'Prayer', icon: <Heart size={20} /> },
  { view: 'giving', label: 'Giving', icon: <DollarSign size={20} /> },
];

export function Layout({ currentView, setView, children, onOpenSearch }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenSearch?.();
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

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Church className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">GRACE</h1>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 tracking-wider hidden sm:block">
                GROWTH · RELATIONSHIPS · ATTENDANCE · COMMUNITY · ENGAGEMENT
              </p>
            </div>
          </div>
        </div>

        {/* Search button */}
        {onOpenSearch && (
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <button
              onClick={onOpenSearch}
              className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <Search size={18} />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="hidden sm:inline-flex text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                currentView === item.view
                  ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-all"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          <button
            onClick={() => handleNavClick('settings')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-all"
          >
            <Settings size={20} />
            Settings
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <Menu size={24} className="text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Church className="text-white" size={18} />
            </div>
            <span className="font-bold text-gray-900 dark:text-white">GRACE</span>
          </div>
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <Search size={24} className="text-gray-600 dark:text-gray-300" />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}
