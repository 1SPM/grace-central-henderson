/**
 * Interactive value calculator — /pricing.
 *
 * Every input is a labeled, editable assumption. Confirmed figures
 * (software subscriptions, published processing rates, plan price) are
 * verifiable from the church's own bills and never scale with scenario.
 * Estimated figures (staff/volunteer time, missed follow-ups) depend on
 * adoption and are scaled by the scenario multiplier. Impact Card
 * interchange revenue is excluded from every scenario, including
 * optimistic, until the live i2c adapter ships (see api/_lib/i2c —
 * mock-only today).
 *
 * Ported from the standalone prototype at
 * previews/grace_value_calculator.html — same model, same copy, now
 * wired to the real plan catalog (lib/plans.ts) and PostHog.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { CLIENT_PLANS, type PlanSlug } from '../../lib/plans';
import { capture } from '../../lib/observability/posthog';

type Scenario = 'conservative' | 'expected' | 'optimistic';
type Period = 'monthly' | 'annual';

const SCENARIOS: Record<Scenario, { mult: number; followups: boolean; caption: string }> = {
  conservative: { mult: 0.5, followups: false, caption: 'Conservative: estimated time savings counted at 50%; missed-follow-up value counted at $0.' },
  expected: { mult: 0.75, followups: true, caption: 'Expected: estimated time savings counted at 75%.' },
  optimistic: { mult: 1.0, followups: true, caption: 'Optimistic: estimated time savings counted at 100%. Still excludes Impact Card revenue.' },
};

/** Stripe ~2.9% + $0.30 avg ≈ 3.25% effective, plus the 2.50% platform fee
 *  (api/giving/_create-payment-intent.ts PLATFORM_FEE_BPS). Fixed, not
 *  editable — the calculator can't quietly flatter itself on the one
 *  number that's ours to set. */
const GRACE_RATE_PCT = 5.75;
const FOLLOWUP_VALUE_USD = 15;
const WEEKS_PER_MONTH = 52 / 12;

interface Inputs {
  chms: number;
  email: number;
  forms: number;
  texting: number;
  volume: number;
  currentRate: number;
  adminHrs: number;
  dupHrs: number;
  volHrs: number;
  rate: number;
  reductionPct: number;
  followups: number;
  members: number;
}

const DEFAULT_INPUTS: Inputs = {
  chms: 119,
  email: 45,
  forms: 29,
  texting: 25,
  volume: 8000,
  currentRate: 3.4,
  adminHrs: 6,
  dupHrs: 2,
  volHrs: 3,
  rate: 22,
  reductionPct: 40,
  followups: 8,
  members: 240,
};

function recommendedPlan(memberCount: number): PlanSlug {
  if (memberCount <= (CLIENT_PLANS.starter.limits.members ?? Infinity)) return 'starter';
  if (memberCount <= (CLIENT_PLANS.pro.limits.members ?? Infinity)) return 'pro';
  return 'enterprise';
}

function fmt(n: number): string {
  const sign = n < 0 ? '−' : '';
  return sign + '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
}

function NumberField({
  id, label, note, value, onChange, prefix, suffix, disabled, step = 1,
}: {
  id: string; label: string; note?: string; value: number;
  onChange?: (v: number) => void; prefix?: string; suffix?: string;
  disabled?: boolean; step?: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_150px] items-center gap-3.5 py-2.5 border-t border-gray-200 dark:border-dark-700 first:border-t-0">
      <div>
        <label htmlFor={id} className="block text-sm font-semibold text-gray-900 dark:text-dark-100">{label}</label>
        {note && <div className="text-xs text-gray-500 dark:text-dark-400 mt-0.5 max-w-[48ch]">{note}</div>}
      </div>
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-500 text-sm pointer-events-none">{prefix}</span>}
        <input
          id={id}
          type="number"
          min={0}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(Number(e.target.value))}
          className={[
            'w-full rounded-lg border text-right tabular-nums text-[15px]',
            'border-gray-300 dark:border-dark-600 bg-gray-50 dark:bg-dark-850 text-gray-900 dark:text-dark-100',
            'focus:outline-none focus:ring-2 focus:ring-amber-400 dark:focus:ring-amber-500/60',
            prefix ? 'pl-6 pr-2.5 py-2' : suffix ? 'pl-2.5 pr-9 py-2' : 'px-2.5 py-2',
            disabled ? 'opacity-60' : '',
          ].join(' ')}
        />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-500 text-sm pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
}

