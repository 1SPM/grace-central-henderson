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

console.log('PASS: on a phone the simulated chrome is hidden and the real insets are used; on a desktop the mockup is intact. Rendering on real hardware not verified.');
