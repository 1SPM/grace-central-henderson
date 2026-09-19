/* The Faithful phone app is one system, page to page.
 *
 * It was assembled from about thirty layers, each with its own sizes, weights,
 * families, radii and blues. It now holds to:
 *
 *   type     28 22 17 15 13 12, and 16 for fields (iOS zooms the page when a
 *            field under 16px takes focus)
 *   weights  400 600 700 -- the only Inter files shipped; Playfair ships 700,
 *            so any other weight is the browser faking it
 *   faces    the display serif and the UI sans, nothing else
 *   copy     no em dashes, and one name per place
 *
 * This reads source text. It proves the declarations are on the system, not
 * what a given screen renders; the runtime audit during the change found no
 * off-system font on any screen.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const DIR = 'apps/member-web/public/tenants/faithful/';
const read = f => fs.readFileSync(DIR + f, 'utf8');
const PAGE = 'grace_faithful_church_members_card_ios_app.html';
const html = read(PAGE);

// Phone-only style sources: the page's own <style> and the faithful-mobile-* layers.
const phoneCss = [
  ['page <style>', [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')],
  // only the ones this page loads: faithful-mobile-story.css, for one, belongs to the desktop portal
  ...fs.readdirSync(DIR).filter(f => /^faithful-mobile-.*\.css$/.test(f) && html.includes('href="' + f + '"')).map(f => [f, read(f)]),
];

// Chrome that is exempt on purpose: numeric count badges, the desktop mockup's
// fake status bar, and the microprint on the back of the card artwork.
const EXEMPT = /nav-badge|tab-badge|\.status|\.island|mc-back|mc-front|members-card/;   // the card artwork sets its number in a monospace, as cards do
const SCALE = new Set([12, 13, 15, 17, 22, 28]);

for (const [name, raw] of phoneCss) {
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim(), block = m[2];
    if (EXEMPT.test(selector)) continue;
    const field = /(^|[\s,>+~(])(input|textarea|select)\b|::placeholder|home-grace-input/.test(selector);
    const sizes = [...block.matchAll(/font-size\s*:\s*([\d.]+)px/g), ...block.matchAll(/(?<![-\w])font\s*:[^;}]*?\s([\d.]+)px/g)].map(x => parseFloat(x[1]));
    for (const px of sizes) {
      if (px < 9 || px > 40) continue;                     // icons and display art, not reading text
      assert(SCALE.has(px) || (field && px === 16),
        `${name}: "${selector.slice(0, 70)}" sets ${px}px, which is not on the type scale`);
    }
    for (const w of [...block.matchAll(/font-weight\s*:\s*(\d{3})/g), ...block.matchAll(/(?<![-\w])font\s*:\s*(?:italic\s+)?(\d{3})\s/g)]) {
      assert(['400', '600', '700'].includes(w[1]), `${name}: "${selector.slice(0, 70)}" uses weight ${w[1]}; only 400, 600 and 700 are shipped`);
    }
    for (const f of block.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
      const first = f[1].split(',')[0].trim().toLowerCase();
      assert(/^var\(--|^inherit|^'?inter|^'?playfair/.test(first),
        `${name}: "${selector.slice(0, 70)}" leads with ${first}; the two faces are the display serif and the UI sans`);
    }
  }
}

// ── the theme cannot reach the desktop portal or another tenant ─────────────
{
  for (const f of ['faithful-mobile-theme.css', 'faithful-mobile-theme.generated.css']) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@(media|supports)[^{]*\{/g, '');
    for (const m of css.matchAll(/([^{}]+)\{/g)) {
      for (const sel of m[1].replace(/\((?:[^()]|\([^()]*\))*\)/g, '').split(',')) {
        const s = sel.trim();
        assert(s.startsWith('.app') || s.startsWith('.device'), `${f}: "${s.slice(0, 60)}" is not scoped to the phone page`);
      }
    }
    assert(!read('member-portal.html').includes(f), `${f} is not loaded by the desktop portal`);
  }
  // App-wide first, then the screen-specific layers, so a tie goes to the screen.
  const order = ['faithful-mobile-finish.css', 'faithful-mobile-theme.generated.css', 'faithful-mobile-theme.css', 'faithful-mobile-home.css', 'faithful-mobile-welcome.css'].map(f => html.indexOf('href="' + f + '"'));
  assert(order.every(i => i > 0) && order.every((v, i) => !i || v > order[i - 1]), 'theme sheets load after the older layers and before Home and the welcome layer');
  // A custom property resolves where it is declared, so the derived tokens
  // have to be restated next to the base ones or they stay blue.
  const theme = read('faithful-mobile-theme.css');
  for (const token of ['--grace-navy-950', '--text', '--accent', '--brand-accent', '--ios-text', '--fm-control']) {
    assert(new RegExp(token + '\\s*:').test(theme), `the theme restates ${token} for the phone`);
  }
}

// ── spacing ────────────────────────────────────────────────────────────────
// One gutter and one rhythm on every screen but Home (which has its own
// layer): 16px at the sides and top, 16px between blocks. Measured during the
// change: Care ran a 14px gutter, tops ran 12 to 32px, and several blocks
// touched. The rhythm rule is the file's only use of !important, because a
// number of blocks carry their margin as an inline style attribute.
{
  const theme = read('faithful-mobile-theme.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert(/:not\(#screen-home\) > \.scroll:not\(\.fd-page\)\{padding-top:16px;padding-left:16px;padding-right:16px\}/.test(theme), 'every screen has the 16px gutter and top');
  assert(/margin-top:0!important;margin-bottom:16px!important/.test(theme), 'blocks are 16px apart, even where the markup sets an inline margin');
  const important = theme.match(/[^{}]+\{[^{}]*!important[^{}]*\}/g) || [];
  assert(important.every(r => /margin-(top|bottom):[^;]*!important/.test(r) || /background:var\(--dv-(well|navy-fill)\)!important/.test(r)),
    '!important is used for the spacing rhythm and the icon wells (both fight inline styles), and nowhere else');
  // A card holds rows. Care's options were cards inside a padding-less card.
  assert(/\.card > \.care-option\{[^}]*border:0;border-top:1px solid/.test(theme), 'care options are rows inside their card, not cards of their own');
}

// ── copy ───────────────────────────────────────────────────────────────────
{
  // Strips what nobody reads (styles, comments) so only copy is searched. Run
  // to a fixed point: one pass over "<sty<style>…</style>le>" would leave a
  // "<style" behind. Nothing here is rendered, but a stripper should strip.
  const NOT_COPY = /<style[\s\S]*?<\/style>|<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|(?<![:"'\\])\/\/[^\n]*/g;
  const protect = s => { let prev; do { prev = s; s = s.replace(NOT_COPY, ''); } while (s !== prev); return s; };
  const files = [PAGE, ...fs.readdirSync(DIR).filter(f => /^faithful-.*\.js$/.test(f) && html.includes('src="' + f))];
  for (const f of files) {
    const hit = /[^\n]{0,40}\S \u2014 \S[^\n]{0,30}/.exec(protect(read(f)));
    assert(!hit, `${f}: an em dash between words in readable copy: "${hit?.[0].trim()}"`);
  }
  // One name per place: the tab, the top bar and the menu agree.
  assert(/data-tab="profile"[\s\S]{0,200}<span>Reflect<\/span>/.test(html), 'the Reflect tab is labelled Reflect, like its page and its menu row');
  assert(!/<span>Journey<\/span>/.test(html), 'no tab is still called Journey');
  assert(/<div class="home-nav-title">Connect<\/div>/.test(html) && !/My Community</.test(html), 'the Connect tab opens a page titled Connect');
  assert(/give:'Give'/.test(read('faithful-mobile-navigation.js')), 'the menu calls Give what the tab calls it');
  assert(!/both buttons open/.test(html), 'the landing note does not describe a second button that is not there');
}

console.log('PASS: phone-only styles hold to the type scale, three weights and two faces; the theme is scoped to the phone page and ordered so screens win ties; no em dashes in readable copy; place names agree. Source text only.');
