/* The pilot member survey (Track C).
 *
 * The load-bearing checks, in order of what would hurt most if it broke:
 *   1. The browser question list has not drifted from api/_lib/pilotSurvey.ts.
 *      Drift means the form shows a question the server 400s on, in front of a
 *      member who has just answered it.
 *   2. Nothing claims a save that did not happen — the same truthfulness rule
 *      the care and giving paths are held to.
 *   3. No identity leaves the page: no name, no email, no person id, and a
 *      respondent key that is random rather than derived from anything.
 *   4. Every question is skippable, because the participant script promises it.
 */
import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {MEMBER_SURVEY, FAITHFUL_MEMBER_SURVEY, SURVEY_TRACKS, TENANT_SURVEY_TRACKS,
        validateAnswers, MAX_TOTAL_TEXT} from '../api/_lib/pilotSurvey.ts';

// The JSDOM run below loads the Faithful portal's URL, so that is the group it
// must render. Central's is checked separately at the end.
const EXPECTED = FAITHFUL_MEMBER_SURVEY;

const GENERATED = 'apps/member-web/public/shared/grace-pilot-survey-questions.js';

// ── 1. no drift between the server list and the browser copy ────────────────
{
  const committed = fs.readFileSync(GENERATED, 'utf8');
  execFileSync(process.execPath, ['scripts/generate-survey-questions.mjs'], {stdio: 'pipe'});
  const regenerated = fs.readFileSync(GENERATED, 'utf8');
  if (regenerated !== committed) {
    fs.writeFileSync(GENERATED, committed);   // leave the tree as we found it
    assert.fail(`${GENERATED} is stale — run: node scripts/generate-survey-questions.mjs`);
  }
}

// ── the page ────────────────────────────────────────────────────────────────
const dom = new JSDOM('<div data-grace-pilot-survey></div>', {
  url: 'https://grace-members.vercel.app/tenants/faithful/member-portal.html',
  runScripts: 'outside-only',
});
const w = dom.window, d = w.document;
w.eval(fs.readFileSync(GENERATED, 'utf8'));

const posted = [];
let nextResponse = () => ({ok: true, json: async () => ({ok: true})});
w.fetch = (url, init) => {
  posted.push({url, body: JSON.parse(init.body)});
  return Promise.resolve(nextResponse());
};
w.eval(fs.readFileSync('apps/member-web/public/shared/grace-pilot-survey.js', 'utf8'));

const form = d.querySelector('.gps-form');
assert(form, 'the survey mounts into [data-grace-pilot-survey]');
assert.equal(d.querySelectorAll('[data-answer]').length >= EXPECTED.length, true);
assert.equal(new Set([...d.querySelectorAll('[data-answer]')].map(n => n.getAttribute('data-answer'))).size,
  EXPECTED.length, `all ${EXPECTED.length} questions render, once each`);
assert.equal(w.GRACE_PILOT_SURVEY.getTrack(), 'members_faithful',
  'the Faithful portal answers its own question group');

// ── 4. every question is skippable ──────────────────────────────────────────
for (const node of d.querySelectorAll('[data-answer]')) {
  assert(!node.required, `${node.getAttribute('data-answer')} must not be required`);
}
assert.equal(d.querySelector('[data-submit]').disabled, false,
  'a member who answers nothing can still submit — a refusal would discard their "I would not use this"');

// likert questions offer all five points, labelled at both ends
for (const q of EXPECTED.filter(x => x.type === 'likert5')) {
  const radios = d.querySelectorAll(`[data-answer="${q.key}"]`);
  assert.equal(radios.length, 5, `${q.key} offers 5 points`);
  const row = radios[0].closest('.gps-q');
  assert(row.textContent.includes(q.low) && row.textContent.includes(q.high),
    `${q.key} labels both ends (${q.low} / ${q.high})`);
}
// choice questions offer exactly the server's options and nothing else
for (const q of EXPECTED.filter(x => x.type === 'choice')) {
  const values = [...d.querySelectorAll(`[data-answer="${q.key}"]`)].map(n => n.value);
  assert.deepEqual(values, [...q.options], `${q.key} options match the server allowlist`);
}

