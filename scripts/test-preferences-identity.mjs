/* The onboarding layer must survive being signed in.
 *
 * faithful-preferences.js builds every page-guide dropdown and every "Let us
 * know" bar at runtime -- none of it is in the HTML. It used to return outright
 * when Clerk reported a user that the page could not resolve to a member, which
 * removed all of it. The workshop asks people to sign in, so the path that most
 * needed the tutorial was the one that lost it, and it failed silently: a page
 * with no dropdowns looks like a page that was designed without them.
 *
 * The thing worth protecting is the demo persona's saved answers, not the
 * tutorial. Both halves are pinned here.
 */
import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const SRC = fs.readFileSync('apps/member-web/public/tenants/faithful/faithful-preferences.js', 'utf8');
const DEMO_KEY = 'grace.preferences.faithful.demo-maya.v1';
const DEMO_ANSWERS = {homeConnection: {connection: 'Maya saved this, not you'}};

async function render({clerkUser = null, memberIdentity = null} = {}) {
  const dom = new JSDOM(
    '<div class="sec active" id="sec-home"><div class="dash-hero"></div></div>' +
    '<div class="sec" id="sec-network"></div><div class="sec" id="sec-profile"></div>',
    {url: 'https://grace-members.vercel.app/tenants/faithful/member-portal.html', runScripts: 'outside-only'},
  );
  const w = dom.window, d = w.document;
  w.localStorage.setItem(DEMO_KEY, JSON.stringify(DEMO_ANSWERS));
  w.Clerk = clerkUser ? {user: {id: clerkUser}} : {};
  w.GRACE_SESSION = {ready: Promise.resolve(memberIdentity ? {memberIdentity} : null)};
  w.eval(SRC);
  await new Promise(r => setTimeout(r, 60));
  const text = d.body.textContent;
  const out = {
    details: d.querySelectorAll('details').length,
    storyBars: d.querySelectorAll('.fp-story-bar').length,
    pageGuides: d.querySelectorAll('.fp-page-guide').length,
    showsMayasAnswer: text.includes('Maya saved this, not you'),
    saysDemoPreferences: /Demo preferences for Maya/.test(text),
    saysNothingSaved: /nothing here will be saved/i.test(text),
    storedAfter: w.localStorage.getItem(DEMO_KEY),
  };
  w.close();
  return out;
}

// ── anonymous: the demo persona's own page ─────────────────────────────────
const anon = await render();
assert(anon.details > 0, 'anonymous: the page-guide dropdown is built');
assert(anon.storyBars > 0, 'anonymous: the "Let us know" bar is built');
assert(anon.showsMayasAnswer,
  'anonymous: this IS the demo persona\'s page, so her saved answers are hers to see — ' +
  'if this ever fails, the fix below has gone too far and broken the demo itself');

// ── signed in, member resolved ─────────────────────────────────────────────
const member = await render({clerkUser: 'user_abc', memberIdentity: 'user_abc'});
assert(member.details > 0, 'resolved member: the dropdown is built');
assert(member.storyBars > 0, 'resolved member: the "Let us know" bar is built');
assert(!member.showsMayasAnswer, 'resolved member: never shown the demo persona\'s answers');

// ── signed in, member NOT resolved — the regression ────────────────────────
const unresolved = await render({clerkUser: 'user_3Ge90H8'});
assert.equal(unresolved.details, anon.details,
  'signed in but unresolved: the dropdowns must still be built — this returned 0 before, ' +
  'which silently removed the whole onboarding from a signed-in member\'s portal');
assert.equal(unresolved.storyBars, anon.storyBars,
  'signed in but unresolved: every "Let us know" bar must still be built');
assert.equal(unresolved.pageGuides, anon.pageGuides,
  'signed in but unresolved: the page info must still be inside the dropdown');

// …and the half that must NOT come back
assert(!unresolved.showsMayasAnswer,
  'signed in but unresolved: the demo persona\'s saved answers must not be loaded into the form');
// The copy shown in that state is chosen in the source; this fixture does not
// render the paragraph it lands in, so pin the branch rather than pretend to
// have seen it on screen.
{
  const src = SRC.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert(/const unresolvedAccount = !memberId && !!window\.Clerk\?\.user;/.test(src),
    'the unresolved-account state is still computed');
  assert(!/if \(!memberId && window\.Clerk\?\.user\) return/.test(src),
    'the outright return must not come back — it is what removed the onboarding');
  assert(/unresolvedAccount\s*\n?\s*\?\s*'Signed in, but this preview could not confirm your account/.test(src),
    'that state still gets copy saying plainly that nothing will be saved');
}
assert.equal(unresolved.storedAfter, JSON.stringify(DEMO_ANSWERS),
  'signed in but unresolved: the demo persona\'s stored answers are left untouched, not overwritten');

console.log(`PASS: the onboarding renders anonymous (${anon.details} dropdown/${anon.storyBars} story bar), for a resolved member, and for a signed-in unresolved account — which no longer loads or relabels the demo answers. Visual layout not verified.`);
