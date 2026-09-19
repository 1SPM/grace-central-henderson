/* The phone's first visit: a tour that points at the real screen, and My story
 * on a screen of its own.
 *
 * This runs the REAL faithful-preferences.js and then faithful-mobile-welcome.js
 * on top of it, because the second one's whole job is to move what the first
 * one builds. A test of either alone would pass while the pair was broken --
 * and faithful-preferences.js is shared with the desktop portal, so it is not
 * allowed to change to make this easier.
 *
 * jsdom has no layout, so where the spotlight lands is not covered here.
 */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const DIR = 'apps/member-web/public/tenants/faithful/';
const read = f => fs.readFileSync(DIR + f, 'utf8');
const welcome = read('faithful-mobile-welcome.js');

const dom = new JSDOM(`<div class="device"><div class="app">
  <section class="screen active" id="screen-home"><div class="scroll">
    <div class="home-hero"></div><div class="home-hero-leader" id="home-leader-chip"></div>
  </div></section>
  <section class="screen" id="screen-give"><div class="scroll"><details class="fp-preferences fp-connection">
    <summary>Get to know your card<small class="fh-guide-subline">How the card works.</small></summary></details></div></section>
  <section class="screen" id="screen-destination-my-story"><div data-member-story></div></section>
  <aside id="app-drawer"><nav class="drawer-nav"></nav></aside>
</div></div>`, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom, d = window.document;
const shown = [];
window.showScreen = name => shown.push(name);
window.openMemberDestination = key => shown.push('destination:' + key);
window.closeAppMenu = () => {};
window.Element.prototype.scrollIntoView = () => {};
window.Element.prototype.scrollTo = () => {};

window.eval(read('faithful-preferences.js'));   // mounts after an await
window.eval(welcome);
await new Promise(r => setTimeout(r, 50));

// ── My story moved, whole and working ──────────────────────────────────────
const host = d.querySelector('[data-member-story]');
const form = host.querySelector('form');
assert(form, 'the form faithful-preferences.js builds is now on the My story screen');
assert.equal(d.querySelector('#screen-home .fp-preferences'), null, 'and its row is gone from Home');
for (const sel of ['.fp-connection-layout', '.fp-consent', '.fp-actions']) {
  assert.equal(form.querySelector(sel).hidden, false, `${sel} is simply the page, not folded behind "Open"`);
}
assert.equal(form.querySelector('.fp-story-bar'), null, 'no "Let us know · Open · Skip this part" bar');
assert.equal(form.querySelector('.fp-intro'), null, 'the explainer and the old in-row tour did not come along');
assert.equal(form.querySelectorAll('textarea').length, 4, 'three story boxes and "anything else"');

// Saving still goes through faithful-preferences.js's own handler.
const KEY = 'grace.preferences.faithful.demo-maya.v1';
form.querySelector('textarea').value = 'Fictional: part of this church for five years';
form.elements.remember.checked = true;
form.dispatchEvent(new window.Event('submit', { cancelable: true }));
assert.equal(JSON.parse(window.localStorage.getItem(KEY)).homeConnection.connection,
  'Fictional: part of this church for five years', 'the moved form saves exactly as it did in the row');

// Home carries one slim line until then.
const nudge = d.querySelector('#screen-home .fw-story-nudge');
assert(nudge, 'Home has the one-line invitation');
await new Promise(r => setTimeout(r, 10));
assert.equal(nudge.hidden, true, 'which goes away once a story is saved');
form.querySelector('[data-clear]').click();
await new Promise(r => setTimeout(r, 10));
assert.equal(nudge.hidden, false, 'and returns if the answers are forgotten');

// "Maybe later" used to fold the fields shut. On their own screen that would
// leave an empty page, so it goes back to Home with the fields intact.
form.querySelector('[data-skip]').click();
assert.equal(shown.at(-1), 'home');
assert.equal(form.querySelector('.fp-connection-layout').hidden, false, 'the fields are still there next time');

nudge.querySelector('.fw-story-nudge-close').click();
assert.equal(nudge.hidden, true, 'the invitation can be dismissed');

// ── the tour ───────────────────────────────────────────────────────────────
const tour = d.querySelector('.app > .fw-tour');
assert(tour && tour.hidden, 'the tour exists and starts hidden');
assert.equal(tour.getAttribute('role'), 'dialog');
const next = tour.querySelector('.fw-tour-next');
const title = tour.querySelector('.fw-tour-title');

window.FAITHFUL_MOBILE_WELCOME.startTour();
assert.equal(tour.hidden, false);
assert.equal(d.getElementById('screen-home').getAttribute('aria-hidden'), 'true', 'the page under the tour is hidden from a screen reader');
assert(d.querySelector('.app').classList.contains('fw-touring'));
const titles = [title.textContent];
for (let i = 1; i < window.FAITHFUL_MOBILE_WELCOME.steps; i++) { next.click(); titles.push(title.textContent); }
assert.deepEqual(titles, ['Follow the message', 'Find your people', 'Meet your leader', 'Ask GRACE', 'Begin your story']);
assert.equal(next.textContent, 'Add my story');
next.click();
assert.equal(tour.hidden, true);
assert.equal(shown.at(-1), 'destination:my-story', 'the last step hands off to My story');
assert.equal(d.getElementById('screen-home').getAttribute('aria-hidden'), null, 'and the page is handed back');
assert.equal(JSON.parse(window.localStorage.getItem('grace.faithful.mobile.welcome.v1')).tour, 'done');

window.FAITHFUL_MOBILE_WELCOME.startTour();
tour.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert.equal(tour.hidden, true, 'Escape leaves the tour');

// Every step has to point at something the phone's Home really has. The old
// in-row tour had two steps out of four that highlighted nothing.
const sources = ['grace_faithful_church_members_card_ios_app.html', 'faithful-mobile-refinement.js', 'faithful-mobile-finish.js'].map(read).join('\n');
for (const [, selector] of welcome.matchAll(/\n {4}\['([^']+)', '[^']+', '/g)) {
  const name = selector.split(/[ >]/).at(-1).replace(/^[.#]/, '');
  assert(sources.includes(name), `tour step points at "${selector}", and "${name}" is not built anywhere on the phone`);
}
// The spotlight has to land on its target, and that failed twice for reasons a
// reader of the code would not guess:
//  - the list scrolls smoothly by stylesheet, so after scrollIntoView the target
//    was measured while still moving. The scroll position is set outright now;
//  - the page can move under a step (it did: a toast made the hero taller), so
//    the spotlight is re-measured while the tour is open, and the timer stops.
assert(!/scrollIntoView\(\{ block: 'center'/.test(welcome), 'tour steps do not rely on scrollIntoView to centre the target');
assert(/home\.scrollTop = Math\.max\(0,/.test(welcome), 'the scroll position is set directly');
assert(/follow = setInterval\(/.test(welcome) && /clearInterval\(follow\)/.test(welcome), 'the spotlight follows its target, and stops following on close');
// The dimming is a filled layer with the spotlight cut out -- not a 2000px
// box-shadow, which repainted unreliably as the hole moved.
assert(/dim\.style\.clipPath = 'path\(evenodd,/.test(welcome), 'the dimming is a clip-path cut-out');
// Not `inert` either: taps, the Tab trap and aria-hidden do the same job.
assert(!/\.inert\s*=/.test(welcome), 'the tour does not use inert to block the page');
assert(!/localStorage\.setItem\(KEY, JSON\.stringify\((?!seen)/.test(welcome), 'only the "seen" flags are stored');

// ── the other tabs: one tip, once ──────────────────────────────────────────
const give = d.getElementById('screen-give');
give.classList.add('active');
await new Promise(r => setTimeout(r, 420));
const tip = give.querySelector(':scope > .fw-tip');
assert(tip, 'the first visit to a tab shows its tip');
assert.equal(tip.querySelector('h2').textContent, 'Get to know your card', 'in the row\'s own words, read at the time');
assert.equal(tip.querySelector('p').textContent, 'How the card works.');
tip.querySelector('.fw-tip-ok').click();
give.classList.remove('active'); give.classList.add('active');
await new Promise(r => setTimeout(r, 420));
assert.equal(give.querySelector(':scope > .fw-tip'), null, 'and never again');

// ── the way back in ────────────────────────────────────────────────────────
const chips = [...d.querySelectorAll('#app-drawer .fw-drawer-chip')].map(b => b.textContent);
assert.deepEqual(chips, ['Take the tour', 'My story', 'Feedback']);

// ── wiring ─────────────────────────────────────────────────────────────────
const html = read('grace_faithful_church_members_card_ios_app.html');
assert(html.indexOf('faithful-preferences.js') < html.indexOf('faithful-mobile-welcome.js'), 'loads after the script whose form it moves');
assert(html.indexOf('faithful-destinations.js') < html.indexOf('faithful-mobile-welcome.js'), 'and after the one that builds the My story screen');
const destinations = read('faithful-destinations.js');
assert(/if \(mobile\) \{\s*pages\['my-story'\]/.test(destinations), 'My story is a mobile-only screen; the desktop portal keeps the form on Home');
assert(!/rel="stylesheet" href="faithful-mobile-welcome\.css"/.test(read('member-portal.html')), 'the desktop portal does not load this layer');
const css = read('faithful-mobile-welcome.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@(media|keyframes)[^{]*\{/g, '');
for (const m of css.matchAll(/([^{}]+)\{/g)) {
  for (const sel of m[1].replace(/\([^()]*\)/g, '').split(',')) {
    const s = sel.trim();
    assert(s.startsWith('.app') || s === 'from', `welcome layer selector is not scoped under .app: "${s}"`);
  }
}

console.log('PASS: My story moves to its own screen and still saves through the original handler; the Home invitation hides, returns and dismisses; the tour runs its five steps, hands off, restores the page and points only at things the phone has; each tab tips once; the menu has both ways back. Spotlight geometry not covered (no layout in jsdom).');
