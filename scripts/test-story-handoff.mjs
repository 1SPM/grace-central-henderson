/* Phone handoff panel: what it sends, what it shows, and what it never does.
 * DOM-level only — the QR image itself and a real phone scan are not covered
 * here (see docs/MEMBER_MOBILE_HANDOFF.md's manual verification requirement). */
import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const dom = new JSDOM(
  '<section id="sec-mobile"><div class="mobile-link-page"></div></section>' +
  '<section data-signup hidden><h2 tabindex="-1">Create your account</h2></section>',
  {url: 'https://grace-members.vercel.app/tenants/faithful/member-portal.html', runScripts: 'outside-only'},
);
const w = dom.window, d = w.document;

const calls = [];
w.fetch = (url, init) => {
  calls.push({url, body: JSON.parse(init.body)});
  if (url === '/api/story/cancel') return Promise.resolve({ok: true, json: async () => ({ok: true})});
  return Promise.resolve({ok: true, json: async () => ({
    ok: true,
    token: 'a'.repeat(43),
    claim_url: 'https://grace-members.vercel.app/claim?tenant=faithful#t=' + 'a'.repeat(43),
    qr_png_data_url: 'data:image/png;base64,iVBORw0KGgo=',
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    expires_in_seconds: 900,
  })});
};

w.eval(fs.readFileSync('apps/member-web/public/shared/grace-story-handoff.js', 'utf8'));
w.eval(fs.readFileSync('apps/member-web/public/tenants/faithful/faithful-story-handoff.js', 'utf8'));
const panel = d.querySelector('.story-handoff');
assert(panel, 'panel mounts');
assert(panel.hidden, 'panel stays hidden until a handoff is requested');
assert.equal(calls.length, 0, 'nothing is sent on load');

// ── minting ────────────────────────────────────────────────────────────────
w.FAITHFUL_STORY_HANDOFF.start({
  preferredName: 'John',
  sections: {church: ['Two years'], wallet: ['identity']},
  consents: {carry: true, money: false, followup: true},
});
await new Promise(r => setTimeout(r, 20));

assert.equal(calls.length, 1, 'exactly one mint request');
assert.equal(calls[0].url, '/api/story/handoff');
const sent = calls[0].body;
assert.equal(sent.tenant, 'faithful', 'tenant is read from the portal path');
assert.equal(sent.preferredName, 'John');
assert.equal(sent.consentCarryStory, true);
assert.equal(sent.consentMoneySections, false, 'money consent is passed through, not assumed');
assert.equal(sent.consentFollowup, true);
assert(d.querySelector('[data-signup]').hidden, 'the signup step is hidden while the code shows');
assert(!panel.hidden, 'the panel is shown');

// ── what the member sees ───────────────────────────────────────────────────
assert(panel.querySelector('[data-qr]').src.startsWith('data:image/png;base64,'), 'QR is rendered from the server payload');
assert(!panel.querySelector('[data-qr]').src.includes('qrserver'), 'never a third-party QR service');
assert(/Expires in \d+:\d\d/.test(panel.querySelector('[data-countdown]').textContent), 'a live countdown is shown');
assert(!panel.querySelector('.sh-link').textContent.includes('a'.repeat(43)), 'the token is not printed as readable text');
assert(panel.querySelector('.sh-note').textContent.includes('until you finish'), 'says nothing is added yet');

// ── cancel ─────────────────────────────────────────────────────────────────
panel.querySelector('[data-cancel]').click();
await new Promise(r => setTimeout(r, 20));
assert.equal(calls[1].url, '/api/story/cancel', 'cancel calls the cancel route');
assert.equal(calls[1].body.token, 'a'.repeat(43));
assert(!panel.querySelector('[data-qr]').getAttribute('src'), 'the code is removed from the screen immediately');
assert(/cancelled/i.test(panel.querySelector('[data-status]').textContent), 'says it was cancelled');

// ── a new code retires the old one first ───────────────────────────────────
w.FAITHFUL_STORY_HANDOFF.start({preferredName: 'John', sections: {church: ['Two years']}, consents: {carry: true, money: false, followup: false}});
await new Promise(r => setTimeout(r, 20));
const before = calls.length;
panel.querySelector('[data-new]').click();
await new Promise(r => setTimeout(r, 30));
assert.equal(calls[before].url, '/api/story/cancel', 'the previous code is cancelled before a new one is minted');
assert.equal(calls[before + 1].url, '/api/story/handoff', 'then a fresh code is requested');

// ── failure is stated, never silent ────────────────────────────────────────
w.fetch = () => Promise.reject(new Error('offline'));
w.FAITHFUL_STORY_HANDOFF.start({preferredName: 'John', sections: {}, consents: {carry: true, money: false, followup: false}});
await new Promise(r => setTimeout(r, 20));
assert(/could not reach/i.test(panel.querySelector('[data-status]').textContent), 'a network failure is reported');
assert(/Nothing was sent/i.test(panel.querySelector('[data-status]').textContent), 'and says nothing was sent');

assert.equal(w.localStorage.length, 0, 'the handoff writes nothing to browser storage');

dom.window.close();
console.log('PASS: handoff minting, consent pass-through, server-rendered QR, countdown, cancel, re-issue, and honest failure. QR scannability and a real phone are not verified here.');
