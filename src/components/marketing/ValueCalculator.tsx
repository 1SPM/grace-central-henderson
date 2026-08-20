/**
 * GRACE ecosystem value calculator — /pricing.
 *
 * One congregation-size input drives three outcomes: new revenue (the
 * church's commission on GRACE Impact Card spend), efficiency savings
 * (automation), and giving growth (engagement). Every constant behind
 * those three numbers is exposed and editable under "Check the math."
 *
 * Ported from the standalone showcase at previews/grace_value_calculator.html
 * — same model, same copy — after replacing an earlier tiered/audit-style
 * version that tested as confusing rather than as the intuitive hook this
 * page needs. Keep both in sync when either changes.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { capture } from '../../lib/observability/posthog';

const DEMO_URL = 'https://grace-crm-two.vercel.app/previews/grace_member_portal_generic.html';

const MEMBERS_MIN = 200;
const MEMBERS_MAX = 20000;
const ADOPT_MIN = 5;
const ADOPT_MAX = 60;
const FTE_MIN = 1;
const FTE_MAX = 40;
const GIVING_MIN = 100_000;
const GIVING_MAX = 40_000_000;

// Defaults mirror program planning; every one is editable under "Check the math."
const ASSUMPTION_DEFAULTS = {
  spendPerAccount: 500, // avg monthly card spend per member account ($)
  commissionPct: 1, // church's commission on card volume (%)
  loadedCost: 65_000, // loaded annual cost per admin staff member ($)
  automatedPct: 15, // share of admin work GRACE automates (%)
  softwarePerMember: 6, // annual software spend replaced, per member ($)
  liftPct: 2, // engagement-driven lift on annual giving (%)
} as const;

type Assumptions = typeof ASSUMPTION_DEFAULTS;

// Illustrative only — the notice is always labeled "Example activity," never
// implied as a live transaction feed. Ties the abstract loop diagram to a
// concrete, human example of what a designated-fund routing looks like.
// Each example has a fixed spot around the loop (matching where the flow
// arrows travel) so the notice reads as "this fund's activity," not a
// single fixed ticker.
const ACTIVITY_EXAMPLES = [
  { text: 'Grocery run routed $2.40 to Food Pantry', x: 78, y: 22 },
  { text: 'Gas fill-up routed $1.85 to Youth Ministry', x: 78, y: 78 },
  { text: 'Dinner out routed $3.10 to Missions', x: 22, y: 78 },
  { text: 'Coffee run routed $0.95 to Benevolence Fund', x: 22, y: 22 },
];

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return '$' + (Math.round(n / 100_000) / 10).toLocaleString('en-US') + 'M';
  return (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
}

function fmtCompact(n: number): string {
  return n >= 1_000_000 ? (Math.round(n / 100_000) / 10) + 'M' : Math.round(n / 1000) + 'k';
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Rolls the displayed total toward `target` instead of snapping — the
 *  cause-and-effect between moving a slider and the number changing
 *  should feel visible, not instant. */
function useCountUp(target: number): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    fromRef.current = shownRef.current;
    const from = fromRef.current;
    const t0 = performance.now();
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    function step(now: number) {
      const k = Math.min(1, (now - t0) / 350);
      const eased = 1 - Math.pow(1 - k, 3);
      const val = from + (target - from) * eased;
      shownRef.current = val;
      setShown(val);
      if (k < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [target, reduced]);

  return shown;
}

