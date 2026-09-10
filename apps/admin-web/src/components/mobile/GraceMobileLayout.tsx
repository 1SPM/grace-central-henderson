import { ReactNode, useState } from 'react';
import {
  Home,
  ListTodo,
  Users,
  Church,
  MoreHorizontal,
  ArrowLeft,
  X,
  Sparkles,
  Mic,
} from 'lucide-react';
import { BAR_TABS, type GraceMobileTab } from '../../lib/graceMobileNav';
import { MOBILE_BG, MOBILE_SHEET_BG } from './ui/mobileTheme';

export interface MoreLink {
  view: string;
  label: string;
  icon: ReactNode;
}

interface GraceMobileLayoutProps {
  children: ReactNode;
  activeTab: GraceMobileTab;
  onTabChange: (tab: GraceMobileTab) => void;
  /**
   * tab — a bottom-bar screen (tab highlighted);
   * stack — a pushed screen with a back chevron (Brief, Ask Grace, drill-downs).
   */
  mode?: 'tab' | 'stack';
  churchName?: string;
  branding?: { primaryColor?: string; logoUrl?: string };
  /** Signed-in staff member's display name. */
  userName?: string;
  /** Role label shown under the church name (e.g. "Admin · Pastor"). */
  roleLabel?: string;
  /** Back handler for stack mode. */
  onBack?: () => void;
  /** Title override for the header (stack screens, drill-downs). */
  headerTitle?: string;
  /** More sheet content. */
  moreLinks: MoreLink[];
  onSelectMore: (view: string) => void;
  /** Open the Ask Grace screen, optionally seeding a prompt. */
  onOpenGrace: (seed?: string) => void;
  /** Mic tap on the Ask pill — opens Grace listening. */
  onMicTap?: () => void;
  /** Hide the persistent Ask pill (on the Grace screen itself). */
  hideAskPill?: boolean;
}

const TAB_META: Record<GraceMobileTab, { label: string; icon: typeof Home }> = {
  home: { label: 'Home', icon: Home },
  brief: { label: 'Brief', icon: Sparkles },
  people: { label: 'People', icon: Users },
  sunday: { label: 'Sunday', icon: Church },
  work: { label: 'Work', icon: ListTodo },
};

const DEFAULT_PRIMARY = '#3B53BB'; // brand-600 — GRACE Navy admin accent

export function GraceMobileLayout({
  children,
  activeTab,
  onTabChange,
  mode = 'tab',
  churchName = 'GRACE',
  branding,
  userName,
  roleLabel,
  onBack,
  headerTitle,
  moreLinks,
  onSelectMore,
  onOpenGrace,
  onMicTap,
  hideAskPill = false,
}: GraceMobileLayoutProps) {
  const primaryColor = branding?.primaryColor || DEFAULT_PRIMARY;
  const logoUrl = branding?.logoUrl;
  const [moreOpen, setMoreOpen] = useState(false);
  const toggleMore = () => setMoreOpen((o) => !o);
  const selectMore = (view: string) => {
    setMoreOpen(false);
    onSelectMore(view);
  };
  const isStack = mode === 'stack';

  return (
    <div
      className="grace-mobile-shell h-full text-slate-100 flex flex-col relative overflow-hidden"
      style={{ backgroundColor: MOBILE_BG }}
    >
      {/* Header */}
      <header className="border-b border-white/[0.07] px-4 py-3 flex items-center gap-3 flex-shrink-0 z-40 backdrop-blur-xl bg-[#070b14]/95">
        {isStack && onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={20} className="text-slate-300" />
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
            <h1 className="font-semibold text-slate-100 text-sm leading-tight truncate">
              {headerTitle || churchName}
            </h1>
            <p className="text-xs text-slate-400 truncate">
              {headerTitle
                ? churchName
                : userName
                  ? `${userName}${roleLabel ? ` · ${roleLabel}` : ''}`
                  : 'GRACE Mobile'}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto min-h-0">{children}</main>

      {/* Persistent Ask Grace pill */}
      {!hideAskPill && (
        <div className="px-3 pb-2 pt-1" style={{ backgroundColor: MOBILE_BG }}>
          <div className="w-full h-11 rounded-2xl border border-white/[0.09] bg-white/[0.055] pl-3 pr-1.5 flex items-center gap-2 shadow-[0_12px_35px_rgba(0,0,0,.26)]">
            <button
              type="button"
              onClick={() => onOpenGrace()}
              className="flex-1 min-w-0 h-full flex items-center gap-2 text-left"
            >
              <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 grid place-items-center text-white shadow-[0_0_18px_rgba(129,92,246,.55)] shrink-0">
                <Sparkles size={14} />
              </span>
              <span className="flex-1 min-w-0 truncate text-sm text-slate-400">Ask Grace anything...</span>
            </button>
            <button
              type="button"
              onClick={onMicTap ?? (() => onOpenGrace())}
              className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 grid place-items-center shrink-0"
              aria-label="Talk to Grace"
            >
              <Mic size={14} />
            </button>
          </div>
        </div>
      )}

      {/* More sheet */}
      {moreOpen && (
        <>
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm z-50"
            onClick={toggleMore}
          />
          <div
            className="absolute inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/[0.1] pb-[env(safe-area-inset-bottom)] max-h-[75%] overflow-auto shadow-2xl"
            style={{ backgroundColor: MOBILE_SHEET_BG }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="font-semibold text-slate-100">More tools</h2>
              <button
                onClick={toggleMore}
                className="p-2 -mr-2 hover:bg-white/5 rounded-lg"
                aria-label="Close"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 px-4 pb-6 pt-2">
              {moreLinks.map((link) => (
                <button
                  key={link.view}
                  onClick={() => selectMore(link.view)}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] transition-colors text-center"
                >
                  <span className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-indigo-300">
                    {link.icon}
                  </span>
                  <span className="text-[11px] font-medium text-slate-300 leading-tight">
                    {link.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation */}
      <nav
        className="flex-shrink-0 border-t border-white/[0.07] px-1 pb-[env(safe-area-inset-bottom)] z-40"
        style={{ backgroundColor: MOBILE_BG }}
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {BAR_TABS.map((id) => {
            const { label, icon: Icon } = TAB_META[id];
            const isActive = !isStack && activeTab === id && !moreOpen;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={`flex flex-col items-center py-2 px-1.5 min-w-0 flex-1 transition-colors ${
                  isActive ? '' : 'text-slate-500 hover:text-slate-300'
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
              moreOpen ? '' : 'text-slate-500 hover:text-slate-300'
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
