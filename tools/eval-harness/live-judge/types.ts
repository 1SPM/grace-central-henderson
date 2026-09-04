/**
 * The live-judgment tier — CONNECT/INTERPRET/RECOMMEND-reasoning/ANTICIPATE
 * claims the deterministic tier structurally cannot prove (see the
 * "Level-inflation" risk named in docs/GRACE_INTELLIGENCE_QUALIFICATION_FRAMEWORK.md).
 *
 * Deliberately separate from tools/eval-harness/types.ts's EvalCase/
 * runCases — a live-judge result is NON-DETERMINISTIC (a real model call,
 * graded by a second real model call) and must never be gate-able or
 * conflated with a deterministic PASS/FAIL. Every result carries
 * `advisory: true` for exactly that reason. Not wired into CI — see
 * run.ts's header comment for why, and how to run it manually.
 */
import type { KnowledgeDomain, IntelligenceLevel } from '../types.js';
import type { GraceData } from '../../../src/contexts/GraceChatContext.js';

export interface LiveJudgeCase {
  id: string;
  fixture: string;
  domain: KnowledgeDomain;
  level: IntelligenceLevel;
  /** Synthetic church data — buildDataContext() composes this into the
   *  real dataContext string, same as the production client does. */
  scenarioData: GraceData;
  /** Synthetic grace_knowledge rows (ADR-015) — server-composed, seeded
   *  into the mock Supabase's grace_knowledge table. Optional: most
   *  scenarios don't need church-knowledge content. */
  knowledgeRows?: unknown[];
  /** The staff member's message to Ask GRACE. */
  question: string;
  /** What a correct answer must do — handed to the judge verbatim, not
   *  interpreted by this code. Plain prose, not a scoring formula. */
  rubric: string;
  /** One sentence on why this specific scenario tests the claimed level. */
  intent: string;
}

export interface LiveJudgeResult {
  id: string;
  fixture: string;
  domain: KnowledgeDomain;
  level: IntelligenceLevel;
  advisory: true;
  verdict: 'pass' | 'fail' | 'error' | 'skipped';
  modelAnswer?: string;
  judgeReasoning?: string;
  detail?: string;
}

/**
 * N independent runs of the same case, aggregated. A single LiveJudgeResult
 * was never meant to be read as "always works" — this is what makes that
 * variance visible and countable instead of something only noticed by
 * manually re-running (see Fixtures #001/#002's scenarios once run more
 * than once: 1-PASS/3-FAIL and 1-PASS/1-FAIL respectively).
 *
 * passRate is pass / (pass + fail) — DEFINITIVE verdicts only. error/
 * skipped runs are surfaced in their own counts, never silently folded
 * into either side of the rate (an API error is not a judged failure).
 */
export interface LiveJudgeSampledResult {
  id: string;
  fixture: string;
  domain: KnowledgeDomain;
  level: IntelligenceLevel;
  samples: LiveJudgeResult[];
  passCount: number;
  failCount: number;
  errorCount: number;
  skippedCount: number;
  /** null when there are zero definitive (pass/fail) verdicts to rate. */
  passRate: number | null;
}
