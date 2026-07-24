import { ReactNode, useState } from 'react';
import {
  Home,
  ListTodo,
  Users,
  Church,
  DollarSign,
  MoreHorizontal,
  ArrowLeft,
  X,
} from 'lucide-react';
import type { GraceMobileTab } from '../../lib/graceMobileNav';

export interface MoreLink {
  view: string;
  label: string;
  icon: ReactNode;
}

interface GraceMobileLayoutProps {
  children: ReactNode;
  activeTab: GraceMobileTab;
  onTabChange: (tab: GraceMobileTab) => void;
  churchName?: string;
  branding?: { primaryColor?: string; logoUrl?: string };
  /** Signed-in staff member's display name. */
  userName?: string;
  /** Role label shown under the church name (e.g. "Admin · Pastor"). */
  roleLabel?: string;
  /** Optional back handler shown in the header (used when drilled into a More item). */
  onBack?: () => void;
  /** Title override for the header (e.g. a More item's label). */
  headerTitle?: string;
  /** More sheet content. */
  moreLinks: MoreLink[];
  onSelectMore: (view: string) => void;
}

const TABS: { id: GraceMobileTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'actions', label: 'Actions', icon: ListTodo },
  { id: 'people', label: 'People', icon: Users },
  { id: 'sunday', label: 'Sunday', icon: Church },
  { id: 'giving', label: 'Giving', icon: DollarSign },
];

const DEFAULT_PRIMARY = '#3B53BB'; // brand-600 — GRACE Navy admin accent

export function GraceMobileLayout({
  children,
  activeTab,
  onTabChange,
  churchName = 'GRACE',
  branding,
  userName,
  roleLabel,
  onBack,
  headerTitle,
  moreLinks,
  onSelectMore,
}: GraceMobileLayoutProps) {
  const primaryColor = branding?.primaryColor || DEFAULT_PRIMARY;
  const logoUrl = branding?.logoUrl;
  const [moreOpen, setMoreOpen] = useState(false);
  const toggleMore = () => setMoreOpen((o) => !o);
  const selectMore = (view: string) => {
    setMoreOpen(false);
    onSelectMore(view);
  };

  return (
    <div className="h-full bg-gray-50 dark:bg-dark-900 flex flex-col relative overflow-hidden">
      {/* Header */}
      <header className="bg-stone-100 dark:bg-dark-850 border-b border-gray-100 dark:border-dark-700 px-4 py-3 flex items-center gap-3 flex-shrink-0 z-40">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-dark-400" />
          </button>
        )}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
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
          <div className="min-w-0">
            <h1 className="font-semibold text-gray-900 dark:text-dark-100 text-sm leading-tight truncate">
              {headerTitle || churchName}
            </h1>
            <p className="text-xs text-gray-500 dark:text-dark-400 truncate">
              {headerTitle
                ? 'GRACE Mobile'
                : userName
                  ? `${userName}${roleLabel ? ` · ${roleLabel}` : ''}`
                  : 'GRACE Mobile'}
            </p>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0"
          style={{ color: primaryColor, backgroundColor: `${primaryColor}1a` }}
        >
          Mobile
        </span>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto min-h-0">{children}</main>

      {/* More sheet */}
      {moreOpen && (
        <>
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm z-50"
            onClick={toggleMore}
          />
          <div className="absolute inset-x-0 bottom-0 z-50 bg-white dark:bg-dark-850 rounded-t-3xl border-t border-gray-200 dark:border-dark-700 pb-[env(safe-area-inset-bottom)] max-h-[75%] overflow-auto shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="font-semibold text-gray-900 dark:text-dark-100">More tools</h2>
              <button
                onClick={toggleMore}
                className="p-2 -mr-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
                aria-label="Close"
              >
                <X size={18} className="text-gray-500 dark:text-dark-400" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 px-4 pb-6 pt-2">
              {moreLinks.map((link) => (
                <button
                  key={link.view}
                  onClick={() => selectMore(link.view)}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-gray-50 dark:bg-dark-800 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-center"
                >
                  <span className="w-10 h-10 rounded-xl bg-white dark:bg-dark-900 flex items-center justify-center text-brand-600 dark:text-brand-400">
                    {link.icon}
                  </span>
                  <span className="text-[11px] font-medium text-gray-700 dark:text-dark-300 leading-tight">
                    {link.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation */}
      <nav className="flex-shrink-0 bg-stone-100 dark:bg-dark-850 border-t border-gray-200 dark:border-dark-700 px-1 pb-[env(safe-area-inset-bottom)] z-40">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id && !moreOpen;
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
                <Icon size={22} className={isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]'} />
                <span
                  className={`text-[10px] mt-0.5 truncate max-w-full ${
                    isActive ? 'font-semibold' : 'font-medium'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
          <button
            onClick={toggleMore}
            className={`flex flex-col items-center py-2 px-1.5 min-w-0 flex-1 transition-colors ${
              moreOpen
                ? ''
                : 'text-gray-400 dark:text-dark-500 hover:text-gray-600 dark:hover:text-dark-400'
            }`}
            style={moreOpen ? { color: primaryColor } : undefined}
          >
            <MoreHorizontal size={22} className={moreOpen ? 'stroke-[2.5px]' : 'stroke-[1.5px]'} />
            <span className={`text-[10px] mt-0.5 ${moreOpen ? 'font-semibold' : 'font-medium'}`}>
              More
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
