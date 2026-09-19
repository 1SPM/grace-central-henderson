/* The Faithful mobile page is two things at once, and they pull in opposite
 * directions.
 *
 * On a desktop it is a MOCKUP: a phone frame, a Dynamic Island, and a status
 * bar reading 9:41 / 5G — the marketing shot. On a phone, reached by the QR at
 * the end of the walkthrough, it has to read as an APP. The frame and island
 * were already dropped below 500px; the fake status bar was not, so a member
 * saw a second clock and battery sitting under their real one.
 *
 * The insets are the other half. --ios-safe-top / --ios-safe-bot are hardcoded
 * stand-ins for one iPhone (47px / 34px). Real devices differ, and both are 0
 * on older phones and in landscape, so on a real device they have to come from
 * env() or the app is padded for a phone the member is not holding.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const PAGE = 'apps/member-web/public/tenants/faithful/grace_faithful_church_members_card_ios_app.html';
const html = fs.readFileSync(PAGE, 'utf8');

// The phone-width block, which is where mockup chrome gets stripped.
const m = /@media \(max-width:500px\)\{([\s\S]*?)\n\}/.exec(html);
assert(m, 'the max-width:500px block still exists — it is what makes this an app rather than a mockup');
const phone = m[1];

// ── the block has to be valid CSS, not just contain the right text ─────────
//
// Every assertion below matches source text. That is not the same as the rule
// taking effect: an unbalanced comment turns the prose around these rules into
// a garbage selector that swallows the rule after it, and the page still loads,
// still looks plausible, and the greps below still pass. That happened here.
{
  assert.equal((phone.match(/\/\*/g) || []).length, (phone.match(/\*\//g) || []).length,
    'unbalanced comment in the phone block — the prose becomes a selector and eats the next rule');

  const noComments = phone.replace(/\/\*[\s\S]*?\*\//g, '');
  // What is left must be rules: "sel{decls}", or the lines of a multi-line rule.
  const stray = noComments
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => !/[{};]/.test(l) && l !== '}');
  assert.deepEqual(stray, [],
    `prose outside a comment in the phone block — it parses as a selector: ${stray.join(' | ')}`);
}

// ── the mockup chrome must not survive onto a real device ──────────────────
assert(/\.island\{display:none\}/.test(phone), 'the Dynamic Island is hidden on a phone');
assert(/\.device \.status\{display:none\}/.test(phone),
  'the simulated status bar (9:41 / 5G) must be hidden on a phone — iOS draws the real one, ' +
  'and two clocks is the loudest possible "this is a mockup" tell');
assert(/border-radius:0/.test(phone), 'the device frame is squared off to fill the screen');

// ── the insets must come from the device, not from a guess ─────────────────
assert(/--ios-safe-top:\s*0px/.test(phone),
  'the simulated 47px top inset is zeroed; the real one comes from padding below');
