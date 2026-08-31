/**
 * Frozen, hand-mirrored copy of the 10×7 grid from
 * docs/GRACE_INTELLIGENCE_QUALIFICATION_FRAMEWORK.md §2 ("GRACE Capability
 * Baseline — 2026-08-31" era), in machine-readable form.
 *
 * Deliberately duplicated data — same precedent as FIXTURE_ROLE_PERMISSIONS
 * in tests/fixtures/shared-platform.ts: a mismatch between this file and
 * the doc should surface as a loud test failure, not a silent tautology.
 *
 * Changing a cell here is its own deliberate act, tied to a real fixture
 * that actually earns the change (and should update the doc's own table in
 * the same PR) — never a side effect of adding EvalCases elsewhere. This
 * file has no cases, no fixtures, no runtime logic: it exists purely so
 * runner.ts's capability-baseline renderer can report FUTURE / NOT YET
 * PROVEN for a grid cell that has zero cases at all, not just aggregate
 * whatever cases happen to exist.
 */
import type { Classification, IntelligenceLevel, KnowledgeDomain } from './types.js';

const LEVELS: IntelligenceLevel[] = ['KNOW', 'REMEMBER', 'CONNECT', 'INTERPRET', 'RECOMMEND', 'ACT', 'ANTICIPATE'];

/** T/P/F shorthand exactly as the doc's table renders it, expanded below. */
type Row = [Classification, Classification, Classification, Classification, Classification, Classification, Classification];

const T: Classification = 'testable';
const P: Classification = 'partial';
const F: Classification = 'future';

const ROWS: Record<KnowledgeDomain, Row> = {
  //                       KNOW REMEMBER CONNECT INTERPRET RECOMMEND ACT ANTICIPATE
  church_identity:            [T, T, P, P, F, F, F],
  people_households:          [T, T, F, F, T, T, F], // REMEMBER flipped P→T by Fixture #003 (2026-08-31)
  ministry_discipleship:      [P, F, F, F, F, F, F],
  pastoral_care:               [T, T, P, F, T, T, F], // REMEMBER flipped P→T, CONNECT corrected T→P by Fixture #004 (2026-08-31)
  sunday_worship:              [P, F, F, F, F, F, F],
  events_calendar:             [T, F, F, F, T, T, F],
  giving_finance:              [P, F, F, F, F, F, F],
  staff_work:                  [P, F, F, F, T, T, F],
  communications:               [F, F, F, F, P, T, F],
  governance_security_authority: [T, T, T, P, T, T, F],
};

export const FRAMEWORK_GRID: Record<KnowledgeDomain, Record<IntelligenceLevel, Classification>> =
  Object.fromEntries(
    (Object.entries(ROWS) as [KnowledgeDomain, Row][]).map(([domain, row]) => [
      domain,
      Object.fromEntries(LEVELS.map((level, i) => [level, row[i]])) as Record<IntelligenceLevel, Classification>,
    ]),
  ) as Record<KnowledgeDomain, Record<IntelligenceLevel, Classification>>;

export const ALL_DOMAINS: KnowledgeDomain[] = Object.keys(ROWS) as KnowledgeDomain[];
export const ALL_LEVELS: IntelligenceLevel[] = LEVELS;

export function gridClassification(domain: KnowledgeDomain, level: IntelligenceLevel): Classification {
  return FRAMEWORK_GRID[domain][level];
}