function Tag({ tone, children }: { tone: 'confirmed' | 'estimated' | 'excluded'; children: React.ReactNode }) {
  const toneClasses = {
    confirmed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    estimated: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    excluded: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  } as const;
  return (
    <span className={`text-[10.5px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

export function ValueCalculator() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const [scenario, setScenario] = useState<Scenario>('expected');
  const [period, setPeriod] = useState<Period>('monthly');
  const [plan, setPlan] = useState<PlanSlug>('pro');
  const [ctaClicked, setCtaClicked] = useState(false);
  const [copied, setCopied] = useState(false);

  const started = useRef(false);
  const editedFields = useRef(new Set<string>());
  const completed = useRef(false);

  const trackStart = () => {
    if (!started.current) { started.current = true; capture('calculator_started'); }
  };

  function set<K extends keyof Inputs>(field: K, value: number) {
    trackStart();
    setInputs((prev) => ({ ...prev, [field]: value }));
    editedFields.current.add(field);
    capture('assumption_changed', { field });
    if (!completed.current && editedFields.current.size >= 3) {
      completed.current = true;
      capture('calculator_completed');
    }
  }

  const m = useMemo(() => {
    const sc = SCENARIOS[scenario];
    const months = period === 'annual' ? 12 : 1;

    const software = inputs.chms + inputs.email + inputs.forms + inputs.texting;
    const feeDelta = (inputs.volume * (inputs.currentRate - GRACE_RATE_PCT)) / 100;
    const hoursValue = (inputs.adminHrs + inputs.dupHrs + inputs.volHrs) * WEEKS_PER_MONTH * inputs.rate * (inputs.reductionPct / 100);
    const followupValue = sc.followups ? inputs.followups * FOLLOWUP_VALUE_USD : 0;
    const estimated = (hoursValue + followupValue) * sc.mult;

    const planPrice = CLIENT_PLANS[plan].priceUsdMonthly;
    const confirmed = software + feeDelta - planPrice;

    return {
      months,
      software: software * months,
      feeDelta: feeDelta * months,
      planPrice: planPrice * months,
      confirmed: confirmed * months,
      estimated: estimated * months,
      net: (confirmed + estimated) * months,
    };
  }, [inputs, scenario, period, plan]);

  const per = period === 'annual' ? '/yr' : '/mo';
  const feeMonthly = m.feeDelta / m.months;
  const members = Math.max(1, inputs.members);
  const rec = recommendedPlan(members);
  const recFits = rec === plan;

  const posC = Math.max(0, m.confirmed);
  const posE = Math.max(0, m.estimated);
  const totPos = posC + posE;
  const cPct = totPos > 0 ? Math.round((100 * posC) / totPos) : 0;

  useEffect(() => {
    if (ctaClicked) setCtaClicked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  function handleScenario(s: Scenario) {
    trackStart();
    setScenario(s);
  }
  function handlePeriod(p: Period) {
    trackStart();
    setPeriod(p);
  }
  function handlePlan(p: PlanSlug) {
    trackStart();
    setPlan(p);
    capture('plan_compared', { plan: p });
  }
  function handleSelect() {
    capture('plan_selected', { plan });
    setCtaClicked(true);
  }
  async function handleCopy() {
    const text = [
      `GRACE value estimate (${scenario} scenario, ${period})`,
      `Software replaced: ${fmt(m.software)}${per}`,
      `Processing fee difference: ${fmt(m.feeDelta)}${per}`,
      `Plan cost (${CLIENT_PLANS[plan].name}): ${fmt(-m.planPrice)}${per}`,
      `Confirmed subtotal: ${fmt(m.confirmed)}${per}`,
      `Estimated time & follow-up value: ${fmt(m.estimated)}${per}`,
      `Impact Card revenue: $0 (excluded until the program is live)`,
      `Net: ${fmt(m.net)}${per}`,
      `These are estimates from your own inputs, not commitments from GRACE.`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API unavailable — the on-screen numbers still stand
    }
    setCopied(true);
    if (!completed.current) { completed.current = true; capture('calculator_completed'); }
    setTimeout(() => setCopied(false), 1600);
  }

  const rows: { lbl: string; sub: string | null; v: number; subtotal?: boolean }[] = [
    { lbl: 'Software replaced', sub: 'confirmed', v: m.software },
    { lbl: 'Processing fee difference', sub: 'confirmed · can be negative', v: m.feeDelta },
    { lbl: `${CLIENT_PLANS[plan].name} plan cost`, sub: 'confirmed', v: -m.planPrice },
    { lbl: 'Confirmed subtotal', sub: null, v: m.confirmed, subtotal: true },
    { lbl: 'Time & follow-up value', sub: `estimated · ${scenario} scenario`, v: m.estimated },
    { lbl: 'Impact Card revenue', sub: 'excluded until live', v: 0 },
  ];

  return (
    <section className="max-w-6xl mx-auto px-4 py-16" aria-labelledby="value-calc-heading">
      <header className="max-w-2xl mb-9">
        <h2 id="value-calc-heading" className="text-3xl md:text-4xl font-light text-gray-900 dark:text-dark-50 mb-3" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          What would GRACE actually be worth to your church?
        </h2>
        <p className="text-gray-600 dark:text-dark-400 mb-3">
          Every number below is an assumption you can edit — nothing is hidden in the math.
          Figures you can verify from your own bills are marked{' '}
          <strong className="text-emerald-700 dark:text-emerald-400">confirmed</strong>; everything that depends
          on how your team adopts GRACE is marked <strong className="text-amber-700 dark:text-amber-400">estimated</strong> and
          shrinks under the conservative scenario.
        </p>
        <span className="inline-block border border-gray-200 dark:border-dark-700 border-l-[3px] border-l-amber-600 dark:border-l-amber-400 bg-white dark:bg-dark-800 rounded-r-lg px-3.5 py-2 text-[13px] text-gray-600 dark:text-dark-300">
          A planning aid, not a pledge — we don't get to guarantee your outcome, so this won't pretend to either.
        </span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* Inputs */}
        <div>
          <div className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-2xl p-5 sm:p-6 pb-3.5 mb-5">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Software you'd replace</h3>
              <Tag tone="confirmed">Confirmed &mdash; check your bills</Tag>
            </div>
            <p className="text-[13px] text-gray-500 dark:text-dark-400 max-w-[58ch] mb-3">
              Subscriptions GRACE replaces outright. These are real invoices you already pay, so they count at full value in every scenario.
            </p>
            <NumberField id="chms" label="Church management software" note="e.g. Planning Center, Breeze, ChurchTrac — your current monthly bill" prefix="$" value={inputs.chms} onChange={(v) => set('chms', v)} />
            <NumberField id="email" label="Email & newsletter tool" note="Mailchimp, Constant Contact, etc." prefix="$" value={inputs.email} onChange={(v) => set('email', v)} />
            <NumberField id="forms" label="Forms, sign-ups & website add-ons" note="Jotform, event registration tools" prefix="$" value={inputs.forms} onChange={(v) => set('forms', v)} />
            <NumberField id="texting" label="Texting / communication service" note="Text-in-church, Clearstream, etc." prefix="$" value={inputs.texting} onChange={(v) => set('texting', v)} />
          </div>

          <div className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-2xl p-5 sm:p-6 pb-3.5 mb-5">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Giving & processing fees</h3>
              <Tag tone="confirmed">Confirmed &mdash; published rates</Tag>
            </div>
            <p className="text-[13px] text-gray-500 dark:text-dark-400 max-w-[58ch] mb-3">
              GRACE charges the standard Stripe rate <strong>plus a 2.50% platform fee</strong> on online gifts.
              Depending on what you pay today, GRACE may cost <em>more</em> here — we show that rather than hide it.
            </p>
            <NumberField id="volume" label="Monthly online giving volume" note="Total processed through your current giving tool" prefix="$" step={100} value={inputs.volume} onChange={(v) => set('volume', v)} />
            <NumberField id="currentRate" label="Your current effective rate" note="All-in: processor % + per-gift fees + any platform cut" suffix="%" step={0.1} value={inputs.currentRate} onChange={(v) => set('currentRate', v)} />
            <NumberField id="graceRate" label="GRACE effective rate" note="Stripe 2.9% + $0.30 avg ≈ 3.25% + GRACE platform fee 2.50% — fixed, not editable, so we can't quietly flatter ourselves" suffix="%" value={GRACE_RATE_PCT} disabled />
            <p className="text-[13.5px] text-gray-600 dark:text-dark-300 border-t border-gray-200 dark:border-dark-700 pt-3 mt-1" aria-live="polite">
              {Math.abs(feeMonthly) < 1 ? (
                'Processing costs are roughly the same either way.'
              ) : feeMonthly < 0 ? (
                <>At these rates GRACE processing costs <strong className="text-red-600 dark:text-red-400 tabular-nums">{fmt(-feeMonthly)}/mo more</strong> than you pay today. The rest of the model has to earn that back.</>
              ) : (
                <>At these rates GRACE processing saves <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">{fmt(feeMonthly)}/mo</strong> versus today.</>
              )}
            </p>
          </div>

          <div className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-2xl p-5 sm:p-6 pb-3.5 mb-5">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Staff & volunteer time</h3>
              <Tag tone="estimated">Estimated &mdash; scenario-scaled</Tag>
            </div>
            <p className="text-[13px] text-gray-500 dark:text-dark-400 max-w-[58ch] mb-3">
              Time GRACE's automation may give back. These are the softest numbers in the model, so the scenario control scales them down — confirmed figures above never move.
            </p>
            <NumberField id="adminHrs" label="Manual admin hours per week" note="Attendance entry, follow-up lists, report assembly" suffix="hrs" step={0.5} value={inputs.adminHrs} onChange={(v) => set('adminHrs', v)} />
            <NumberField id="dupHrs" label="Duplicate data entry per week" note="Re-keying the same people into multiple tools" suffix="hrs" step={0.5} value={inputs.dupHrs} onChange={(v) => set('dupHrs', v)} />
            <NumberField id="volHrs" label="Volunteer coordination per week" note="Scheduling, reminders, swap-finding" suffix="hrs" step={0.5} value={inputs.volHrs} onChange={(v) => set('volHrs', v)} />
            <NumberField id="rate" label="Loaded staff cost per hour" note="Salary + benefits ÷ hours; use $0 if all volunteer-run" prefix="$" value={inputs.rate} onChange={(v) => set('rate', v)} />
            <NumberField id="reduction" label="Share of that time GRACE saves" note="Our adoption assumption — edit it if you think we're optimistic" suffix="%" step={5} value={inputs.reductionPct} onChange={(v) => set('reductionPct', v)} />
            <NumberField id="followups" label="Visitor follow-ups missed per month" note="The most speculative line in this model. Valued at $15 each; worth $0 in the conservative scenario." suffix="/mo" value={inputs.followups} onChange={(v) => set('followups', v)} />
          </div>

          <div className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-2xl p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Impact Card revenue</h3>
              <Tag tone="excluded">Excluded from every scenario</Tag>
            </div>
            <p className="text-[13px] text-gray-500 dark:text-dark-400 max-w-[58ch]">
              The GRACE Impact Card's interchange-revenue model is <strong>not yet live</strong> — it requires a
              banking partner and compliance review. Until real money moves on real rails, this calculator counts
              it as <strong>$0 in all scenarios, including optimistic</strong>. When it launches, we'll add it here
              with its own confirmed numbers.
            </p>
          </div>
        </div>

        {/* Summary */}
        <aside className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-2xl p-5 sm:p-6 lg:sticky lg:top-4" aria-label="Value summary">
          <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100 mb-3.5" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Your numbers</h3>

          <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-lg p-1 mb-2.5" role="group" aria-label="Scenario">
            {(['conservative', 'expected', 'optimistic'] as Scenario[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleScenario(s)}
                aria-pressed={scenario === s}
                className={[
                  'text-xs font-semibold py-1.5 rounded-md capitalize',
                  scenario === s ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-50 shadow-sm' : 'text-gray-500 dark:text-dark-400',
                ].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-dark-400 mb-3.5">{SCENARIOS[scenario].caption}</p>

          <div className="grid grid-cols-2 gap-1 bg-gray-100 dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-lg p-1 mb-3.5" role="group" aria-label="Period">
            {(['monthly', 'annual'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriod(p)}
                aria-pressed={period === p}
                className={[
                  'text-xs font-semibold py-1.5 rounded-md capitalize',
                  period === p ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-50 shadow-sm' : 'text-gray-500 dark:text-dark-400',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
          </div>

          <label htmlFor="planSel" className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-dark-400 mb-1.5">GRACE plan</label>
          <select
            id="planSel"
            value={plan}
            onChange={(e) => handlePlan(e.target.value as PlanSlug)}
            className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-gray-50 dark:bg-dark-850 text-gray-900 dark:text-dark-100 text-sm px-2.5 py-2 mb-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {(Object.keys(CLIENT_PLANS) as PlanSlug[]).map((slug) => {
              const p = CLIENT_PLANS[slug];
              return (
                <option key={slug} value={slug}>
                  {p.name} — ${p.priceUsdMonthly}/mo · {p.limits.members ? `up to ${p.limits.members.toLocaleString()} members` : 'unlimited members'}
                </option>
              );
            })}
          </select>
          <p className="text-[12.5px] text-gray-500 dark:text-dark-400 mb-3.5">
            {recFits ? (
              <><strong className="text-gray-700 dark:text-dark-200">{CLIENT_PLANS[rec].name} fits:</strong> you entered {members.toLocaleString()} people{CLIENT_PLANS[rec].limits.members ? `, within its ${CLIENT_PLANS[rec].limits.members!.toLocaleString()}-member limit.` : '.'}</>
            ) : (
              <>Heads up: at {members.toLocaleString()} people, <strong className="text-gray-700 dark:text-dark-200">{CLIENT_PLANS[rec].name}</strong> is the fit{CLIENT_PLANS[rec].limits.members ? ` (limit ${CLIENT_PLANS[rec].limits.members!.toLocaleString()})` : ''} — you've selected {CLIENT_PLANS[plan].name}.</>
            )}
          </p>

          <NumberField id="members" label="Congregation size" value={inputs.members} suffix="ppl" step={10} onChange={(v) => set('members', v)} />

          <div className="border-t border-gray-200 dark:border-dark-700 mt-1.5 pt-2.5 text-sm" aria-live="polite">
            {rows.map((r) => {
              const cls = r.v > 0.5 ? 'text-emerald-700 dark:text-emerald-400' : r.v < -0.5 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-dark-200';
              return (
                <div key={r.lbl} className={`flex justify-between gap-3 py-1.5 ${r.subtotal ? 'border-t border-dashed border-gray-300 dark:border-dark-600 font-semibold' : ''}`}>
                  <span className="text-gray-600 dark:text-dark-300">
                    {r.lbl}
                    {r.sub && <small className="block text-[11.5px] text-gray-400 dark:text-dark-500">{r.sub}</small>}
                  </span>
                  <span className={`tabular-nums ${cls}`}>{fmt(r.v)}{per}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3.5 p-4 rounded-xl bg-gray-50 dark:bg-dark-850 border border-gray-200 dark:border-dark-700">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-dark-400">Net value &middot; {scenario} &middot; {period}</div>
            <div className={`text-[34px] leading-tight mt-0.5 tabular-nums ${m.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
              {fmt(m.net)}{per}
            </div>
            <p className="text-[13px] text-gray-600 dark:text-dark-300 mt-1.5">
              {m.net >= 0
                ? (m.confirmed >= 0
                    ? <>At these assumptions, GRACE returns more than it costs. {fmt(m.confirmed)}{per} of that is confirmed today.</>
                    : <>At these assumptions, GRACE returns more than it costs — but the entire surplus is estimated. Confirmed items alone run {fmt(m.confirmed)}{per}.</>)
                : <>At these assumptions, GRACE costs more than it saves. That's a legitimate answer — adjust the assumptions or pick a smaller plan.</>}
            </p>
            <div className="flex h-2.5 rounded-full overflow-hidden border border-gray-200 dark:border-dark-700 mt-3" role="img" aria-label={`${cPct}% of modeled value is confirmed, ${100 - cPct}% is estimated`}>
              <div className="bg-emerald-600 dark:bg-emerald-400" style={{ width: `${cPct}%` }} />
              <div
                className="bg-amber-600 dark:bg-amber-400"
                style={{
                  width: `${100 - cPct}%`,
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,.35) 3px, rgba(255,255,255,.35) 6px)',
                }}
              />
            </div>
            <div className="flex gap-4 text-xs text-gray-500 dark:text-dark-400 mt-2">
              <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-400 mr-1.5 align-[-1px]" />Confirmed</span>
              <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-600 dark:bg-amber-400 mr-1.5 align-[-1px]" />Estimated</span>
            </div>
          </div>

          <div className="grid gap-2 mt-4">
            <button
              type="button"
              onClick={handleSelect}
              className="py-2.5 rounded-lg font-semibold text-sm bg-amber-600 hover:bg-amber-700 text-white transition-colors"
            >
              {ctaClicked ? `Continues to /signup?plan=${plan}` : 'Start 14-day trial on this plan'}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="py-2.5 rounded-lg font-semibold text-sm border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors"
            >
              {copied ? 'Copied ✓' : 'Copy summary for your board'}
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-dark-400 mt-3.5 leading-relaxed">
            These numbers move with your inputs, not with our sales targets — what you actually save depends on how
            your team runs GRACE. No card needed for the 14-day trial; cancel anytime from Settings → Billing.
            Direct gifts stay tax-deductible; card interchange, once it's live, won't be.
          </p>
        </aside>
      </div>
    </section>
  );
}