assert(/--ios-safe-bot:\s*env\(safe-area-inset-bottom/.test(phone),
  'the bottom inset comes from env(), so the tab bar clears the home indicator on ' +
  'devices that have one and wastes no space on devices that do not');
// --ios-tab-chrome-h is a calc() over --ios-safe-bot, declared on :root. A
// custom property's var() is resolved where it is DECLARED, so overriding the
// inset on .device alone left the tab zone sized for the 34px guess: on any
// phone whose real inset is 0 that was a blank 34px band above the tab bar.
// The dependent value has to be restated next to the override.
assert(/--ios-tab-chrome-h:\s*calc\([^;]*var\(--ios-safe-bot\)/.test(phone),
  'the tab zone height is recomputed from the real inset, or it keeps the desktop 34px');
assert(/\.device \.app\{padding-top:env\(safe-area-inset-top/.test(phone),
  'the app clears the real status bar / notch');
// Qualified with .device on purpose: the base .status and .app rules come LATER
// in the file, so an unqualified override loses at equal specificity — and an
// emulator hides that, because env() is 0 there regardless.
assert(/overscroll-behavior:\s*none/.test(phone),
  'rubber-band scrolling past the content is a web tell, not an app one');

// viewport-fit=cover is what makes env() non-zero at all. Without it every
// inset above silently resolves to 0 and the fixes above do nothing.
assert(/viewport-fit=cover/.test(html),
  'viewport-fit=cover is required or env(safe-area-inset-*) is always 0');

// ── Add to Home Screen ─────────────────────────────────────────────────────
const icon = /<link rel="apple-touch-icon" href="([^"]+)"/.exec(html);
assert(icon, 'an apple-touch-icon, or iOS uses a screenshot of the page as the icon');
const resolved = 'apps/member-web/public/' + icon[1].replace(/^\.\.\/\.\.\//, '');
assert(fs.existsSync(resolved), `the icon must exist on disk: ${resolved}`);
assert(/<meta name="theme-color"/.test(html), 'a theme-color for the browser chrome');

// Light app background + black-translucent would render white status text on
// it. If someone changes one, this is the reminder to check the other.
const bar = /<meta name="apple-mobile-web-app-status-bar-style" content="([^"]+)"/.exec(html);
assert(bar, 'the status bar style is declared');
if (bar[1] === 'black-translucent') {
  assert.fail('black-translucent puts white status text over the light app background (#f3f4f6) — ' +
    'switch the app background too, or keep "default"');
}

// ── the desktop mockup must still be a mockup ──────────────────────────────
// All of the above is scoped to phone width. If the simulated chrome were
// removed outright, the desktop demo would lose the phone it is showing.
assert(/<div class="status">[\s\S]*?9:41/.test(html), 'the simulated status bar still exists for the desktop mockup');
assert(/class="island"/.test(html), 'the Dynamic Island still exists for the desktop mockup');

// ── the home screen reads in the same order as the portal ──────────────────
//
// The phone had grown its own order: the shortcuts row above the "Your church,
// at a glance" dropdown, and the IMPACT summary three sections below where the
// portal puts the card. Someone shown the portal and then handed the phone was
// reading two different pages -- the opposite of what a demo of one product
// should do.
{
  const finish = fs.readFileSync('apps/member-web/public/tenants/faithful/faithful-mobile-finish.js', 'utf8');
  const block = /\[\s*\n([\s\S]*?)\]\.forEach\(sel =>/.exec(finish);
  assert(block, 'the home order is still declared as one explicit list');
  const order = [...block[1].matchAll(/'(\.[a-z-]+)'/g)].map(m => m[1]);

  assert.deepEqual(order, [
    '.home-hero',
    '.home-hero-leader',
    '.fp-preferences',
    '.mobile-impact-summary',
    '.mobile-shortcuts',
    '.dash-mod',
    '.home-grace-wrap',
    '.mobile-community-summary',
    '.fm-survey-invite',
  ], 'the phone home order must match the portal: hero, leader, the onboarding dropdown, ' +
     'IMPACT, this week, pathways, find your way, community, survey invite');

  // Same order as the portal, but the phone stops early. The prayer wall,
  // "People to turn to" and "Pray with your church" are the tail of the
  // portal's My Church; on a phone they made Home six screens long, so they
  // live one tap away instead. Relocated, not deleted -- each must still be
  // built and placed somewhere, and Home must keep a way to reach prayer.
  for (const sel of ['.cn-widget', '.fm-care', '.fm-prayer']) {
    assert(!order.includes(sel), `${sel} is no longer a Home section; it was moved to keep Home short`);
  }
  assert(/#screen-care > \.scroll/.test(finish) && /insertBefore\(care,/.test(finish),
    '"People to turn to" is placed on the Care screen');
  assert(/getElementById\('cn-panel-community'\)/.test(finish) && /\[prayer, wall\]/.test(finish),
    '"Pray with your church" and the prayer wall are placed on Connect, together and in that order');
  assert(/fm-prayer-link/.test(finish) && /openCnReelsFull\(\)/.test(finish),
    'Home keeps a link to the prayer wall');
  // The wall is moved rather than copied, so the opener has to follow it.
  assert(/function openCnReelsFull\(\) \{[\s\S]{0,200}wall\.closest\('\.screen'\)/.test(html),
    'openCnReelsFull() opens whichever screen holds the wall, not a hardcoded Home');

  // The two that were actually wrong, stated as relationships so the intent
  // survives a future insertion into the list.
  assert(order.indexOf('.fp-preferences') < order.indexOf('.mobile-shortcuts'),
    'the onboarding dropdown comes before the shortcuts row, as it does on the portal');
  assert(order.indexOf('.mobile-impact-summary') < order.indexOf('.dash-mod'),
    'IMPACT comes before the pathways, as it does on the portal');
  assert(order.indexOf('.fm-survey-invite') === order.length - 1,
    'the survey invitation closes the walkthrough');

  // Ordering runs before the footer is reclaimed, or the footer lands mid-page.
  // Home's footer specifically -- the Care screen's footer is also looked up,
  // earlier, to place a section above it.
  assert(finish.indexOf('].forEach') < finish.indexOf("home.querySelector(':scope > .fd-footer')"),
    'the footer is moved last, after the sections are ordered');
}

// ── Home is styled by one layer, loaded after the modules it unifies ───────
{
  const css = fs.readFileSync('apps/member-web/public/tenants/faithful/faithful-mobile-home.css', 'utf8');
  assert(html.indexOf('faithful-mobile-finish.css') < html.indexOf('faithful-mobile-home.css'),
    'the home layer loads after the finish layer, or equal-specificity rules there win');
  // :is() takes the specificity of its most specific argument and lends it to
  // the whole list. That happened here twice: an #id, then a ".a .b", in the
  // shared "card" rule outranked every per-module adjustment after it, and the
  // page still looked almost right. So: no IDs in any :is(), and the card rule
  // that sets border-radius for everything is a plain list with no :is() at all.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of bare.matchAll(/:is\(([^)]*)\)/g)) {
    assert(!m[1].includes('#'), `no IDs inside :is() in the home layer -- found ":is(${m[1]})"`);
  }
  const cardRule = /([^{}]+)\{[^}]*border-radius:var\(--fh-radius\);box-shadow/.exec(bare);
  assert(cardRule && !cardRule[1].includes(':is('), 'the shared card rule is a plain selector list');
  // Every selector starts with .app, so the layer cannot reach another page.
  // Commas inside :is(...) are not selector separators, hence the paren strip.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '');
  for (const m of rules.matchAll(/([^{}]+)\{/g)) {
    for (const sel of m[1].replace(/\([^()]*\)/g, '').split(',')) {
      assert(sel.trim().startsWith('.app'), `home layer selector is not scoped under .app: "${sel.trim()}"`);
    }
  }
}

console.log('PASS: on a phone the simulated chrome is hidden, the real insets are used and the home order matches the portal; on a desktop the mockup is intact. Rendering on real hardware not verified.');
