/**
 * GRACE Intelligence Qualification Framework — evaluation-case types.
 *
 * See docs/GRACE_INTELLIGENCE_QUALIFICATION_FRAMEWORK.md and ADR-016
 * (DECISIONS.md) for the framework this harness measures cells of.
 *
 * This module is deliberately fixture-agnostic: nothing here knows about
 * Central Henderson, governance/security, or any other specific church or
 * domain. A future fixture is a new `fixtures/*.cases.ts` file exporting
 * `EvalCase[]` — this file, scoring.ts, and runner.ts never change for that.
 */

/** The 10 knowledge domains from the framework doc's §2 grid. */
export type KnowledgeDomain =
  | 'church_identity'
  | 'people_households'
  | 'ministry_discipleship'
  | 'pastoral_care'
  | 'sunday_worship'
  | 'events_calendar'
  | 'giving_finance'
  | 'staff_work'
  | 'communications'
  | 'governance_security_authority';

/** The 7 intelligence levels, KNOW being the least sophisticated. */
export type IntelligenceLevel =
  | 'KNOW'
  | 'REMEMBER'
  | 'CONNECT'
  | 'INTERPRET'
  | 'RECOMMEND'
  | 'ACT'
  | 'ANTICIPATE';

/**
 * The framework doc's three-way split for a grid cell. Keep 'partial' and
 * 'not_yet_testable' distinct — they mean different things (partial
 * grounding vs. no grounding mechanism at all) and collapsing them loses
 * exactly the honesty the framework exists to preserve.
 */
export type Classification = 'testable' | 'partial' | 'future' | 'not_yet_testable';

/**
 * What a case's proof actually rests on:
 *  - 'mock'           tests/fixtures/mockSupabase.ts, whose `.eq()`/`.in()`/
 *                      etc. are no-ops — cannot prove real RLS/church-scope
 *                      enforcement, only that the code path was exercised
 *                      with the right shape of call.
 *  - 'live_db'         a real Postgres/RLS guarantee (this harness's
 *                      deterministic tier does not build any such case
 *                      itself — see the existing tools/*-smoke.test.ts
 *                      files for that layer).
 *  - 'static_catalog'  a check against a static, in-process source (the
 *                      action catalog, a source file's literal text) with
 *                      no Supabase mock involved at all.
 */
export type ProofBoundary = 'mock' | 'live_db' | 'static_catalog';

export interface EvalCase {
  /** Stable, unique, kebab-case. Shown in every report. */
  id: string;
  /** Which fixture this case belongs to, e.g. 'fixture-001-central-henderson'. */
  fixture: string;
  domain: KnowledgeDomain;
  level: IntelligenceLevel;
  classification: Classification;
  /**
   * True for CONNECT/INTERPRET/RECOMMEND-reasoning/ANTICIPATE-shaped cases
   * where only a live model call could actually prove the claimed
   * behavior. Such a case may still exist here (for tracking/reporting)
   * but MUST NOT carry a `run` — see runner.ts's NOT_RUN handling.
   */
  requiresLiveJudgment: boolean;
  proofBoundary: ProofBoundary;
  /**
   * A case whose failure represents a safety/authority violation (a
   * tenant-isolation leak, a permission bypass, a hallucinated figure)
   * rather than an ordinary content-quality gap. Such a case's `run()`
   * must grade a violation with dangerousFailure()/combineWithSafetyOverride
   * from scoring.ts, never a plain fail().
   */
  isSafetyCritical?: boolean;
  /**
   * True for a case that documents a known, accepted architectural
   * mismatch (e.g. send_email's permission model) rather than proving a
   * capability. Never counts toward PROVEN in the capability baseline,
   * regardless of grade.
   */
  isArchitecturalFinding?: boolean;

  tenant: { churchId: string; label: string };
  actor: { label: string; permission?: string } | 'unauthenticated';
  requiredSources?: string[];
  sourceScope?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  expectedBehavior: string;
  prohibitedBehavior?: string;
  permissionRequirements?: string;
  actionExpectations?: string;
  provenanceExpectations?: string;

  /**
   * Optional on purpose. Absent when requiresLiveJudgment is true and no
   * live-judgment harness exists yet (this phase never builds one) — the
   * runner must report such a case as NOT_RUN, never fabricate a pass.
   */
  run?: () => Promise<EvalOutcome>;
}

export interface EvalOutcome {
  grade: 'PASS' | 'PARTIAL' | 'FAIL';
  /** 0-5 per the framework's rubric; optional — not every case needs one. */
  score?: 0 | 1 | 2 | 3 | 4 | 5;
  evidence: string[];
  failureReason?: string;
  /** Set when this FAIL specifically represents a safety/authority violation. */
  safetyViolation?: boolean;
}

export type EvalResultOutcome = EvalOutcome | { grade: 'NOT_RUN'; reason: string };

export interface EvalResult {
  id: string;
  fixture: string;
  domain: KnowledgeDomain;
  level: IntelligenceLevel;
  classification: Classification;
  requiresLiveJudgment: boolean;
  proofBoundary: ProofBoundary;
  isSafetyCritical: boolean;
  isArchitecturalFinding: boolean;
  outcome: EvalResultOutcome;
}
