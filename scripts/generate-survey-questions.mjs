/* Generates the browser copy of the pilot survey questions from the single
 * source of truth in api/_lib/pilotSurvey.ts.
 *
 * The form and the server validation must agree exactly: a question the client
 * shows but the server rejects is a 400 in front of a member who has just
 * answered it. Rather than maintain the list twice, generate one from the
 * other and let scripts/test-pilot-survey.mjs fail if they drift.
 *
 *   node scripts/generate-survey-questions.mjs
 */
import fs from 'node:fs';
import { MEMBER_SURVEY } from '../api/_lib/pilotSurvey.ts';

const OUT = 'apps/member-web/public/shared/grace-pilot-survey-questions.js';

const body = MEMBER_SURVEY.map(q => {
  const parts = [`key:${JSON.stringify(q.key)}`, `text:${JSON.stringify(q.text)}`, `type:${JSON.stringify(q.type)}`];
  if (q.low) parts.push(`low:${JSON.stringify(q.low)}`);
  if (q.high) parts.push(`high:${JSON.stringify(q.high)}`);
  if (q.options) parts.push(`options:${JSON.stringify(q.options)}`);
  if (q.maxLength) parts.push(`maxLength:${q.maxLength}`);
  return `  {${parts.join(',')}}`;
}).join(',\n');

fs.writeFileSync(OUT,
`/* GENERATED — do not edit.
 * Source: api/_lib/pilotSurvey.ts
 * Regenerate: node scripts/generate-survey-questions.mjs
 * Drift is caught by scripts/test-pilot-survey.mjs. */
window.GRACE_PILOT_SURVEY_QUESTIONS = [
${body}
];
`);
console.log(`wrote ${OUT} (${MEMBER_SURVEY.length} questions)`);