// ── answering, and the autosave ─────────────────────────────────────────────
const likert = EXPECTED.find(q => q.type === 'likert5');
const text = EXPECTED.find(q => q.type === 'text');
d.querySelector(`[data-answer="${likert.key}"][value="4"]`).checked = true;
d.querySelector(`[data-answer="${text.key}"]`).value = '  it showed me my giving  ';
form.dispatchEvent(new w.Event('input', {bubbles: true}));
await new Promise(r => setTimeout(r, 1400));

assert.equal(posted.length, 1, 'a partial answer autosaves');
const draft = posted[0].body;
assert.equal(draft.completed, false, 'the autosave is not reported as a finished response');
assert.equal(draft.track, 'members_faithful', 'the payload carries the tenant\'s own track');
assert.equal(draft.tenant, 'faithful', 'the tenant comes from the path, not from a guess');
assert.equal(draft.answers[likert.key], '4');
assert.equal(draft.answers[text.key], 'it showed me my giving', 'text is trimmed');
assert.equal(Object.keys(draft.answers).length, 2, 'unanswered questions are absent, not empty strings');
assert.equal(d.querySelector('[data-status]').textContent, 'Saved.');

// ── a reload must not wipe what they already answered ───────────────────────
// The respondent key survives in sessionStorage but the form comes back empty,
// and the server upsert replaces the answer set wholesale.
{
  const before = posted.length;
  d.querySelector(`[data-answer="${text.key}"]`).value = '';
  d.querySelector(`[data-answer="${likert.key}"][value="4"]`).checked = false;
  form.dispatchEvent(new w.Event('input', {bubbles: true}));
  await new Promise(r => setTimeout(r, 1400));
  assert.equal(posted.length, before, 'an empty form does not autosave over a stored response');
  d.querySelector(`[data-answer="${likert.key}"][value="4"]`).checked = true;   // restore
}

// The server never clears completed_at: omitting the column leaves the stored
// value alone on the conflict path, so a reload cannot downgrade a finished
// response to a partial one.
{
  const src = fs.readFileSync('api/survey/_respond.ts', 'utf8');
  assert(!/completed_at:.*:\s*null/.test(src),
    'completed_at must never be written as null — that downgrades a finished response');
  assert(/if \(body\.completed === true\) row\.completed_at/.test(src),
    'completed_at is set only when the response is completed');
}

// ── 3. no identity in the payload ───────────────────────────────────────────
const wire = JSON.stringify(draft).toLowerCase();
for (const forbidden of ['email', 'person_id', 'personid', 'clerk', 'first_name', 'phone', '@']) {
  assert(!wire.includes(forbidden), `the payload must not carry ${forbidden}`);
}
assert.deepEqual(Object.keys(draft).sort(), ['answers', 'completed', 'respondentKey', 'tenant', 'track'],
  'the payload carries nothing beyond the answers and an anonymous key');
assert.match(draft.respondentKey, /^[A-Za-z0-9_-]{16,64}$/, 'the key matches what the endpoint accepts');

// the key is random, not derived: a second sitting gets a different one
const second = new JSDOM('<div data-grace-pilot-survey></div>',
  {url: 'https://grace-members.vercel.app/tenants/faithful/member-portal.html', runScripts: 'outside-only'});
second.window.fetch = () => Promise.resolve({ok: true, json: async () => ({})});
second.window.eval(fs.readFileSync(GENERATED, 'utf8'));
second.window.eval(fs.readFileSync('apps/member-web/public/shared/grace-pilot-survey.js', 'utf8'));
second.window.document.querySelector('[data-submit]').click();
await new Promise(r => setTimeout(r, 10));
const otherKey = second.window.sessionStorage.getItem('grace.pilot-survey.respondent');
assert(otherKey && otherKey !== draft.respondentKey, 'respondent keys are random per sitting, not derived');
second.window.close();

// ── 2. nothing claims a save that did not happen ────────────────────────────
nextResponse = () => ({ok: false, status: 500, json: async () => ({error: 'boom'})});
d.querySelector('[data-submit]').click();
await new Promise(r => setTimeout(r, 10));
assert(!/thank you|sent/i.test(d.querySelector('[data-status]').textContent),
  'a failed submit must not say the answers were sent');
