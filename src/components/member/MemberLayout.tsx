import { ReactNode } from 'react';
import { DollarSign, Calendar, ArrowLeft, Home, Heart, ScanLine, Users } from 'lucide-react';
import type { MemberPortalTab, LeaderProfile } from '../../types';
import { PastoralStories } from './PastoralStories';

interface MemberLayoutProps {
  children: ReactNode;
  activeTab: MemberPortalTab;
  onTabChange: (tab: MemberPortalTab, leaderId?: string) => void;
  onBack?: () => void;
  churchName?: string;
  /** Signed-in member's first name — shown in the header when present. */
  memberName?: string;
  /** White-label branding from church settings. */
  branding?: { primaryColor?: string; logoUrl?: string };
  leaders?: LeaderProfile[];
}

const tabs: { id: MemberPortalTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'connect', label: 'Connect', icon: Users },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'scan', label: 'Scan', icon: ScanLine },
  { id: 'care', label: 'Care', icon: Heart },
  { id: 'giving', label: 'Give', icon: DollarSign },
];

const DEFAULT_PRIMARY = '#4f46e5'; // indigo-600

export function MemberLayout({
  children,
  activeTab,
  onTabChange,
  onBack,
  churchName = 'Grace Church',
  memberName,
  branding,
  leaders,
}: MemberLayoutProps) {
  const primaryColor = branding?.primaryColor || DEFAULT_PRIMARY;
  const logoUrl = branding?.logoUrl;

  return (
    <div className="h-full bg-gray-50 dark:bg-dark-900 flex flex-col relative overflow-hidden">
      {/* Header */}
      <header className="bg-stone-100 dark:bg-dark-850 border-b border-gray-100 dark:border-dark-700 px-4 py-3 flex items-center gap-3 flex-shrink-0 z-40">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-dark-400" />
          </button>
        )}
        <div className="flex items-center gap-2.5 flex-1">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={churchName}
              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <span className="text-white font-bold text-sm">
                {churchName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-dark-100 text-sm leading-tight">
              {churchName}
            </h1>
            <p className="text-xs text-gray-500 dark:text-dark-400">
              {memberName ? `Welcome, ${memberName}` : 'Member Portal'}
            </p>
          </div>
        </div>
      </header>

      {/* Online Pastors — leader avatars */}
      {churchName.toLowerCase().includes('henderson') && (
        <p className="px-4 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-dark-500">
          Central Henderson Leadership
        </p>
      )}
      <PastoralStories
        leaders={leaders}
        onStartChat={(leaderId) => onTabChange('care', leaderId)}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-auto min-h-0">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="flex-shrink-0 bg-stone-100 dark:bg-dark-850 border-t border-gray-200 dark:border-dark-700 px-1 pb-[env(safe-area-inset-bottom)] z-50">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={`flex flex-col items-center py-2 px-1.5 min-w-0 flex-1 transition-colors ${
                  isActive
                    ? ''
                    : 'text-gray-400 dark:text-dark-500 hover:text-gray-600 dark:hover:text-dark-400'
                }`}
                style={isActive ? { color: primaryColor } : undefined}
              >
                <Icon
                  size={22}
                  className={isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}
                />
                <span className={`text-[10px] mt-0.5 truncate max-w-full ${isActive ? 'font-semibold' : 'font-medium'}`}>
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
