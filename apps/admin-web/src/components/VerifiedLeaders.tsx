import { useState } from 'react';
import { LeaderMarketplace } from './LeaderMarketplace';
import { VerifiedLeadersEditorial } from './VerifiedLeadersEditorial';

type View = 'editorial' | 'cards';
const STORAGE_KEY = 'verified-leaders-view';

function getInitialView(): View {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'editorial' || saved === 'cards') return saved;
  }
  return 'editorial';
}

export function VerifiedLeaders() {
  const [view, setView] = useState<View>(getInitialView);

  const choose = (v: View) => {
    setView(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
  };

  return (
    <div className="relative">
      {/* Design toggle */}
      <div className="fixed top-4 right-4 z-[60] flex items-center gap-0.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full p-0.5 shadow-sm">
        <button
          onClick={() => choose('editorial')}
          className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
            view === 'editorial' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Editorial
        </button>
        <button
          onClick={() => choose('cards')}
          className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
            view === 'cards' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Cards
        </button>
      </div>

      {view === 'editorial' ? <VerifiedLeadersEditorial /> : <LeaderMarketplace />}
    </div>
  );
}
