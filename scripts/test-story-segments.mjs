/* The four pilot segmentation questions.
 * The load-bearing checks: values match the server allowlist, a decline is
 * never recorded as an answer, and the selects stay out of .fp-questions — a
 * <select> in there is scraped by faithful-mobile-story.js and shown back to
 * the member as if they had typed it. */
import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const dom = new JSDOM(
  '<section id="sec-home"><form><div class="fp-connection-layout" id="fp-story-fields">' +
  '<div class="fp-questions"><textarea name="connection"></textarea></div>' +
  '<aside class="fp-profile"></aside>' +
  '</div><button type="button" data-story-skip>Skip this part</button></form></section>',
  {url: 'https://grace-members.vercel.app/tenants/faithful/member-portal.html', runScripts: 'outside-only'},
);
const w = dom.window, d = w.document;
w.eval(fs.readFileSync('apps/member-web/public/tenants/faithful/faithful-story-segments.js', 'utf8'));

const panel = d.querySelector('[data-story-segments]');
assert(panel, 'panel mounts into #fp-story-fields');
assert.equal(d.querySelectorAll('[data-segment]').length, 4, 'four questions');

// ── the containment contract ───────────────────────────────────────────────
for (const select of d.querySelectorAll('[data-segment]')) {
  assert(!select.closest('.fp-questions'),
    'a segment select must not live inside .fp-questions — mobile-story scrapes that as free text');
}

// ── values match the server allowlist ──────────────────────────────────────
const serverSrc = fs.readFileSync('api/_lib/storySegments.ts', 'utf8');
const block = serverSrc.slice(serverSrc.indexOf('SEGMENT_FIELDS'), serverSrc.indexOf('} as const satisfies'));
for (const select of d.querySelectorAll('[data-segment]')) {
  const key = select.dataset.segment;
  const line = block.split('\n').find(l => l.trim().startsWith(key + ':'));
  assert(line, `server defines ${key}`);
  const allowed = [...line.matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]);
  for (const option of select.options) {
    assert(allowed.includes(option.value),
      `${key} option '${option.value}' is not in the server allowlist — the server 400s on it`);
  }
}

// ── declines ───────────────────────────────────────────────────────────────
for (const select of d.querySelectorAll('[data-segment]')) {
  assert.equal(select.value, 'prefer_not_to_say', 'every field defaults to a decline');
  assert.equal(select.options[0].value, 'prefer_not_to_say', 'the decline is offered first');
}
assert.equal(JSON.stringify(w.FAITHFUL_STORY_SEGMENTS.get()), '{}',
  'an untouched panel contributes nothing');

// ── answering ──────────────────────────────────────────────────────────────
d.querySelector('[data-segment="language_preference"]').value = 'es';
d.querySelector('[data-segment="attendance_mode"]').value = 'both';
assert.equal(JSON.stringify(w.FAITHFUL_STORY_SEGMENTS.get()),
  JSON.stringify({language_preference: 'es', attendance_mode: 'both'}),
  'only answered fields travel');

// ── the adult-only pilot ───────────────────────────────────────────────────
const age = d.querySelector('[data-segment="age_band"]');
assert(d.querySelector('.fss-minor-note').hidden, 'no guidance until it is relevant');
age.value = 'under_18';
age.dispatchEvent(new w.Event('change', {bubbles: true}));
assert(!d.querySelector('.fss-minor-note').hidden,
  'selecting under 18 surfaces guidance rather than carrying on silently');

// ── skip clears everything ─────────────────────────────────────────────────
d.querySelector('[data-story-skip]').click();
assert.equal(JSON.stringify(w.FAITHFUL_STORY_SEGMENTS.get()), '{}', 'Skip this part clears the answers');
assert(d.querySelector('.fss-minor-note').hidden, 'and resets the guidance');

assert.equal(w.localStorage.length, 0, 'nothing is written to browser storage');

dom.window.close();
console.log('PASS: segment mounting, containment, server-allowlist agreement, declines, minor guidance, and skip. Visual layout not verified.');
