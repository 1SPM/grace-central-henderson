/**
 * Literal copy of supabase/migrations/076_grace_knowledge.sql's real,
 * live Central Henderson seed — all 10 rows, verbatim content and
 * source_label text.
 *
 * DELIBERATELY NOT REUSING tools/eval-harness/fixtures/fixture-001-central-henderson.cases.ts's
 * HENDERSON_KNOWLEDGE_ROWS: that constant is a hand-authored 7-row
 * approximation (missing vision-summary, affiliate-activity-out-of-scope,
 * and legal-tax-status-unverified entirely, and worded differently from
 * the real migration in places) — it mirrors the authoritative fixture
 * test's own synthetic data, not migration 076 itself. This exam's own
 * grounding rule ("use ONLY authoritative Central Henderson sources") is
 * violated if it silently imports an approximation, so it gets its own
 * literal copy instead. Fixture #001 is left completely untouched either
 * way — this file does not import from or edit it.
 *
 * If this file and the real migration ever diverge, this file is stale —
 * fix the copy, never treat migration 076 as the thing to change to match
 * a test.
 */

export const HENDERSON_CHURCH_ID = '11111111-1111-1111-1111-111111111111';

export const REAL_HENDERSON_KNOWLEDGE_SEED = [
  {
    id: 'k-catalyst', category: 'identity', title: 'Central Henderson is the catalyst church',
    content: 'Central Henderson, Nevada is Central Christian Church\'s catalyst church. Central describes itself as "one church in many locations." Central Henderson is an independent, non-denominational church.',
    source_label: 'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements, entity & mission context (PDF pp. 7-10). Reviewed source extract; identity/mission content only, no financial figures.',
  },
  {
    id: 'k-mission', category: 'mission', title: 'Central\'s mission',
    content: '"We exist to introduce people to Jesus and help them follow Him."',
    source_label: 'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements (PDF pp. 7-10). Reviewed source extract.',
  },
  {
    id: 'k-vision', category: 'mission', title: 'Vision',
    content: 'A movement of God\'s grace through reproducible environments where the good news of Jesus is shared, life change is experienced, and God\'s light shines across the Las Vegas valley and beyond.',
    source_label: 'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements (PDF pp. 7-10). Reviewed source extract.',
  },
  {
    id: 'k-strategy', category: 'strategy', title: 'Central\'s four-part strategy — navigation language only',
    content: 'Attend the weekend to experience God. Invite a friend to share hope. Take a next step to follow Jesus. Give generously to rescue others. Use this as next-step / navigation language only — never as a behavioral score, ranking, or eligibility rule for any person.',
    source_label: 'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements (PDF pp. 7-10). Reviewed source extract.',
  },
  {
    id: 'k-ownership', category: 'ownership_path', title: 'Ownership path',
    content: 'Receive salvation. Be baptized by immersion. Complete First Step.',
    source_label: 'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements (PDF pp. 7-10). Reviewed source extract.',
  },
  {
    id: 'k-financials-scope', category: 'scope_boundary', title: 'Consolidated financials are not Henderson-specific',
    content: 'All financial statements, ratios, revenue, expenses, assets, liabilities, liquidity, debt, donor restrictions, gift-in-kind activity, and ministry outcomes in the FY2024 audited report describe Central Christian Church and Affiliates on a CONSOLIDATED basis, not Central Henderson specifically. If referenced at all, label it "Central Christian Church and Affiliates - consolidated FY2024." No authorized Henderson-specific financial source exists in this knowledge base — do not answer a Henderson-specific revenue, expense, debt, or budget question using this data.',
    source_label: 'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements, scope guardrail (source metadata, not the underlying figures).',
  },
  {
    id: 'k-affiliate-scope', category: 'scope_boundary', title: 'Affiliate and other-campus activity is not Henderson-specific',
    content: 'Affiliate, other-campus, online, prison-ministry, Central Global, Hope For The City, and Central Australasia activity described in the FY2024 audited report is not specific to Central Henderson.',
    source_label: 'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements, scope guardrail.',
  },
  {
    id: 'k-campus-metrics-scope', category: 'scope_boundary', title: 'Campus-specific metrics require an authorized Henderson source',
    content: 'Do not infer Henderson attendance, giving, household need, ministry impact, budget, debt, or staff capacity from the consolidated FY2024 report. Any Henderson campus-specific metric, financial workflow, or public claim requires an authorized Central Henderson-specific source before it can be stated.',
    source_label: 'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements, scope guardrail.',
  },
  {
    id: 'k-giving-care-scope', category: 'scope_boundary', title: 'Giving, care, and spiritual-conversation data stays permissioned',
    content: 'This knowledge entry is public mission/identity context only. It is never a source for any individual member\'s giving history, care history, or spiritual-conversation content — that data, where it exists, is permissioned elsewhere and must never be inferred or fabricated from this entry.',
    source_label: 'Grace product constraint, derived from the source-scoped fixture\'s access rules.',
  },
  {
    id: 'k-legal-tax-scope', category: 'scope_boundary', title: 'Legal/tax status needs workflow-specific verification',
    content: 'Central Christian Church and Hope For The City are described as US 501(c)(3) public charities in the FY2024 audited report. Use this only after legal/operations verification for the specific workflow it would support — do not state it as a general fact without that verification.',
    source_label: 'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements, legal/tax context (PDF pp. 7-10).',
  },
];
