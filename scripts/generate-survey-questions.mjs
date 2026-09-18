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
import { SURVEY_TRACKS, TENANT_SURVEY_TRACKS } from '../api/_lib/pilotSurvey.ts';

const OUT = 'apps/member-web/public/shared/grace-pilot-survey-questions.js';

const q = one => {
  const parts = [`key:${JSON.stringify(one.key)}`, `text:${JSON.stringify(one.text)}`, `type:${JSON.stringify(one.type)}`];
  if (one.low) parts.push(`low:${JSON.stringify(one.low)}`);
  if (one.high) parts.push(`high:${JSON.stringify(one.high)}`);
  if (one.options) parts.push(`options:${JSON.stringify(one.options)}`);
  if (one.maxLength) parts.push(`maxLength:${one.maxLength}`);
  return `    {${parts.join(',')}}`;
};

const groups = Object.entries(SURVEY_TRACKS)
  .map(([track, questions]) => `  ${JSON.stringify(track)}: [\n${questions.map(q).join(',\n')}\n  ]`)
  .join(',\n');

fs.writeFileSync(OUT,
`/* GENERATED — do not edit.
 * Source: api/_lib/pilotSurvey.ts
 * Regenerate: node scripts/generate-survey-questions.mjs
 * Drift is caught by scripts/test-pilot-survey.mjs. */
window.GRACE_PILOT_SURVEY_TRACKS = {
${groups}
};
/* Which group each tenant's portal shows. Faithful has its own so its form
 * never names another church and can ask about the "Let us know" onboarding. */
window.GRACE_PILOT_SURVEY_TENANT_TRACKS = ${JSON.stringify(TENANT_SURVEY_TRACKS, null, 2).replace(/\n/g, '\n')};
`);
console.log(`wrote ${OUT} (` + Object.entries(SURVEY_TRACKS).map(([t, qs]) => `${t}: ${qs.length}`).join(', ') + ')');
