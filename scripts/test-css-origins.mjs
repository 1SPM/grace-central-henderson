/* Every remote origin a served stylesheet reaches for must be allowed by the
 * CSP that ships with the page, or the request is refused at load time.
 *
 * This is cheap to get wrong and expensive to notice: grace-fonts.css listed a
 * jsdelivr woff2 after each local .ttf, the browser preferred the woff2, and the
 * CSP refused it. The typography still looked right -- it fell back to the local
 * file -- so the only symptom was four console errors on every page load. Noise
 * like that is what hides the errors you actually need to see.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const csp = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

/** Every distinct font-src / style-src value declared anywhere in vercel.json. */
function allowedHosts(directive) {
  const out = new Set();
  const walk = node => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') return Object.values(node).forEach(walk);
    if (typeof node !== 'string' || !node.includes(`${directive} `)) return;
    for (const part of node.split(';')) {
      const t = part.trim();
      if (!t.startsWith(`${directive} `)) continue;
      t.slice(directive.length).trim().split(/\s+/).forEach(v => out.add(v));
    }
  };
  walk(csp);
  return out;
}

const roots = ['apps/member-web/public', 'marketing'];
const sheets = [];
for (const root of roots) {
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
      else if (e.name.endsWith('.css')) sheets.push(p);
    }
  };
  if (fs.existsSync(root)) walk(root);
}
assert(sheets.length > 0, 'found no stylesheets to check — the paths are probably stale');

const fontHosts = allowedHosts('font-src');
const styleHosts = allowedHosts('style-src');
assert(fontHosts.size > 0, 'vercel.json declares no font-src; this test would pass vacuously');

const problems = [];
for (const file of sheets) {
  const css = fs.readFileSync(file, 'utf8');
  // Only url(...) references reach the network; ignore comments mentioning a host.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of stripped.matchAll(/url\(\s*['"]?(https?:\/\/[^'")\s]+)/g)) {
    const origin = new URL(m[1]).origin;
    const inside = /@font-face/.test(stripped.slice(0, m.index));
    const allowed = inside ? fontHosts : new Set([...fontHosts, ...styleHosts]);
    if (!allowed.has(origin)) problems.push(`${file}\n    ${origin} is not in ${inside ? 'font-src' : 'font-src/style-src'}`);
  }
  for (const m of stripped.matchAll(/@import\s+(?:url\()?['"](https?:\/\/[^'"]+)/g)) {
    const origin = new URL(m[1]).origin;
    if (!styleHosts.has(origin)) problems.push(`${file}\n    @import ${origin} is not in style-src`);
  }
}

// ── local url() targets must exist ─────────────────────────────────────────
//
// A @font-face pointing at a file that is not there does not error visibly: the
// face just fails and the text renders in the next family down the stack. That
// is how a rename slips through -- the page still looks plausible. Checked here
// because this suite already has every stylesheet open.
const missing = [];
for (const file of sheets) {
  const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/url\(\s*['"]?([^'")\s]+)/g)) {
    const ref = m[1];
    if (/^(https?:|data:|#|\/\/)/.test(ref)) continue;
    const target = ref.startsWith('/')
      ? path.join(file.startsWith('marketing') ? 'marketing' : 'apps/member-web/public', ref)
      : path.join(path.dirname(file), ref);
    if (!fs.existsSync(target.split('?')[0].split('#')[0])) missing.push(`${file}\n    -> ${ref} (resolved: ${target})`);
  }
}
assert.deepEqual(missing, [],
  `stylesheets reference files that do not exist:\n  ${missing.join('\n  ')}`);

assert.deepEqual(problems, [],
  `stylesheets reach origins the CSP refuses:\n  ${problems.join('\n  ')}`);

console.log(`PASS: ${sheets.length} stylesheets — every remote origin allowed by the shipped CSP, every local url() present on disk. Runtime font rendering not verified.`);