assert(d.querySelector('[data-done]').hidden, 'and must not show the thank-you');
assert(!form.hidden, 'and must leave the answers on the page to retry');

nextResponse = () => { throw new Error('offline'); };
w.fetch = () => Promise.reject(new Error('offline'));
d.querySelector('[data-submit]').click();
await new Promise(r => setTimeout(r, 10));
assert(/nothing was sent/i.test(d.querySelector('[data-status]').textContent),
  'an unreachable server says plainly that nothing was sent');

// only a real success confirms
w.fetch = (url, init) => { posted.push({url, body: JSON.parse(init.body)}); return Promise.resolve({ok: true, json: async () => ({ok: true})}); };
d.querySelector('[data-submit]').click();
await new Promise(r => setTimeout(r, 10));
assert.equal(posted.at(-1).body.completed, true);
assert(/thank you/i.test(d.querySelector('[data-status]').textContent));
assert(form.hidden && !d.querySelector('[data-done]').hidden, 'the form gives way to the thank-you');

assert.equal(w.localStorage.length, 0, 'nothing persists past the tab');

// ── the segmentation link is an id, not a profile ───────────────────────────
w.GRACE_PILOT_SURVEY.linkStoryDraft('11111111-2222-3333-4444-555555555555');
assert.equal(w.sessionStorage.getItem('grace.pilot-survey.draft-id'), '11111111-2222-3333-4444-555555555555');

dom.window.close();

// ── server validation ───────────────────────────────────────────────────────
const TRACK = 'members_faithful';
assert.equal(validateAnswers(TRACK, {}).ok, true, 'an empty submission is valid data');
assert.equal(validateAnswers(TRACK, null).ok, true);
assert.equal(validateAnswers(TRACK, {[likert.key]: ''}).ok, true, 'a skipped question is not an error');
assert.equal(validateAnswers(TRACK, {}).value[likert.key], undefined);
assert.equal(validateAnswers(TRACK, {[likert.key]: '4'}).value[likert.key], 4, 'likert arrives as a number');
assert.equal(validateAnswers(TRACK, {[likert.key]: 6}).ok, false, 'out-of-range likert is refused');
assert.equal(validateAnswers(TRACK, {[likert.key]: 2.5}).ok, false);
assert.equal(validateAnswers(TRACK, {nope: 'x'}).ok, false, 'an unknown question is refused');
assert.equal(validateAnswers(TRACK, [1, 2]).ok, false, 'an array is not an answer set');
assert.equal(validateAnswers('nope', {}).ok, false, 'an unknown track is refused');
assert.equal(validateAnswers(TRACK, {[text.key]: 'x'.repeat(MAX_TOTAL_TEXT + 1)}).ok, false, 'oversize text is refused');

// prototype pollution: these are property names, not questions
for (const key of ['__proto__', 'constructor', 'prototype', 'toString']) {
  const outcome = validateAnswers(TRACK, {[key]: 'x'});
  assert.equal(outcome.ok, false, `${key} is refused as a question key`);
}
assert.equal(Object.prototype.polluted, undefined);
const clean = validateAnswers(TRACK, {[text.key]: 'ok'});
assert.equal(Object.getPrototypeOf(clean.value), null, 'the validated object has no prototype to pollute');

// ── the two churches' evidence stays apart ─────────────────────────────────
//
// Faithful's form must never name another church: a participant asked to rate
// "Central's current channels" is being asked about something that is not
// theirs, and the answer would be noise in both churches' results.
for (const q of FAITHFUL_MEMBER_SURVEY) {
  assert(!/central/i.test(q.text), `Faithful question '${q.key}' must not name Central: ${q.text}`);
  for (const opt of q.options || []) assert(!/central/i.test(opt), `Faithful option names Central: ${opt}`);
}
assert(MEMBER_SURVEY.some(q => /central/i.test(q.text)),
  "Central's own set stays verbatim to the pilot document, which does name the church");

// A question key shared by both groups must mean the same thing, or the two
// sets cannot be read side by side.
for (const f of FAITHFUL_MEMBER_SURVEY) {
  const c = MEMBER_SURVEY.find(q => q.key === f.key);
  if (!c) continue;
  assert.equal(f.type, c.type, `${f.key}: same type across groups`);
  assert.equal(f.measures, c.measures, `${f.key}: same measure across groups`);
  assert.deepEqual(f.options ?? null, c.options ?? null, `${f.key}: same options across groups`);
}

