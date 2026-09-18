/* Central's story capture — shared, self-contained, builds its own DOM.
 * The checks that matter: it does not depend on any tenant's markup, segment
 * values match the server allowlist, declines are never recorded as answers,
 * and no consent is compulsory. */
import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const dom = new JSDOM('<body><main><div data-grace-story-capture></div></main></body>',
  {url: 'https://grace-members.vercel.app/tenants/central-henderson/member-portal.html', runScripts: 'outside-only'});
const w = dom.window, d = w.document;
const calls = [];
w.fetch = (url, init) => {
  calls.push({url, body: JSON.parse(init.body)});
  return Promise.resolve({ok: true, json: async () => ({
    ok: true, token: 'c'.repeat(43),
    claim_url: 'https://grace-members.vercel.app/claim?tenant=central-henderson#t=' + 'c'.repeat(43),
    qr_png_data_url: 'data:image/png;base64,iVBORw0KGgo=',
    expires_at: new Date(Date.now() + 900000).toISOString(),
  })});
};
w.eval(fs.readFileSync('apps/member-web/public/shared/grace-story-handoff.js', 'utf8'));
w.eval(fs.readFileSync('apps/member-web/public/shared/grace-story-capture.js', 'utf8'));

const wrap = d.querySelector('.gsc');
assert(wrap, 'mounts into [data-grace-story-capture]');
assert.equal(calls.length, 0, 'nothing sent on load');

// ── it must not depend on any tenant's markup ─────────────────────────────
// The page above has none of Faithful's hooks. This is the whole point: the
// Faithful capture could not be copied to Central because it scrapes DOM that
// faithful-preferences.js builds.
for (const hook of ['.fp-questions', '#fp-story-fields', '[data-signup]', '#sec-mobile']) {
  assert.equal(d.querySelector(hook), null, `test page deliberately has no ${hook}`);
}
assert(d.querySelectorAll('[data-section]').length >= 3, 'still renders its questions');

// ── segment values match the server allowlist ────────────────────────────
const serverSrc = fs.readFileSync('api/_lib/storySegments.ts', 'utf8');
const block = serverSrc.slice(serverSrc.indexOf('SEGMENT_FIELDS'), serverSrc.indexOf('} as const satisfies'));
for (const select of d.querySelectorAll('[data-segment]')) {
  const key = select.getAttribute('data-segment');
  const line = block.split('\n').find(l => l.trim().startsWith(key + ':'));
  assert(line, `server defines ${key}`);
  const allowed = [...line.matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]);
  for (const o of select.options) {
    assert(allowed.includes(o.value), `${key} option '${o.value}' would 400 at the server`);
  }
  assert.equal(select.value, 'prefer_not_to_say', `${key} defaults to a decline`);
}
assert.equal(JSON.stringify(w.GRACE_STORY_CAPTURE.getSegments()), '{}', 'an untouched panel contributes nothing');

// ── consent is not compulsory, and the name is validated in JS ───────────
const status = () => wrap.querySelector('.gsc-status').textContent;
for (const box of wrap.querySelectorAll('[data-consent-carry],[data-consent-money],[data-consent-followup]')) {
  assert(!box.required, 'no consent box is a required field');
  assert.equal(box.checked, false, 'every consent defaults to off');
}
wrap.querySelector('form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
assert(/preferred name/i.test(status()), 'asks for a name first');
assert.equal(calls.length, 0);

wrap.querySelector('[data-name]').value = 'Sam';
wrap.querySelector('form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
assert(/Carry my story/i.test(status()), 'refuses the handoff without the carry consent');
assert.equal(calls.length, 0, 'and sends nothing');

// ── declining is a real, working outcome ─────────────────────────────────
wrap.querySelector('[data-decline]').click();
assert(/Nothing was sent/i.test(status()), 'the decline path says nothing was sent');
assert.equal(calls.length, 0);

// ── a real handoff ───────────────────────────────────────────────────────
wrap.querySelector('[data-section="church"]').value = 'Here about two years';
wrap.querySelector('[data-segment="language_preference"]').value = 'es';
wrap.querySelector('[data-segment="age_band"]').value = 'prefer_not_to_say';
wrap.querySelector('[data-consent-carry]').checked = true;
wrap.querySelector('[data-consent-followup]').checked = true;
wrap.querySelector('form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
await new Promise(r => setTimeout(r, 40));

assert.equal(calls.length, 1, 'one handoff request');
assert.equal(calls[0].url, '/api/story/handoff');
const sent = calls[0].body;
assert.equal(sent.tenant, 'central-henderson', 'tenant read from the portal path');
assert.equal(sent.preferredName, 'Sam');
assert.deepEqual(Object.keys(sent.sections), ['church'], 'only answered sections travel');
assert.equal(JSON.stringify(sent.segments), JSON.stringify({language_preference: 'es'}),
  'a decline is not sent as an answer');
assert.equal(sent.consentCarryStory, true);
assert.equal(sent.consentMoneySections, false, 'money consent passed through, not assumed');
assert.equal(sent.consentFollowup, true);

// ── the shared handoff panel took over ───────────────────────────────────
const panel = d.querySelector('.story-handoff');
assert(panel && !panel.hidden, 'the shared panel is showing');
assert(/Expires in \d+:\d\d/.test(panel.querySelector('[data-countdown]').textContent), 'live countdown');
assert(panel.querySelector('[data-qr]').src.startsWith('data:image/png;base64,'), 'server-rendered QR');
assert(!panel.querySelector('[data-qr]').src.includes('qrserver'), 'never a third-party QR service');

// ── the adult-only pilot ─────────────────────────────────────────────────
const age = wrap.querySelector('[data-segment="age_band"]');
age.value = 'under_18';
age.dispatchEvent(new w.Event('change', {bubbles: true}));
assert(!wrap.querySelector('.gsc-minor-note').hidden, 'under 18 surfaces guidance');

assert.equal(w.localStorage.length, 0, 'nothing is written to browser storage');
dom.window.close();
console.log('PASS: capture mounts without tenant markup, segments match the server allowlist, consent is declinable, and the shared handoff panel takes over. Visual layout and a real phone not verified.');
