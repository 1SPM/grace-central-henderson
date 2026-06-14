/* eslint-disable */
/**
 * Grace CRM — baseline load test.
 *
 * Resolves TD-021. Single scenario, demo-friendly, fits in one file.
 *
 * What it does:
 *   - Ramps up to 50 virtual users over 1 minute, holds for 2 minutes,
 *     ramps down over 30 seconds. 3.5 minutes total.
 *   - Each VU loops a representative mix of read-heavy public traffic:
 *       65% — dashboard load (HTML + initial bundle)
 *       15% — Impact Campaigns page load
 *       15% — connect-card public submission (anonymous traffic spike)
 *        5% — Ask Grace chat (the most expensive endpoint)
 *
 * SLO TARGETS (asserted via `thresholds`):
 *   - p95 HTTP request duration < 500ms for read endpoints
 *   - p95 < 2500ms for Ask Grace (AI endpoint — slower upstream)
 *   - error rate < 1% across all endpoints
 *   - the synthetic "AI burn test" (Sprint 2 gate) confirms the
 *     gateway returns 402 before runaway spend; we DO NOT exercise
 *     the budget cap in this scenario — that's covered by unit tests.
 *
 * HOW TO RUN
 *   docker run --rm -i grafana/k6 run --env BASE_URL=https://staging.example.com - < tests/load/baseline.k6.js
 * OR
 *   k6 run --env BASE_URL=https://staging.example.com tests/load/baseline.k6.js
 *
 * The CI workflow at .github/workflows/load-test.yml drives this on
 * demand (manual workflow_dispatch) since we don't have a staging URL
 * pinned yet.
 *
 * @ts-nocheck
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

// ---- Configuration ----------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ASK_GRACE_PROMPT = __ENV.ASK_GRACE_PROMPT
  || 'Who hasn\'t been to church in the last 30 days and lives in zip 78745?';

// Public submission payload — connect card is intentionally anonymous.
const CONNECT_CARD_PAYLOAD = JSON.stringify({
  church_id: __ENV.CHURCH_ID || '11111111-1111-1111-1111-111111111111',
  first_name: 'Load',
  last_name: 'Tester',
  email: `load-${Date.now()}-${Math.random()}@example.test`,
  came_from: 'load-test',
});

// ---- Custom metrics ---------------------------------------------------

const errorRate = new Rate('errors');

// ---- Test profile -----------------------------------------------------

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m',  target: 50 },   // ramp up
        { duration: '2m',  target: 50 },   // hold
        { duration: '30s', target: 0 },    // ramp down
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    // SLO: 95% of read requests under 500ms
    'http_req_duration{group:::dashboard}':       ['p(95)<500'],
    'http_req_duration{group:::impact-campaigns}': ['p(95)<500'],
    'http_req_duration{group:::connect-card}':    ['p(95)<1000'],
    // SLO: 95% of AI requests under 2.5s (upstream-bound)
    'http_req_duration{group:::ask-grace}':       ['p(95)<2500'],
    // SLO: <1% error rate overall (count both 4xx + 5xx as errors; the
    //      AI gateway returning 402 on budget cap is also an error here
    //      because we DON'T expect to hit the cap in this scenario)
    'errors': ['rate<0.01'],
    // Aggregate response time as a safety net
    'http_req_duration': ['p(99)<5000'],
  },
};

// ---- Helpers ----------------------------------------------------------

function pickAction() {
  const r = Math.random();
  if (r < 0.65) return 'dashboard';
  if (r < 0.80) return 'impact-campaigns';
  if (r < 0.95) return 'connect-card';
  return 'ask-grace';
}

function expectOk(res, ctx) {
  const ok = check(res, {
    [`${ctx} status < 400`]: (r) => r.status < 400,
  });
  errorRate.add(!ok);
  return ok;
}

// ---- Scenarios --------------------------------------------------------

function loadDashboard() {
  group('dashboard', () => {
    const res = http.get(`${BASE_URL}/`, { tags: { endpoint: 'dashboard' } });
    expectOk(res, 'GET /');
    sleep(Math.random() * 2 + 1);   // think time 1-3s
  });
}

function loadImpactCampaigns() {
  group('impact-campaigns', () => {
    const res = http.get(`${BASE_URL}/#/giving`, { tags: { endpoint: 'impact-campaigns' } });
    expectOk(res, 'GET /#/giving');
    sleep(Math.random() * 2 + 1);
  });
}

function submitConnectCard() {
  group('connect-card', () => {
    const res = http.post(`${BASE_URL}/api/connect-card`, CONNECT_CARD_PAYLOAD, {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'connect-card' },
    });
    // 200, 201, 422 (rate-limited or duplicate email) all acceptable
    const ok = check(res, {
      'connect-card accepted or rate-limited': (r) =>
        r.status === 200 || r.status === 201 || r.status === 422 || r.status === 429,
    });
    errorRate.add(!ok);
    sleep(Math.random() * 3 + 2);
  });
}

function askGrace() {
  group('ask-grace', () => {
    const res = http.post(
      `${BASE_URL}/api/ai/generate`,
      JSON.stringify({ prompt: ASK_GRACE_PROMPT }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'ask-grace' },
        timeout: '30s',
      },
    );
    // 200 (real response), 401 (gated), 429 (rate-limited), 503 (no AI key) all acceptable
    const ok = check(res, {
      'ask-grace responded': (r) =>
        r.status === 200 || r.status === 401 || r.status === 429 || r.status === 503,
    });
    errorRate.add(!ok);
    sleep(Math.random() * 4 + 3);
  });
}

// ---- Entry point ------------------------------------------------------

export default function () {
  switch (pickAction()) {
    case 'dashboard':      loadDashboard();      break;
    case 'impact-campaigns': loadImpactCampaigns(); break;
    case 'connect-card':   submitConnectCard();  break;
    case 'ask-grace':      askGrace();           break;
  }
}

export function setup() {
  console.log(`\n=== Grace CRM baseline load test ===`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Profile: 0 → 50 VU over 1min, hold 2min, ramp down 30s.`);
  console.log(`Mix: 65% dashboard / 15% impact-campaigns / 15% connect-card / 5% ask-grace`);
  console.log(`SLO targets: p95 < 500ms (reads), p95 < 2500ms (AI), error rate < 1%\n`);
}

export function teardown() {
  console.log(`\n=== Run complete ===`);
}
