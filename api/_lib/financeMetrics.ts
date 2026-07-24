/**
 * Program vs. general & administrative expense ratio.
 *
 * A standard nonprofit transparency metric — the same split a charity
 * rater or an audited "statement of functional expenses" uses. Pure
 * function: the route handler (api/finance/_expenses.ts) fetches rows
 * from `expenses`; this module turns them into the ratio. No IO —
 * directly unit-testable.
 */

export interface ExpenseRow {
  functional_category: 'program' | 'g_and_a';
  amount: number;
}

export interface ExpenseRatio {
  program_total: number;
  g_and_a_total: number;
  total: number;
  /** program_total / total, or null when total is 0 (nothing recorded yet). */
  program_ratio: number | null;
}

export function computeExpenseRatio(rows: ExpenseRow[]): ExpenseRatio {
  let programTotal = 0;
  let gAndATotal = 0;
  for (const row of rows) {
    if (row.functional_category === 'program') programTotal += row.amount;
    else gAndATotal += row.amount;
  }
  const total = programTotal + gAndATotal;
  return {
    program_total: programTotal,
    g_and_a_total: gAndATotal,
    total,
    program_ratio: total > 0 ? programTotal / total : null,
  };
}
