import { ReactNode } from 'react';
import { DollarSign, Calendar, QrCode, ArrowLeft, Home, ShoppingBag, Heart, Shield } from 'lucide-react';
import type { MemberPortalTab } from '../../types';

interface MemberLayoutProps {
  children: ReactNode;
  activeTab: MemberPortalTab;
  onTabChange: (tab: MemberPortalTab) => void;
  onBack?: () => void;
  churchName?: string;
}

const tabs: { id: MemberPortalTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'shop', label: 'Shop', icon: ShoppingBag },
  { id: 'giving', label: 'Give', icon: DollarSign },
  { id: 'pastor-signup', label: 'Serve', icon: Heart },
  { id: 'legacy', label: 'Legacy', icon: Heart },
  { id: 'checkin', label: 'Check In', icon: QrCode },
  { id: 'my-ministry', label: 'Ministry', icon: Shield },
];

export function MemberLayout({
  children,
  activeTab,
  onTabChange,
  onBack,
  churchName = 'Grace Church'
}: MemberLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-dark-850 border-b border-gray-100 dark:border-dark-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-dark-400" />
          </button>
        )}
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">G</span>
          </div>
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-dark-100 text-sm leading-tight">
              {churchName}
            </h1>
            <p className="text-xs text-gray-500 dark:text-dark-400">Member Portal</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-dark-850 border-t border-gray-200 dark:border-dark-700 px-2 pb-safe z-50">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={`flex flex-col items-center py-2 px-4 min-w-[64px] transition-colors ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-400 dark:text-dark-500 hover:text-gray-600 dark:hover:text-dark-400'
                }`}
              >
                <Icon
                  size={22}
                  className={isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}
                />
                <span className={`text-[10px] mt-0.5 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
