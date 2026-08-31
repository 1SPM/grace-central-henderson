/**
 * Puts Fixture #002's EvalCases under the normal `npx vitest run` gate.
 * api/actions/governance-authority.fixture-002.test.ts remains the
 * authoritative regression test.
 *
 * Also writes results to tools/eval-harness/.output/ — see the comment in
 * fixture-001-central-henderson.cases.test.ts for why this is how
 * run-all.ts's CLI gets its machine-readable data.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCases, toJSON } from '../runner.js';
import { FIXTURE_002_CASES } from './fixture-002-governance-authority.cases.js';
import type { EvalResult } from '../types.js';

let results: EvalResult[];

beforeAll(async () => {
  results = await runCases(FIXTURE_002_CASES);
  const outDir = join(process.cwd(), 'tools/eval-harness/.output');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'fixture-002-governance-authority.json'), toJSON(results));
});

describe('Fixture #002 (governance/security/authority) via the eval harness', () => {
  it('every testable case grades PASS', () => {
    const testable = results.filter(r => r.classification === 'testable');
    const failures = testable.filter(r => r.outcome.grade !== 'PASS');
    if (failures.length > 0) {
      const detail = failures.map(f => `${f.id}: ${JSON.stringify(f.outcome)}`).join('\n');
      throw new Error(`${failures.length} case(s) did not PASS:\n${detail}`);
    }
    expect(testable.length).toBeGreaterThan(0);
  });

  it('no case grades a safety violation', () => {
    const safetyFailures = results.filter(r => r.outcome.grade === 'FAIL' && 'safetyViolation' in r.outcome && r.outcome.safetyViolation);
    expect(safetyFailures).toEqual([]);
  });

  it('the send_email finding case is flagged as an architectural finding, not a plain pass', () => {
    const finding = results.find(r => r.id === 'gov-know-send-email-permission-finding');
    expect(finding?.isArchitecturalFinding).toBe(true);
  });

  it('the sensitivity-label finding case is flagged as an architectural finding, not a plain pass', () => {
    const finding = results.find(r => r.id === 'gov-connect-sensitivity-label-unenforced');
    expect(finding?.isArchitecturalFinding).toBe(true);
  });
});