// The onboarding is what Faithful actually walks people through, so it is
// covered directly and named in the comprehension and usability questions.
const fKeys = FAITHFUL_MEMBER_SURVEY.map(q => q.key);
for (const k of ['onboarding_ease', 'onboarding_purpose_clear']) {
  assert(fKeys.includes(k), `Faithful asks '${k}' directly`);
  assert(!MEMBER_SURVEY.some(q => q.key === k), `${k} is Faithful-only`);
}
for (const k of ['comprehension', 'usability_navigate']) {
  const q = FAITHFUL_MEMBER_SURVEY.find(x => x.key === k);
  assert(/Let us know|onboarding/i.test(q.text),
    `Faithful's '${k}' must include the onboarding, since that is what was walked through`);
}

// Separation is enforced twice: by church_id and by track.
assert.notEqual(TENANT_SURVEY_TRACKS.faithful, TENANT_SURVEY_TRACKS['central-henderson'],
  'the two tenants must not share a track');
assert(Object.keys(SURVEY_TRACKS).includes(TENANT_SURVEY_TRACKS.faithful));

// Central's portal renders Central's group.
{
  const cdom = new JSDOM('<div data-grace-pilot-survey></div>',
    {url: 'https://grace-members.vercel.app/tenants/central-henderson/member-portal.html', runScripts: 'outside-only'});
  cdom.window.fetch = () => Promise.resolve({ok: true, json: async () => ({})});
  cdom.window.eval(fs.readFileSync(GENERATED, 'utf8'));
  cdom.window.eval(fs.readFileSync('apps/member-web/public/shared/grace-pilot-survey.js', 'utf8'));
  assert.equal(cdom.window.GRACE_PILOT_SURVEY.getTrack(), 'members');
  assert.equal(new Set([...cdom.window.document.querySelectorAll('[data-answer]')]
    .map(n => n.getAttribute('data-answer'))).size, MEMBER_SURVEY.length,
    `Central renders its own ${MEMBER_SURVEY.length} questions`);
  cdom.window.close();
}

