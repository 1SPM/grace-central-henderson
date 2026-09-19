/* Get connected: the phone's onboarding reaches the church, and only on purpose.
 *
 * "My story" kept a newcomer's answers in their own browser, shared with nobody.
 * It now joins the path the desktop portal already uses -- POST
 * /api/story/handoff, then /claim, then sign-up attaches the draft to the new
 * member's record for staff review (docs/MEMBER_MOBILE_HANDOFF.md).
 *
 * Runs the real faithful-preferences.js, faithful-mobile-welcome.js and
 * faithful-mobile-get-connected.js together, with fetch and navigation stubbed,
 * because the thing to get right is what leaves the phone and when.
 */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const DIR = 'apps/member-web/public/tenants/faithful/';
const read = f => fs.readFileSync(DIR + f, 'utf8');

const dom = new JSDOM(`<div class="device"><div class="app">
  <section class="screen active" id="screen-home"><div class="scroll"><div class="home-hero"></div></div></section>
  <section class="screen" id="screen-destination-my-story"><div data-member-story></div></section>
</div></div>`, { url: 'https://members.example/tenants/faithful/page.html', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom, d = window.document;
window.showScreen = () => {}; window.openMemberDestination = () => {}; window.closeAppMenu = () => {};
window.Element.prototype.scrollIntoView = () => {};

// The welcome layer offers the tour 700ms after load, and an open tour keeps a
// re-measure timer running, which would keep this process alive. This test is
// not about the tour, so mark it seen, as a returning visitor would have it.
window.localStorage.setItem('grace.faithful.mobile.welcome.v1', JSON.stringify({ tour: 'done' }));

// Something private sitting in this browser. It must never travel.
window.localStorage.setItem('grace.preferences.faithful.demo-maya.v1', JSON.stringify({ homeConnection: { connection: 'SECRET-SAVED-EARLIER' } }));

const calls = []; let reply = { status: 201, body: { ok: true, claim_url: 'https://members.example/claim?tenant=faithful#t=abc' } };
window.fetch = (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return Promise.resolve({ ok: reply.status < 300, status: reply.status, json: () => Promise.resolve(reply.body) }); };
let navigatedTo = null;
window.FAITHFUL_GET_CONNECTED_NAVIGATE = u => { navigatedTo = u; };

for (const f of ['faithful-preferences.js', 'faithful-mobile-welcome.js', 'faithful-mobile-get-connected.js']) window.eval(read(f));
await new Promise(r => setTimeout(r, 80));

const form = d.querySelector('[data-member-story] form');
assert(form, 'the form is on the Get connected screen');
const go = form.querySelector('.fgc-go'), status = form.querySelector('.fgc-status');
const press = async () => { go.click(); await new Promise(r => setTimeout(r, 20)); };
assert.equal(go.textContent, 'Continue to create my account');
assert.equal(form.querySelector('.fp-actions button[type=submit]').textContent, 'Save on this phone',
  'the button that saves locally says so, now that another button sends to the church');

// The saved answer was restored into the field by faithful-preferences.js. Clear
// it the way a person would, so what is sent below is only what is typed here.
form.elements.connection.value = '';

// ── nothing leaves the phone by accident ───────────────────────────────────
await press();
assert.equal(calls.length, 0, 'no stage chosen: nothing is sent');
assert(/Choose where you are/.test(status.textContent));
form.querySelector('input[name="fgc-stage"][value="new"]').click();
await press();
assert.equal(calls.length, 0, 'no consent: nothing is sent');
assert(/nothing leaves this phone/i.test(status.textContent));

// ── what is sent is what was typed, to the path that already exists ────────
form.querySelector('.fgc-name input').value = 'Jordan';
form.elements.support.value = 'Fictional: a small group near me';
form.elements.thoughts.value = 'x'.repeat(900);
form.querySelector('input[name="fgc-consent"]').click();
await press();
assert.equal(calls.length, 1);
const { url, body } = calls[0];
assert.equal(url, '/api/story/handoff', 'the same endpoint the desktop walkthrough uses');
assert.equal(body.tenant, 'faithful');
assert.equal(body.preferredName, 'Jordan');
assert.equal(body.consentCarryStory, true);
assert.equal(body.consentFollowup, false, 'follow-up is its own, unticked, choice');
assert.equal(body.consentMoneySections, false, 'this screen never sends the money sections');
assert.deepEqual(Object.keys(body.sections), ['church'], 'one core section, on the server allowlist');
assert.deepEqual(body.segments, {});
const items = body.sections.church;
assert(items.includes('Where I am: New or exploring'));
assert(items.includes('What I am hoping to find: Fictional: a small group near me'));
assert(items.every(i => i.length <= 400), 'every item fits MAX_ITEM_CHARS, so a long answer is split rather than rejected');
assert.equal(items.filter(i => /^In my own words/.test(i)).length, 3, '900 characters becomes three items');
assert(!JSON.stringify(body).includes('SECRET-SAVED-EARLIER'), 'nothing is read from localStorage');
assert(!/Maya/.test(JSON.stringify(body)), 'the demo persona is never sent');
assert.equal(navigatedTo, 'https://members.example/claim?tenant=faithful#t=abc', 'then straight to the claim page: no QR needed, this is the phone');

// ── it never says "sent" when it was not ───────────────────────────────────
// After a real success the page is leaving, so the button stays disabled.
// Here nothing navigates, so put it back the way a fresh visit would find it.
assert.equal(go.disabled, true, 'a sent form cannot be sent twice while the page is leaving');
go.disabled = false;
for (const [r, expect] of [
  [{ status: 429, body: { error: 'rate_limited' } }, /Too many tries/],
  [{ status: 404, body: { error: 'handoff_not_available_on_this_domain' } }, /not available on this address/],
  [{ status: 500, body: { error: 'story_save_failed' } }, /did not send, and nothing was shared/],
  // A success that does not lead to our own claim page is not a success.
  [{ status: 201, body: { ok: true, claim_url: 'https://evil.example/claim#t=x'.replace('/claim', '/phish') } }, /did not send/],
]) {
  reply = r; navigatedTo = null;
  await press();
  assert(expect.test(status.textContent), `for ${r.status}: "${status.textContent}"`);
  assert(/still on this page/.test(status.textContent), 'and the answers are still there to retry');
  assert.equal(navigatedTo, null, 'and the page does not navigate');
  assert.equal(go.disabled, false, 'and the button works again');
}

// ── wiring and copy ────────────────────────────────────────────────────────
const html = read('grace_faithful_church_members_card_ios_app.html');
assert(html.indexOf('faithful-mobile-welcome.js') < html.indexOf('faithful-mobile-get-connected.js'), 'loads after the layer that moves the form');
const destinations = read('faithful-destinations.js');
assert(/pages\['my-story'\] = \['Get connected'/.test(destinations), 'the screen is called Get connected');
assert(!/isn’t shared with GRACE or the church team/.test(destinations), 'and no longer promises that it cannot reach the church');
assert(!/<script[^>]*faithful-mobile-get-connected/.test(read('member-portal.html')), 'the desktop portal keeps its own walkthrough and QR');

dom.window.close();
console.log('PASS: nothing is sent without a stage and a ticked consent; what is sent is only what was typed, split to the server limits, to the existing handoff endpoint, then on to /claim; every failure says it did not send and keeps the answers. Stubbed fetch: no request reached a server.');
