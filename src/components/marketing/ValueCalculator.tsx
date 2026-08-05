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
  tone, label, value, story, dialLabel, dialValue, dialDisplay, dialMin, dialMax, dialStep, onDial, how,
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
}) {
  const tones = {
    revenue: { border: 'border-t-violet-600 dark:border-t-violet-400', text: 'text-violet-600 dark:text-violet-400', accent: 'accent-violet-600 dark:accent-violet-400' },
    savings: { border: 'border-t-emerald-600 dark:border-t-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', accent: 'accent-emerald-600 dark:accent-emerald-400' },
    growth: { border: 'border-t-amber-600 dark:border-t-amber-400', text: 'text-amber-600 dark:text-amber-400', accent: 'accent-amber-600 dark:accent-amber-400' },
  } as const;
  const t = tones[tone];

  return (
    <section className={`rounded-2xl border border-gray-200 dark:border-dark-700 border-t-4 ${t.border} bg-white dark:bg-dark-800 p-5 flex flex-col gap-1.5`}>
      <span className={`text-[11.5px] font-extrabold uppercase tracking-wide ${t.text}`}>{label}</span>
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
        The GRACE Impact Card empowers your congregation with seamless giving anytime and anywhere.
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
      </div>

      {/* ecosystem loop */}
      <div className="max-w-[620px] mx-auto mt-10 mb-2" aria-hidden="true">
        <svg viewBox="0 0 700 264" className="w-full h-auto text-gray-300 dark:text-dark-600">
          <ellipse cx="350" cy="132" rx="238" ry="88" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="5 5" />
          <g className="fill-amber-600 dark:fill-amber-400">
            <polygon points="-6,-5 8,0 -6,5" transform="translate(518,70) rotate(20)" />
            <polygon points="-6,-5 8,0 -6,5" transform="translate(518,194) rotate(160)" />
            <polygon points="-6,-5 8,0 -6,5" transform="translate(182,194) rotate(200)" />
            <polygon points="-6,-5 8,0 -6,5" transform="translate(182,70) rotate(-20)" />
          </g>
          <g textAnchor="middle">
            <text x="350" y="26" className="fill-gray-900 dark:fill-dark-50 text-[13px] font-bold">Your members</text>
            <text x="597" y="126" className="fill-gray-900 dark:fill-dark-50 text-[13px] font-bold">Everyday spending</text>
            <text x="597" y="142" className="fill-gray-500 dark:fill-dark-400 text-[10.5px]">on your church's own card</text>
            <text x="350" y="252" className="fill-gray-900 dark:fill-dark-50 text-[13px] font-bold">Ministry funding</text>
            <text x="103" y="126" className="fill-gray-900 dark:fill-dark-50 text-[13px] font-bold">Engagement &amp; agency</text>
            <text x="103" y="142" className="fill-gray-500 dark:fill-dark-400 text-[10.5px]">members choose the impact</text>
          </g>
        </svg>
      </div>
      <p className="text-center text-gray-500 dark:text-dark-400 text-[13.5px] max-w-[52ch] mx-auto mb-10">
        Members spend on their church's card. That spending funds designated initiatives like missions, youth, and benevolence. Members see the impact and stay engaged, and the ecosystem grows.
      </p>

      {/* three outcomes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-8">
        <OutcomeCard
          tone="revenue"
          label="New revenue"
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

      {/* the card, made tangible */}
      <div className="flex items-center justify-center gap-8 flex-wrap mb-10">
        <div
          className="w-[280px] h-[174px] rounded-2xl relative flex-none text-indigo-50"
          style={{
            background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 45%, #7C3AED 130%)',
            boxShadow: '0 18px 40px -18px rgba(49,46,129,.55), 0 4px 12px rgba(0,0,0,.18)',
            transform: 'rotate(-4deg)',
          }}
          aria-hidden="true"
        >
          <div className="absolute top-[20px] left-[22px] text-sm font-bold tracking-wide">
            {churchName || 'Your Church'}
            <small className="block text-[10px] font-semibold tracking-[0.14em] uppercase opacity-75 mt-0.5">Member Card</small>
          </div>
          <div className="absolute top-[22px] right-[22px] w-5 h-5">
            <span className="absolute inset-0 rounded-full border-2" style={{ borderColor: 'transparent rgba(238,242,255,.85) transparent transparent' }} />
            <span className="absolute inset-[4px] rounded-full border-2" style={{ borderColor: 'transparent rgba(238,242,255,.85) transparent transparent' }} />
            <span className="absolute inset-[9px] rounded-full border-2" style={{ borderColor: 'transparent rgba(238,242,255,.85) transparent transparent' }} />
          </div>
          <div
            className="absolute top-[54px] left-[22px] w-9 h-[27px] rounded-md"
            style={{ background: 'linear-gradient(135deg, #FCD34D, #B45309)' }}
          />
          <div className="absolute bottom-[54px] left-[22px] text-[15px] tracking-[0.18em] tabular-nums opacity-95">•••• •••• •••• 4821</div>
          <div className="absolute bottom-[38px] left-[22px] text-[9px] tracking-wide uppercase opacity-70 whitespace-nowrap">Member since 2026</div>
          <div className="absolute bottom-[14px] left-[22px] right-[22px] flex justify-end text-[11px]">
            <span className="font-extrabold whitespace-nowrap">GRACE Impact Card</span>
          </div>
        </div>
        <div className="max-w-[340px]">
          <p className="text-2xl sm:text-3xl font-normal text-gray-900 dark:text-dark-50 mb-2" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
            Support a cause with every transaction.
          </p>
          <p className="text-[14.5px] text-gray-600 dark:text-dark-300 max-w-[38ch]">
            The <strong>GRACE Impact Card</strong> puts your church's name in every member's wallet and turns everyday generosity into designated giving, automatically.
          </p>
        </div>
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
        Illustrative estimates based on your inputs and GRACE program planning. Actual results vary by congregation and program terms.
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