// ── where each tenant's survey lives ───────────────────────────────────────
//
// Faithful ends on the phone: the QR in the desktop Mobile section sends people
// to the iOS page, and that is where they answer. The desktop mount was removed
// once the phone had one, because a respondent key lives in sessionStorage and
// is therefore per-tab — the same person answering on both would have written
// two rows under two keys and inflated the count.
//
// Central has no survey on its phone page, so its desktop mount is the only
// place its members can answer and must stay. The two tenants are deliberately
// NOT symmetrical here; asserting they were is what would break first.
{
  const faithfulPortal = fs.readFileSync('apps/member-web/public/tenants/faithful/member-portal.html', 'utf8');
  assert(!/data-grace-pilot-survey/.test(faithfulPortal),
    'Faithful answers on the phone, so its desktop portal must not also mount the survey');
  assert(!/shared\/grace-pilot-survey/.test(faithfulPortal),
    'and should not carry the module or stylesheet it no longer uses');

  const centralPortal = fs.readFileSync('apps/member-web/public/tenants/central-henderson/member-portal.html', 'utf8');
  assert.equal((centralPortal.match(/data-grace-pilot-survey/g) || []).length, 1,
    'Central has no survey on its phone page, so the desktop mount is its only one');
  const centralScripts = [...centralPortal.matchAll(/<script src="[^"]*shared\/(grace-pilot-survey[^"]*\.js)"/g)].map(m => m[1]);
  assert.deepEqual(centralScripts, ['grace-pilot-survey-questions.js', 'grace-pilot-survey.js'],
    'Central loads the questions, then the module');
  assert.equal((centralPortal.match(/<link[^>]*shared\/grace-pilot-survey\.css/g) || []).length, 1,
    'Central loads the stylesheet once');

  // Exactly one mount per tenant, across both of its pages.
  for (const tenant of ['faithful', 'central-henderson']) {
    const pages = fs.readdirSync(`apps/member-web/public/tenants/${tenant}`)
      .filter(f => f.endsWith('.html'))
      .map(f => fs.readFileSync(`apps/member-web/public/tenants/${tenant}/${f}`, 'utf8'));
    const statik = pages.reduce((n, p) => n + (p.match(/data-grace-pilot-survey/g) || []).length, 0);
    const appended = tenant === 'faithful' ? 1 : 0;   // faithful-mobile-finish.js appends the phone one
    assert.equal(statik + appended, 1,
      `${tenant}: exactly one mount across all its pages — two would mean two rows per person`);
  }
}

// ── the phone carries it too ────────────────────────────────────────────────
//
// The pilot ends on the phone: the QR in the desktop Mobile section sends
// people to the iOS page. The survey lived only on the desktop portal, so the
// device the walkthrough actually finishes on had no survey at all.
{
  const ios = 'apps/member-web/public/tenants/faithful/grace_faithful_church_members_card_ios_app.html';
  const page = fs.readFileSync(ios, 'utf8');
  const scripts = [...page.matchAll(/<script src="[^"]*shared\/(grace-pilot-survey[^"]*\.js)"/g)].map(m => m[1]);
  assert.deepEqual(scripts, ['grace-pilot-survey-questions.js', 'grace-pilot-survey.js'],
    'the phone loads the questions, then the module');
  assert.equal((page.match(/<link[^>]*shared\/grace-pilot-survey\.css/g) || []).length, 1,
    'the phone loads the stylesheet once');

  // Load order is load-bearing here, not cosmetic: faithful-mobile-finish.js is
  // what appends the mount and then calls mount(), so the module must already
  // exist by the time it runs.
  assert(page.indexOf('shared/grace-pilot-survey.js') < page.indexOf('faithful-mobile-finish.js'),
    'the survey module must load before faithful-mobile-finish.js, which mounts it');

  const finish = fs.readFileSync('apps/member-web/public/tenants/faithful/faithful-mobile-finish.js', 'utf8');
  assert(/data-grace-pilot-survey/.test(finish), 'mobile-finish creates the mount point');
  assert(/GRACE_PILOT_SURVEY\?\.mount\(\)/.test(finish),
    'and mounts it explicitly — the module\'s own auto-mount has already run and found nothing');
  // It must be appended AFTER the sections this module adds, or the survey
  // renders above them instead of at the end of the walkthrough.
  assert(finish.indexOf('home.append(prayer)') < finish.indexOf('data-grace-pilot-survey'),
    'the mount is appended after the care and prayer sections, so it lands last');
  // A static <div> in the HTML would sit above those runtime sections.
  assert(!/data-grace-pilot-survey/.test(page),
    'the phone must NOT carry a static mount — it would render above the appended sections');
}

// ── the migration keeps the survey unlinkable to a person ───────────────────
const migration = fs.readFileSync('supabase/migrations/083_pilot_survey_responses.sql', 'utf8');
// Strip -- comments AND quoted strings: the `comment on` text discusses the
// absent person_id on purpose, and "anon" appears in the RLS rationale.
const sql = migration.replace(/--.*$/gm, '').replace(/'(?:[^']|'')*'/g, "''");
assert(!/person_id/.test(sql),
  'pilot_survey_responses must have no person_id column — separability is the whole point');
assert(/unique \(church_id, track, respondent_key\)/.test(sql), 'one row per respondent per track');
assert(/enable row level security/.test(sql));
assert(!/\banon\b/.test(sql), 'no anon policy: responses are read by staff, not the public');

// 084 widens the track constraint so Faithful's group can be stored at all.
{
  const m84 = fs.readFileSync('supabase/migrations/084_pilot_survey_faithful_track.sql', 'utf8')
    .replace(/--.*$/gm, '');
  assert(/check \(track in \([^)]*'members_faithful'/.test(m84),
    '084 must allow the members_faithful track, or every Faithful answer 500s');
  assert(!/drop table|delete from/i.test(m84), '084 is a widening only');
}

console.log(`PASS: no drift (Central ${MEMBER_SURVEY.length}, Faithful ${FAITHFUL_MEMBER_SURVEY.length}), separate tracks, skippable, truthful failure states, anonymous payload, server validation, one mount per tenant (Faithful on the phone, Central on desktop). Visual layout and a real phone submission not verified.`);
