/**
 * Central Henderson-specific scorecard, built ONLY from this exam's own
 * results — deliberately NOT blended with the other 6 fixtures'
 * `run-all.ts` baseline. Those fixtures mostly run against the generic
 * `FIXTURE_CHURCH_ID` test tenant, not the real Central Henderson
 * church_id — this scorecard answers "what has been proven specifically
 * about Central Henderson's real data," a narrower and more honest
 * question than "does the mechanism work in general" (which is what the
 * other fixtures already answer, and this scorecard doesn't re-litigate).
 *
 * Duplicates runner.ts's per-cell PROVEN/PARTIAL/NOT-YET-PROVEN/FUTURE
 * logic locally rather than exporting it from runner.ts — same
 * established precedent as _shared-chat-harness.ts duplicating the
 * authoritative fixture test's plumbing rather than importing it, so
 * runner.ts stays untouched and fixture-agnostic.
 */
import { ALL_DOMAINS, ALL_LEVELS, gridClassification } from '../framework-grid.js';
import type { EvalResult, IntelligenceLevel, KnowledgeDomain } from '../types.js';

export type DomainStatus = 'PROVEN' | 'PARTIAL' | 'NOT YET PROVEN' | 'FUTURE';

export interface DomainScorecardEntry {
  domain: KnowledgeDomain;
  status: DomainStatus;
  highestLevelProven: IntelligenceLevel | null;
  caseCount: number;
  passCount: number;
  partialCount: number;
  failCount: number;
  notRunCount: number;
  hasSafetyCriticalFailure: boolean;
  architecturalFindingIds: string[];
}

export interface ChurchScorecard {
  church: string;
  generatedFrom: string;
  domains: DomainScorecardEntry[];
  safetyCriticalFailures: Array<{
    id: string; domain: KnowledgeDomain; level: IntelligenceLevel;
    failureReason?: string; evidence: string[];
  }>;
}

function isProven(r: EvalResult): boolean {
  return r.outcome.grade === 'PASS' && !r.requiresLiveJudgment && !r.isArchitecturalFinding;
}

function cellStatus(domain: KnowledgeDomain, level: IntelligenceLevel, cellResults: EvalResult[]): DomainStatus {
  const gridClass = gridClassification(domain, level);
  if (gridClass === 'future') return 'FUTURE';
  if (cellResults.length === 0) return 'NOT YET PROVEN';
  if (cellResults.some(isProven)) {
    return cellResults.every(isProven) ? (gridClass === 'partial' ? 'PARTIAL' : 'PROVEN') : 'PARTIAL';
  }
  if (cellResults.some(r => r.outcome.grade === 'PARTIAL')) return 'PARTIAL';
  return 'NOT YET PROVEN';
}

export function buildChurchScorecard(results: EvalResult[]): ChurchScorecard {
  const byDomain = new Map<KnowledgeDomain, EvalResult[]>();
  for (const r of results) {
    if (!byDomain.has(r.domain)) byDomain.set(r.domain, []);
    byDomain.get(r.domain)!.push(r);
  }

  const domains: DomainScorecardEntry[] = ALL_DOMAINS.map(domain => {
    const domainResults = byDomain.get(domain) ?? [];
    const byLevel = new Map<IntelligenceLevel, EvalResult[]>();
    for (const r of domainResults) {
      if (!byLevel.has(r.level)) byLevel.set(r.level, []);
      byLevel.get(r.level)!.push(r);
    }

    const cellStatuses = ALL_LEVELS.map(level => ({ level, status: cellStatus(domain, level, byLevel.get(level) ?? []) }));
    const applicableCells = cellStatuses.filter(c => c.status !== 'FUTURE');

    let highestLevelProven: IntelligenceLevel | null = null;
    for (const { level, status } of cellStatuses) {
      if (status === 'PROVEN') highestLevelProven = level; // ALL_LEVELS is KNOW→ANTICIPATE order, so the last match is highest
    }

    let status: DomainStatus;
    if (applicableCells.length === 0) {
      status = 'FUTURE';
    } else if (highestLevelProven === null) {
      status = 'NOT YET PROVEN';
    } else if (applicableCells.every(c => c.status === 'PROVEN')) {
      status = 'PROVEN';
    } else {
      status = 'PARTIAL';
    }

    return {
      domain,
      status,
      highestLevelProven,
      caseCount: domainResults.length,
      passCount: domainResults.filter(r => r.outcome.grade === 'PASS').length,
      partialCount: domainResults.filter(r => r.outcome.grade === 'PARTIAL').length,
      failCount: domainResults.filter(r => r.outcome.grade === 'FAIL').length,
      notRunCount: domainResults.filter(r => r.outcome.grade === 'NOT_RUN').length,
      hasSafetyCriticalFailure: domainResults.some(r => r.isSafetyCritical && r.outcome.grade === 'FAIL'),
      architecturalFindingIds: domainResults.filter(r => r.isArchitecturalFinding).map(r => r.id),
    };
  });

  const safetyCriticalFailures = results
    .filter(r => r.isSafetyCritical && r.outcome.grade === 'FAIL')
    .map(r => ({
      id: r.id, domain: r.domain, level: r.level,
      failureReason: 'failureReason' in r.outcome ? r.outcome.failureReason : undefined,
      evidence: 'evidence' in r.outcome ? r.outcome.evidence : [],
    }));

  return { church: 'Central Henderson', generatedFrom: 'central-henderson-exam', domains, safetyCriticalFailures };
}

export function renderScorecardMarkdown(sc: ChurchScorecard): string {
  const lines: string[] = [];
  lines.push(`# ${sc.church} GRACE Qualification Scorecard`);
  lines.push('');
  lines.push('Scoped ONLY to this exam\'s own cases, run against the real Central Henderson tenant — not blended with the other fixtures\' generic-tenant results. A "NOT YET PROVEN" here can mean the underlying mechanism is proven elsewhere (a different fixture, a generic test church) but was not specifically re-exercised against Central Henderson\'s real data by this exam.');
  lines.push('');

  // Safety-critical failures print FIRST, unconditionally — never averaged
  // away by a domain's otherwise-good scores.
  lines.push('## Safety-Critical Failures');
  if (sc.safetyCriticalFailures.length === 0) {
    lines.push('None.');
  } else {
    for (const f of sc.safetyCriticalFailures) {
      lines.push(`- **${f.id}** (${f.domain}/${f.level}): ${f.failureReason ?? 'no reason recorded'}`);
      for (const e of f.evidence) lines.push(`  - evidence: ${e}`);
    }
  }
  lines.push('');

  lines.push('## Domain Scorecard');
  lines.push('| Domain | Status | Highest Level Proven | Cases | Pass | Partial | Fail | Not Run | Safety FAIL | Findings |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const d of sc.domains) {
    lines.push(`| ${d.domain} | ${d.status} | ${d.highestLevelProven ?? '—'} | ${d.caseCount} | ${d.passCount} | ${d.partialCount} | ${d.failCount} | ${d.notRunCount} | ${d.hasSafetyCriticalFailure ? 'YES' : 'no'} | ${d.architecturalFindingIds.length} |`);
  }
  return lines.join('\n');
}
