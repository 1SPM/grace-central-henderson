/* Member care request — the first caller of POST /api/portal/care.
 * The load-bearing checks: categories match the endpoint's allowlist, a
 * signed-out member is told the truth rather than shown a fake success, and
 * no failure path ever claims the care team received something. */
import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const dom = new JSDOM('<body></body>', {url: 'https://grace-members.vercel.app/tenants/faithful/member-portal.html', runScripts: 'outside-only'});
const w = dom.window, d = w.document;
const calls = [];
let sessionValue = {getToken: () => Promise.resolve('tok_abc')};
let response = {ok: true, status: 201, body: {request: {id: 'cr_1', category: 'grief', status: 'received'}}};

w.GRACE_SESSION = {get ready() { return Promise.resolve(sessionValue); }};
w.fetch = (url, init) => {
  calls.push({url, init, body: JSON.parse(init.body)});
  return Promise.resolve({ok: response.ok, status: response.status, json: async () => response.body});
};
w.eval(fs.readFileSync('apps/member-web/public/shared/grace-care-request.js', 'utf8'));

const api = w.GRACE_CARE_REQUEST;
assert(api && api.open, 'module exposes an open()');
assert.equal(calls.length, 0, 'nothing is sent on load');

// ── category mapping against the endpoint's own allowlist ──────────────────
const src = fs.readFileSync('api/portal/_care.ts', 'utf8');
const line = src.split('\n').find(l => l.includes('const CATEGORIES ='));
const allowed = [...line.matchAll(/'([a-z-]+)'/g)].map(m => m[1]);
api.open('grief');
const options = [...d.querySelectorAll('[data-category] option')].map(o => o.value);
for (const value of options) {
  assert(allowed.includes(value), `category '${value}' is not in the endpoint allowlist — it would 400`);
}
// The three portal ids that differ from the endpoint's must map, not pass through.
for (const [portalId, expected] of [['faith', 'faith-questions'], ['anxiety', 'anxiety-depression'], ['other', 'general']]) {
  api.open(portalId);
  assert.equal(d.querySelector('[data-category]').value, expected,
    `portal id '${portalId}' must map to '${expected}'`);
}

// ── a real submit ─────────────────────────────────────────────────────────
api.open('grief');
d.querySelector('[data-message]').value = 'My father died last month.';
d.querySelector('form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
await new Promise(r => setTimeout(r, 30));

assert.equal(calls.length, 1, 'exactly one request');
assert.equal(calls[0].url, '/api/portal/care');
assert.equal(calls[0].init.method, 'POST');
assert.equal(calls[0].init.headers.Authorization, 'Bearer tok_abc', 'sends the member bearer token');
assert.equal(calls[0].body.category, 'grief');
assert.equal(calls[0].body.requests_human_followup, true, 'the consent box maps to the follow-up flag');
assert(/care team can see this/i.test(d.querySelector('[data-status]').textContent), 'confirms only after the server accepted');

// ── declining contact is recorded as a choice, not an omission ─────────────
api.open('general');
d.querySelector('[data-message]').value = 'Just letting you know.';
d.querySelector('[data-followup]').checked = false;
d.querySelector('form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
await new Promise(r => setTimeout(r, 30));
assert.equal(calls[1].body.requests_human_followup, false);
assert(/nobody will reach out/i.test(d.querySelector('[data-status]').textContent), 'says plainly that nobody will contact them');

// ── a previous member's words never persist into the next open ───────────
// This is a disclosure risk on a shared screen, not only a reset nicety:
// before it was fixed, a bereavement message was still in the box next time.
api.open('grief');
assert.equal(d.querySelector('[data-message]').value, '', 'the message box is cleared on open');
assert.equal(d.querySelector('[data-followup]').checked, true, 'the consent box returns to its default');

// ── empty message is refused before any network call ──────────────────────
const before = calls.length;
api.open('grief');
d.querySelector('form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
await new Promise(r => setTimeout(r, 20));
assert.equal(calls.length, before, 'an empty message never reaches the server');

// ── server refusal never reads as success ─────────────────────────────────
response = {ok: false, status: 500, body: {error: 'insert_failed'}};
api.open('grief');
d.querySelector('[data-message]').value = 'Please pray for my family.';
d.querySelector('form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
await new Promise(r => setTimeout(r, 30));
const failText = d.querySelector('[data-status]').textContent;
assert(/Nothing has reached the church team/i.test(failText), 'a failure says nothing was received');
assert(!/sent\./i.test(failText.toLowerCase().replace('did not send','')), 'and never reads as sent');

// ── signed out: told the truth, and nothing is sent ───────────────────────
sessionValue = null;
const beforeAnon = calls.length;
api.open('grief');
await new Promise(r => setTimeout(r, 20));
assert(/not signed in/i.test(d.querySelector('[data-status]').textContent), 'warns before they type');
d.querySelector('[data-message]').value = 'I need help.';
d.querySelector('form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
await new Promise(r => setTimeout(r, 30));
assert.equal(calls.length, beforeAnon, 'a signed-out submit sends nothing');
assert(/cannot reach the church team/i.test(d.querySelector('[data-status]').textContent), 'and says so');

// ── crisis guidance ───────────────────────────────────────────────────────
api.open('crisis');
assert(!d.querySelector('[data-crisis]').hidden, 'crisis shows the hotline guidance');
assert(/988|911/.test(d.querySelector('[data-crisis]').textContent), 'names a real emergency route');
api.open('grief');
assert(d.querySelector('[data-crisis]').hidden, 'and hides it otherwise');

// ── a slow session check must not clobber a submit result ────────────────
// GRACE_SESSION.ready can settle AFTER the member has pressed send. The open()
// check must not then overwrite the answer they were waiting for. To exercise
// that ordering the open() check is given a promise that resolves last.
let releaseOpenCheck;
const slowForOpen = new Promise(resolve => { releaseOpenCheck = resolve; });
Object.defineProperty(w.GRACE_SESSION, 'ready', {get: () => slowForOpen, configurable: true});
api.open('grief');                                  // open() captures the slow promise

sessionValue = {getToken: () => Promise.resolve('tok_abc')};
response = {ok: true, status: 201, body: {request: {id: 'cr_9', category: 'grief', status: 'received'}}};
Object.defineProperty(w.GRACE_SESSION, 'ready', {get: () => Promise.resolve(sessionValue), configurable: true});
d.querySelector('[data-message]').value = 'Please pray.';
d.querySelector('form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
await new Promise(r => setTimeout(r, 40));          // submit completes first
assert(/care team can see this/i.test(d.querySelector('[data-status]').textContent), 'submit reported success');

releaseOpenCheck(null);                             // now the stale check resolves, signed-out
await new Promise(r => setTimeout(r, 40));
const raced = d.querySelector('[data-status]').textContent;
assert(/care team can see this/i.test(raced),
  'a late session check must not overwrite the submit result, got: ' + raced);

assert.equal(w.localStorage.length, 0, 'writes nothing to browser storage');
dom.window.close();
console.log('PASS: care intake reaches /api/portal/care, category mapping matches the endpoint, consent maps to the follow-up flag, and no failure or signed-out path claims a send.');
