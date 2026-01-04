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
  Sun
} from 'lucide-react';
import { View } from '../types';
import { useTheme } from '../ThemeContext';

interface LayoutProps {
  currentView: View;
  setView: (view: View) => void;
  children: ReactNode;
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

export function Layout({ currentView, setView, children }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Church className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">GRACE</h1>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 tracking-wider">GROWTH · RELATIONSHIPS · ATTENDANCE · COMMUNITY · ENGAGEMENT</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
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
            onClick={() => setView('settings')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-all"
          >
            <Settings size={20} />
            Settings
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        {children}
      </main>
    </div>
  );
}
