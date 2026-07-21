import { ReactNode, useMemo, useState } from 'react';
import { QrCode, Smartphone, Monitor, ExternalLink, Copy, Check, ArrowLeft, Link2 } from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import type { View, Person, Task, Giving, CalendarEvent, PrayerRequest } from '../../types';
import { GraceMobile } from './GraceMobile';
import {
  MOBILE_TAB_TO_VIEW,
  graceMobileUrl,
  type GraceMobileTab,
} from '../../lib/graceMobileNav';

const PREVIEW_TABS: { id: GraceMobileTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'actions', label: 'Actions' },
  { id: 'people', label: 'People' },
  { id: 'sunday', label: 'Sunday' },
  { id: 'giving', label: 'Giving' },
];

interface GraceMobilePreviewProps {
  churchName?: string;
  branding?: { primaryColor?: string; logoUrl?: string };
  userName?: string;
  roleLabel?: string;
  people: Person[];
  tasks: Task[];
  giving: Giving[];
  events: CalendarEvent[];
  prayers: PrayerRequest[];
  /** Renders an admin View (delegates to ViewRenderer) with a preview-local setView. */
  renderView: (view: View, setView: (v: View) => void) => ReactNode;
  onBack: () => void;
}

export function GraceMobilePreview({
  churchName,
  branding,
  userName,
  roleLabel,
  people,
  tasks,
  giving,
  events,
  prayers,
  renderView,
  onBack,
}: GraceMobilePreviewProps) {
  const [viewMode, setViewMode] = useState<'phone' | 'full'>('phone');
  const [localView, setLocalView] = useState<View>('dashboard');
  const { isCopied: copied, copy: copyToClipboard } = useCopyToClipboard();

  const mobileUrl = useMemo(() => graceMobileUrl(), []);
  const qrCodeUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
        mobileUrl,
      )}&bgcolor=ffffff&color=e11d48`,
    [mobileUrl],
  );

  const activeTab: GraceMobileTab = useMemo(() => {
    const entry = (Object.entries(MOBILE_TAB_TO_VIEW) as [GraceMobileTab, View][]).find(
      ([, v]) => v === localView,
    );
    return entry ? entry[0] : 'home';
  }, [localView]);

  const selectPreviewTab = (tab: GraceMobileTab) => {
    setLocalView(tab === 'home' ? 'dashboard' : MOBILE_TAB_TO_VIEW[tab]);
  };

  const embedded = (
    <GraceMobile
      view={localView}
      onNavigate={setLocalView}
      renderView={(v) => renderView(v, setLocalView)}
      churchName={churchName}
      branding={branding}
      userName={userName}
      roleLabel={roleLabel}
      people={people}
      tasks={tasks}
      giving={giving}
      events={events}
      prayers={prayers}
    />
  );

  if (viewMode === 'full') {
    return (
      <div className="h-screen">
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={() => setViewMode('phone')}
            className="px-3 py-2 bg-stone-100 dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg shadow-lg text-sm font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-2"
          >
            <Smartphone size={16} />
            Phone Preview
          </button>
        </div>
        {embedded}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-900 dark:to-dark-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-stone-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={20} className="text-gray-600 dark:text-dark-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">GRACE Mobile</h1>
              <p className="text-gray-500 dark:text-dark-400">
                The mobile version of the CRM for your back-end staff
              </p>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-stone-100 dark:bg-dark-800 rounded-xl p-1 border border-gray-200 dark:border-dark-600">
            <button
              onClick={() => setViewMode('phone')}
              className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-400"
            >
              <Smartphone size={16} />
              Phone
            </button>
            <button
              onClick={() => setViewMode('full')}
              className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-700"
            >
              <Monitor size={16} />
              Full Screen
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Phone Frame Preview */}
          <div className="lg:col-span-2 flex justify-center">
            <div className="relative">
              <div className="w-[375px] h-[812px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                <div className="w-full h-full bg-stone-100 dark:bg-dark-900 rounded-[2.4rem] overflow-hidden relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-gray-900 rounded-b-2xl z-50" />
                  <div
                    className="h-full overflow-hidden flex flex-col"
                    style={{ transform: 'translateZ(0)' }}
                  >
                    {embedded}
                  </div>
                </div>
              </div>
              <div className="absolute right-[-3px] top-32 w-1 h-16 bg-gray-800 rounded-l-sm" />
              <div className="absolute left-[-3px] top-28 w-1 h-8 bg-gray-800 rounded-r-sm" />
              <div className="absolute left-[-3px] top-40 w-1 h-16 bg-gray-800 rounded-r-sm" />
            </div>
          </div>

          {/* QR Code & Sharing Panel */}
          <div className="space-y-6">
            {/* Preview Tab Picker */}
            <div className="bg-stone-100 dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-500/10 rounded-xl flex items-center justify-center">
                  <Smartphone className="text-slate-600 dark:text-slate-400" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-dark-100">Preview Tabs</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-400">
                    Jump between GRACE Mobile sections
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PREVIEW_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => selectPreviewTab(tab.id)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-slate-900 dark:bg-dark-100 text-white dark:text-dark-900'
                        : 'bg-white dark:bg-dark-700 text-gray-600 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-600 border border-gray-200 dark:border-dark-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* QR Code Card */}
            <div className="bg-stone-100 dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-brand-100 dark:bg-brand-500/10 rounded-xl flex items-center justify-center">
                  <QrCode className="text-brand-600 dark:text-brand-400" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-dark-100">Scan to Preview</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-400">Open on your mobile device</p>
                </div>
              </div>

              <div className="flex justify-center p-4 bg-white rounded-xl border border-gray-100 dark:border-dark-600">
                <img src={qrCodeUrl} alt="QR Code to GRACE Mobile" className="w-48 h-48" loading="lazy" />
              </div>

              <p className="text-xs text-center text-gray-400 dark:text-dark-500 mt-3">
                Scan with your phone camera, then sign in with your staff account
              </p>
            </div>

            {/* Share Link Card */}
            <div className="bg-stone-100 dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <Link2 className="text-emerald-600 dark:text-emerald-400" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-dark-100">App URL</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-400">Share with your staff</p>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={mobileUrl}
                  readOnly
                  className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl text-sm text-gray-600 dark:text-dark-300 truncate"
                />
                <button
                  onClick={() => copyToClipboard(mobileUrl)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
                    copied
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <a
                href={mobileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 flex items-center justify-center gap-2"
              >
                <ExternalLink size={16} />
                Open in New Tab
              </a>
            </div>

            {/* Info Card */}
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-500/20 p-4">
              <h4 className="font-medium text-amber-800 dark:text-amber-400 mb-2">
                Staff access required
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300/80">
                GRACE Mobile is the back-end CRM for your team. Anyone you open it for must sign in
                with an admin, pastor, or staff account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