function OutcomeCard({
  tone, label, value, story, dialLabel, dialValue, dialDisplay, dialMin, dialMax, dialStep, onDial, how, badge,
}: {
  tone: 'revenue' | 'savings' | 'growth';
  label: string;
  value: number;
  story: string;
  dialLabel: string;
  dialValue: number;
  dialDisplay: string;
  dialMin: number;
  dialMax: number;
  dialStep: number;
  onDial: (v: number) => void;
  how: React.ReactNode;
  /** Short caveat shown under the label — for figures that depend on something not yet in place. */
  badge?: string;
}) {
  const tones = {
    revenue: { border: 'border-t-violet-600 dark:border-t-violet-400', text: 'text-violet-600 dark:text-violet-400', accent: 'accent-violet-600 dark:accent-violet-400' },
    savings: { border: 'border-t-emerald-600 dark:border-t-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', accent: 'accent-emerald-600 dark:accent-emerald-400' },
    growth: { border: 'border-t-amber-600 dark:border-t-amber-400', text: 'text-amber-600 dark:text-amber-400', accent: 'accent-amber-600 dark:accent-amber-400' },
  } as const;
  const t = tones[tone];

  return (
    <section className={`rounded-2xl border border-gray-200 dark:border-dark-700 border-t-4 ${t.border} bg-white dark:bg-dark-800 p-5 flex flex-col gap-1.5`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[11.5px] font-extrabold uppercase tracking-wide ${t.text}`}>{label}</span>
        {badge && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-400 bg-gray-100 dark:bg-dark-700 rounded-full px-2 py-0.5">
            {badge}
          </span>
        )}
      </div>
      <span className={`text-3xl sm:text-4xl tabular-nums ${t.text}`} style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{fmt(value)}</span>
      <p className="text-sm text-gray-600 dark:text-dark-300 flex-1">{story}</p>
      <div className="mt-2">
        <div className="flex justify-between text-xs text-gray-500 dark:text-dark-400 mb-0.5">
          <span>{dialLabel}</span>
          <span className="text-gray-900 dark:text-dark-100 tabular-nums font-medium">{dialDisplay}</span>
        </div>
        <input
          type="range"
          min={dialMin}
          max={dialMax}
          step={dialStep}
          value={dialValue}
          onChange={(e) => onDial(Number(e.target.value))}
          className={`w-full ${t.accent}`}
        />
      </div>
      <div className="text-xs text-gray-500 dark:text-dark-400 border-t border-dotted border-gray-200 dark:border-dark-700 pt-2 mt-1">
        {how}
      </div>
    </section>
  );
}

function ActivityNotice() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;
    function cycle() {
      setIndex((i) => (i + 1) % ACTIVITY_EXAMPLES.length);
      setVisible(true);
      hideTimer = setTimeout(() => setVisible(false), 4200);
    }
    const first = setTimeout(cycle, 1800);
    const interval = setInterval(cycle, 6800);
    return () => { clearTimeout(first); clearInterval(interval); clearTimeout(hideTimer); };
  }, []);

  const item = ACTIVITY_EXAMPLES[index];

  return (
    <div
      className={[
        'gc-loop-notice absolute z-[2] max-w-[200px] rounded-xl border border-gray-200 dark:border-dark-700',
        'bg-white dark:bg-dark-800 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.3)] px-3.5 py-2.5 pointer-events-none',
        'max-sm:mt-3.5 max-sm:mx-auto max-sm:max-w-none',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        transform: `translate(-50%, -50%) translateY(${visible ? 0 : 8}px)`,
        transition: 'opacity .4s ease, transform .4s ease, left .5s ease, top .5s ease',
      }}
      aria-hidden="true"
    >
      <div className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-0.5">
        Example activity &middot; GRACE Impact Card
      </div>
      <div className="text-[12.5px] text-gray-600 dark:text-dark-300 leading-snug">
        {item.text}
      </div>
    </div>
  );
}

export function ValueCalculator() {
  const [members, setMembers] = useState(2500);
  const [adoptPct, setAdoptPct] = useState(25);
  const [fte, setFte] = useState(6);
  const [giving, setGiving] = useState(5_000_000);
  const [touchedFte, setTouchedFte] = useState(false);
  const [touchedGiving, setTouchedGiving] = useState(false);
  const [assumptions, setAssumptions] = useState<Assumptions>(ASSUMPTION_DEFAULTS);
  const [churchName, setChurchName] = useState('');
  const [mathOpen, setMathOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const started = useRef(false);
  const editedFields = useRef(new Set<string>());
  const completed = useRef(false);
  const mathTracked = useRef(false);

  const trackStart = () => {
    if (!started.current) { started.current = true; capture('calculator_started'); }
  };
  const trackField = (field: string) => {
    trackStart();
    editedFields.current.add(field);
    capture('assumption_changed', { field });
    if (!completed.current && editedFields.current.size >= 3) {
      completed.current = true;
      capture('calculator_completed');
    }
  };

  // Restore a shared scenario from the URL on mount; church stays as a
  // query param only (never persisted), same as the standalone page.
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const church = (qs.get('church') || '').trim().slice(0, 40);
    if (church) setChurchName(church);

    const m = parseFloat(qs.get('m') || '');
    const a = parseFloat(qs.get('a') || '');
    const f = parseFloat(qs.get('f') || '');
    const g = parseFloat(qs.get('g') || '');
    if (isFinite(m)) setMembers(clamp(m, MEMBERS_MIN, MEMBERS_MAX));
    if (isFinite(a)) setAdoptPct(clamp(a, ADOPT_MIN, ADOPT_MAX));
    if (isFinite(f)) { setFte(clamp(f, FTE_MIN, FTE_MAX)); setTouchedFte(true); }
    if (isFinite(g)) { setGiving(clamp(g, GIVING_MIN, GIVING_MAX)); setTouchedGiving(true); }
  }, []);

  // Companion dials scale with congregation size until the visitor takes
  // the wheel themselves.
  useEffect(() => {
    if (!touchedFte) setFte(Math.max(1, Math.round(members / 400)));
    if (!touchedGiving) setGiving(Math.round((members * 2000) / 100_000) * 100_000);
  }, [members]);

  useEffect(() => {
    if (churchName) document.title = `${churchName} · GRACE Value Calculator`;
    return () => { document.title = 'GRACE'; };
  }, [churchName]);

  // Keep the URL shareable without fighting the app's own hand-rolled
  // pathname routing — only ever touch the query string.
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const p = new URLSearchParams();
      if (churchName) p.set('church', churchName);
      p.set('m', String(members));
      p.set('a', String(adoptPct));
      p.set('f', String(fte));
      p.set('g', String(giving));
      try {
        window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
      } catch {
        // best-effort; nothing depends on this succeeding
      }
    }, 250);
    return () => { if (urlTimer.current) clearTimeout(urlTimer.current); };
  }, [churchName, members, adoptPct, fte, giving]);

  const model = useMemo(() => {
    const accounts = members * (adoptPct / 100);
    const revenue = accounts * assumptions.spendPerAccount * 12 * (assumptions.commissionPct / 100);
    const savings = fte * assumptions.loadedCost * (assumptions.automatedPct / 100) + members * assumptions.softwarePerMember;
    const growth = giving * (assumptions.liftPct / 100);
    return { accounts, revenue, savings, growth, total: revenue + savings + growth };
  }, [members, adoptPct, fte, giving, assumptions]);

  const displayTotal = useCountUp(model.total);

  function setAssumption<K extends keyof Assumptions>(key: K, value: number) {
    trackField(`math_${key}`);
    setAssumptions((prev) => ({ ...prev, [key]: value }));
  }

  function shareUrl(): string {
    const p = new URLSearchParams();
    if (churchName) p.set('church', churchName);
    p.set('m', String(members));
    p.set('a', String(adoptPct));
    p.set('f', String(fte));
    p.set('g', String(giving));
    return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
  }

  async function handleShare() {
    trackStart();
    capture('scenario_shared');
    try {
      await navigator.clipboard.writeText(shareUrl());
    } catch {
      // clipboard API unavailable — the URL bar already reflects the scenario
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1600);
  }

  function handleCta() {
    trackStart();
    capture('demo_requested', { source: 'ecosystem_calculator' });
    window.open(DEMO_URL, '_blank', 'noopener');
  }

  function handleMathToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    const open = e.currentTarget.open;
    setMathOpen(open);
    if (open && !mathTracked.current) { mathTracked.current = true; trackStart(); capture('math_opened'); }
  }

  return (
    <section className="max-w-4xl mx-auto px-4 py-20" aria-labelledby="value-calc-heading">
      <h2 id="value-calc-heading" className="text-3xl md:text-4xl font-light text-gray-900 dark:text-dark-50 mb-3 text-center" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
        Empower your congregation with seamless giving, powered by GRACE.
      </h2>
      <p className="text-gray-600 dark:text-dark-400 mb-9 text-center max-w-[46ch] mx-auto">
        GRACE brings giving, community, and everyday commerce together in one engine that funds ministry.
      </p>

      {/* the one input that matters */}
      <div className="max-w-[560px] mx-auto text-center mb-2">
        <label htmlFor="calc-members" className="text-[13px] font-bold uppercase tracking-wide text-gray-500 dark:text-dark-400">
          Your congregation
        </label>
        <div className="text-4xl sm:text-5xl mt-0.5 mb-1.5 text-gray-900 dark:text-dark-50 tabular-nums" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          {members.toLocaleString('en-US')} <span className="text-[.45em] text-gray-500 dark:text-dark-400" style={{ fontFamily: 'inherit' }}>people</span>
        </div>
        <input
          id="calc-members"
          type="range"
          min={MEMBERS_MIN}
          max={MEMBERS_MAX}
          step={100}
          value={members}
          onChange={(e) => { trackField('members'); setMembers(Number(e.target.value)); }}
          className="w-full accent-gray-900 dark:accent-dark-100"
          aria-label="Congregation size"
        />
      </div>

      {/* the answer */}
      <div className="text-center py-6 pb-2.5">
        <div className="text-[12.5px] font-bold uppercase tracking-wide text-gray-500 dark:text-dark-400">
          What the GRACE ecosystem generates for your church
        </div>
        <div className="text-6xl sm:text-7xl tabular-nums text-emerald-700 dark:text-emerald-400 my-1.5" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          {fmt(displayTotal)}
        </div>
        <p className="text-gray-600 dark:text-dark-300 max-w-[44ch] mx-auto">
          every year in new revenue, recovered staff time, and giving growth, powered by your own members.
        </p>
        <p className="text-xs text-gray-500 dark:text-dark-400 max-w-[44ch] mx-auto mt-2">
          The new-revenue portion is a projection — it depends on an executed card program agreement, which is not yet in place. Staff-time and giving-growth figures don't.
        </p>
      </div>

      {/* ecosystem loop */}
      <style>{`
        .gc-loop-icon { transition: transform .18s ease; transform-box: fill-box; transform-origin: center; }
        .gc-loop-icon:hover { transform: scale(1.22); }
        .gc-loop-arrow {
          offset-path: path('M112,158 A238,86 0 1,1 588,158 A238,86 0 1,1 112,158');
        }
        .gc-loop-arrow.a1 { offset-distance: 0%; }
        .gc-loop-arrow.a2 { offset-distance: 25%; }
        .gc-loop-arrow.a3 { offset-distance: 50%; }
        .gc-loop-arrow.a4 { offset-distance: 75%; }
        @media (prefers-reduced-motion: no-preference) {
          .gc-loop-ring { animation: gc-loop-dash-flow 12s linear infinite; }
          .gc-loop-arrow { offset-rotate: auto; animation: gc-loop-orbit 12s linear infinite; }
          .gc-loop-arrow.a2 { animation-delay: -3s; }
          .gc-loop-arrow.a3 { animation-delay: -6s; }
          .gc-loop-arrow.a4 { animation-delay: -9s; }
        }
        @keyframes gc-loop-dash-flow { to { stroke-dashoffset: -24; } }
        @keyframes gc-loop-orbit { from { offset-distance: 0%; } to { offset-distance: 100%; } }
        @media (prefers-reduced-motion: reduce) { .gc-loop-notice { transition: none !important; } }
        @media (max-width: 639px) {
          .gc-loop-notice { position: static !important; left: auto !important; top: auto !important; transform: none !important; }
        }
      `}</style>
      <div className="relative max-w-[620px] mx-auto mt-10 mb-2">
        <svg viewBox="0 0 700 316" className="w-full h-auto overflow-visible text-gray-300 dark:text-dark-600" aria-hidden="true">
          <ellipse className="gc-loop-ring" cx="350" cy="158" rx="238" ry="86" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="6 6" />
          <g className="fill-amber-600 dark:fill-amber-400">
            <polygon className="gc-loop-arrow a1" points="-6,-5 8,0 -6,5" />
            <polygon className="gc-loop-arrow a2" points="-6,-5 8,0 -6,5" />
            <polygon className="gc-loop-arrow a3" points="-6,-5 8,0 -6,5" />
            <polygon className="gc-loop-arrow a4" points="-6,-5 8,0 -6,5" />
          </g>
          <circle cx="350" cy="158" r="27" className="fill-gray-100 dark:fill-dark-850 stroke-gray-200 dark:stroke-dark-700" strokeWidth={1.2} />
          <g
            className="text-gray-900 dark:text-dark-50"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <svg x="333" y="141" width="34" height="34" viewBox="0 0 24 24">
              <path d="M12 2v3" /><path d="M10.3 3.5h3.4" />
              <path d="M4 21V11l8-6 8 6v10" /><path d="M9 21v-6h6v6" />
            </svg>
          </g>
          <g
            className="text-violet-600 dark:text-violet-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <svg className="gc-loop-icon" x="339" y="15" width="22" height="22" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            </svg>
            <svg className="gc-loop-icon" x="586" y="106" width="22" height="22" viewBox="0 0 24 24">
              <rect x="2" y="6" width="20" height="14" rx="2.5" /><line x1="2" y1="11" x2="22" y2="11" />
            </svg>
            <svg className="gc-loop-icon" x="339" y="245" width="22" height="22" viewBox="0 0 24 24">
              <path d="M12 21s-7.5-4.6-10-9.3C.5 8.5 2.3 5 6 5c2 0 3.5 1 4.5 2.3 1-1.3 2.5-2.3 4.5-2.3 3.7 0 5.5 3.5 4 6.7C19.5 16.4 12 21 12 21z" />
            </svg>
            <svg className="gc-loop-icon" x="92" y="106" width="22" height="22" viewBox="0 0 24 24">
              <path d="M4 4v5h5" /><path d="M20 20v-5h-5" /><path d="M5.5 9A8 8 0 0 1 20 12" /><path d="M18.5 15A8 8 0 0 1 4 12" />
            </svg>
          </g>
          <g textAnchor="middle">
            <text x="350" y="58" className="fill-gray-900 dark:fill-dark-50 text-[13px] font-bold">Your members</text>
            <text x="597" y="156" className="fill-gray-900 dark:fill-dark-50 text-[13px] font-bold">Everyday spending</text>
            <text x="597" y="172" className="fill-gray-500 dark:fill-dark-400 text-[10.5px]">on your church's own card</text>
            <text x="350" y="296" className="fill-gray-900 dark:fill-dark-50 text-[13px] font-bold">Ministry funding</text>
            <text x="103" y="156" className="fill-gray-900 dark:fill-dark-50 text-[13px] font-bold">Engagement &amp; agency</text>
            <text x="103" y="172" className="fill-gray-500 dark:fill-dark-400 text-[10.5px]">members choose the impact</text>
          </g>
        </svg>
        <ActivityNotice />
      </div>
      <p className="text-center text-gray-600 dark:text-dark-300 text-[16.5px] font-medium leading-[1.5] max-w-[54ch] mx-auto mb-10">
        Members spend on their church's card. That spending funds{' '}
        <strong className="text-violet-600 dark:text-violet-400 font-bold">designated initiatives like missions, youth, and benevolence</strong>.
        Members see the impact and stay engaged, growing the ecosystem.
      </p>

      {/* three outcomes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-8">
        <OutcomeCard
          tone="revenue"
          label="New revenue"
          badge="Projected — requires card agreement"
          value={model.revenue}
          story="The GRACE Impact Card turns everyday generosity like groceries, gas, and dining into designated funding for missions, youth, and benevolence, at no cost to the member."
          dialLabel="Members carrying the card"
          dialValue={adoptPct}
          dialDisplay={`${Math.round(adoptPct)}%`}
          dialMin={ADOPT_MIN}
          dialMax={ADOPT_MAX}
          dialStep={1}
          onDial={(v) => { trackField('adoption'); setAdoptPct(v); }}
          how={<>{Math.round(model.accounts).toLocaleString('en-US')} members × ${assumptions.spendPerAccount}/mo everyday spend × {assumptions.commissionPct}% to your church</>}
        />
        <OutcomeCard
          tone="savings"
          label="Efficiency savings"
          value={model.savings}
          story="GRACE automates data entry, scheduling, and follow-ups, and replaces the stack of software subscriptions your operating budget pays for today."
          dialLabel="Office & admin staff"
          dialValue={fte}
          dialDisplay={`${fte} FTE`}
          dialMin={FTE_MIN}
          dialMax={FTE_MAX}
          dialStep={1}
          onDial={(v) => { trackField('fte'); setTouchedFte(true); setFte(v); }}
          how={<>{fte} staff × {assumptions.automatedPct}% of their week automated, plus {fmt(members * assumptions.softwarePerMember)}/yr of software replaced</>}
        />
        <OutcomeCard
          tone="growth"
          label="Giving growth"
          value={model.growth}
          story="Members with agency stay engaged. Seeing their generosity fund real, designated initiatives keeps your congregation engaged, giving, and growing."
          dialLabel="Annual giving today"
          dialValue={giving}
          dialDisplay={`$${fmtCompact(giving)}`}
          dialMin={GIVING_MIN}
          dialMax={GIVING_MAX}
          dialStep={100_000}
          onDial={(v) => { trackField('giving'); setTouchedGiving(true); setGiving(v); }}
          how={<>{assumptions.liftPct}% lift on {fmt(giving)} from engaged, retained members</>}
        />
      </div>

      {/* cta */}
      <div className="text-center mt-11">
        <p className="text-gray-600 dark:text-dark-300 max-w-[46ch] mx-auto mb-4">
          This is what one connected ecosystem does that five disconnected tools can't. See it running for a church like yours.
        </p>
        <button
          type="button"
          onClick={handleCta}
          className="inline-block font-bold text-[15px] px-7 py-3.5 rounded-xl bg-gray-900 dark:bg-dark-100 text-white dark:text-dark-900 hover:opacity-90 transition-opacity"
        >
          See GRACE in action
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="block mx-auto mt-3 text-[13px] font-semibold text-gray-600 dark:text-dark-300 underline underline-offset-4 hover:text-gray-900 dark:hover:text-dark-100"
        >
          {shareCopied ? 'Link copied ✓' : 'Copy a link to this scenario'}
        </button>
      </div>

      {/* check the math */}
      <details
        className="max-w-[620px] mx-auto mt-10 border-t border-gray-200 dark:border-dark-700 pt-4.5"
        open={mathOpen}
        onToggle={handleMathToggle}
      >
        <summary className="cursor-pointer font-bold text-[14.5px] text-gray-700 dark:text-dark-300 flex items-center justify-center gap-1.5 list-none [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true">{mathOpen ? '▾' : '▸'}</span> Check the math
        </summary>
        <p className="text-[13px] text-gray-500 dark:text-dark-400 text-center max-w-[50ch] mx-auto my-3">
          Financial stewardship means showing our work, not just the results. Every number above comes from the assumptions below, and changing any of them moves the totals.
        </p>

        <MathGroup tone="revenue" title="New revenue" formula="Members on the card × everyday spend × your church's commission × 12 months">
          <MathRow label="Everyday spend per account" prefix="$" suffix="/mo" value={assumptions.spendPerAccount} min={0} step={25} onChange={(v) => setAssumption('spendPerAccount', v)} />
          <MathRow label="Church's commission" suffix="%" value={assumptions.commissionPct} min={0} max={5} step={0.05} onChange={(v) => setAssumption('commissionPct', v)} />
        </MathGroup>

        <MathGroup tone="savings" title="Efficiency savings" formula="(Admin staff × loaded cost × share automated) + (members × software replaced)">
          <MathRow label="Loaded cost per staff member" prefix="$" suffix="/yr" value={assumptions.loadedCost} min={0} step={1000} onChange={(v) => setAssumption('loadedCost', v)} />
          <MathRow label="Share of their work automated" suffix="%" value={assumptions.automatedPct} min={0} max={100} step={1} onChange={(v) => setAssumption('automatedPct', v)} />
          <MathRow label="Software replaced, per member" prefix="$" suffix="/yr" value={assumptions.softwarePerMember} min={0} step={1} onChange={(v) => setAssumption('softwarePerMember', v)} />
        </MathGroup>

        <MathGroup tone="growth" title="Giving growth" formula="Annual giving today × the lift from an engaged, retained congregation">
          <MathRow label="Engagement lift on giving" suffix="%" value={assumptions.liftPct} min={0} max={20} step={0.5} onChange={(v) => setAssumption('liftPct', v)} />
        </MathGroup>
      </details>

      <footer className="text-center text-xs text-gray-500 dark:text-dark-400 mt-10 pt-4 border-t border-gray-200 dark:border-dark-700 leading-relaxed">
        Illustrative estimates based on your inputs and GRACE program planning. Efficiency savings and giving growth are modeled from live product usage; new-card-revenue figures are a projection of program potential and require an executed card program agreement, which does not yet exist. Actual results vary by congregation.
      </footer>
    </section>
  );
}

function MathGroup({ tone, title, formula, children }: { tone: 'revenue' | 'savings' | 'growth'; title: string; formula: string; children: React.ReactNode }) {
  const tones = {
    revenue: { border: 'border-l-violet-600 dark:border-l-violet-400', text: 'text-violet-600 dark:text-violet-400' },
    savings: { border: 'border-l-emerald-600 dark:border-l-emerald-400', text: 'text-emerald-600 dark:text-emerald-400' },
    growth: { border: 'border-l-amber-600 dark:border-l-amber-400', text: 'text-amber-600 dark:text-amber-400' },
  } as const;
  const t = tones[tone];
  return (
    <div className={`mb-3.5 p-4 rounded-xl border border-gray-200 dark:border-dark-700 border-l-[3px] ${t.border} bg-white dark:bg-dark-800`}>
      <h4 className={`text-[11.5px] font-extrabold uppercase tracking-wide ${t.text} mb-0.5`}>{title}</h4>
      <p className="text-[12.5px] text-gray-500 dark:text-dark-400 mb-2.5">{formula}</p>
      {children}
    </div>
  );
}

function MathRow({
  label, value, onChange, prefix, suffix, min, max, step,
}: {
  label: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; min: number; max?: number; step: number;
}) {
  return (
    <div className="flex justify-between items-center gap-3 py-2 border-t border-dotted border-gray-200 dark:border-dark-700 first:border-t-0">
      <label className="text-[13.5px] text-gray-600 dark:text-dark-300">{label}</label>
      <div className="relative w-[110px] flex-none">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 dark:text-dark-500 pointer-events-none">{prefix}</span>}
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={[
            'w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-gray-50 dark:bg-dark-850 text-gray-900 dark:text-dark-100 text-[13.5px] text-right tabular-nums py-1.5',
            prefix && suffix ? 'pl-5 pr-8' : prefix ? 'pl-5 pr-2' : suffix ? 'pl-2 pr-8' : 'px-2',
            'focus:outline-none focus:ring-2 focus:ring-amber-400',
          ].join(' ')}
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 dark:text-dark-500 pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
}
