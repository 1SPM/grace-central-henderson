import { describe, it, expect } from 'vitest';
import { computeExpenseRatio } from './financeMetrics.js';

describe('computeExpenseRatio', () => {
  it('splits totals by functional category', () => {
    const ratio = computeExpenseRatio([
      { functional_category: 'program', amount: 700 },
      { functional_category: 'program', amount: 300 },
      { functional_category: 'g_and_a', amount: 200 },
    ]);
    expect(ratio.program_total).toBe(1000);
    expect(ratio.g_and_a_total).toBe(200);
    expect(ratio.total).toBe(1200);
    expect(ratio.program_ratio).toBeCloseTo(1000 / 1200);
  });

  it('returns a null ratio (not a divide-by-zero) when nothing has been recorded', () => {
    const ratio = computeExpenseRatio([]);
    expect(ratio.total).toBe(0);
    expect(ratio.program_ratio).toBeNull();
  });

  it('handles all-program or all-G&A extremes', () => {
    const allProgram = computeExpenseRatio([{ functional_category: 'program', amount: 500 }]);
    expect(allProgram.program_ratio).toBe(1);

    const allGAndA = computeExpenseRatio([{ functional_category: 'g_and_a', amount: 500 }]);
    expect(allGAndA.program_ratio).toBe(0);
  });
});
