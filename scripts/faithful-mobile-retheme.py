#!/usr/bin/env python3
"""One-off: bring the Faithful phone app onto one type scale and one palette.

  python3 scripts/faithful-mobile-retheme.py apps/member-web/public/tenants/faithful

Idempotent: values already on the scale and palette are left alone, so it is
safe to run again after one of the shared files changes.

A files (phone only)      rewritten in place.
B files (desktop uses too) left alone; a phone-scoped override sheet is generated.

Type:    sizes snap to 28 22 17 15 13 12 (fields stay 16: iOS zooms under that);
         weights to 400 600 700 (the only Inter files shipped; Playfair ships 700);
         Georgia/Times -> the display face, Arial/Helvetica/system -> the UI face.
Colour:  Faithful's blues (hue 190-226) rotate to the indigo at 238, lightness
         kept, saturation capped so mid-tones land on the navy, not royal blue.
"""
import colorsys, os, re, sys

ROOT = sys.argv[1]
PAGE = 'grace_faithful_church_members_card_ios_app.html'
A_CSS = ['faithful-mobile-refinement.css', 'faithful-mobile-connect.css', 'faithful-mobile-journey.css',
         'faithful-mobile-navigation.css', 'faithful-mobile-cover.css', 'faithful-mobile-care.css',
         'faithful-mobile-controls.css', 'faithful-mobile-finish.css']
B_CSS = ['faithful-leader-profiles.css', 'faithful-destinations.css', 'faithful-settings.css',
         'faithful-impact-exercise.css', 'faithful-preferences.css', 'faithful-weekly-journey.css',
         'faithful-weekly-editorial.css', 'faithful-guide-finish.css', 'faithful-member-profile.css',
         '../../shared/grace-pilot-survey.css']
OUT = 'faithful-mobile-theme.generated.css'

DISPLAY = "var(--font-display,'Playfair Display'),Georgia,serif"
UI = "var(--font-ui,'Inter'),system-ui,sans-serif"
stats = {'colour': 0, 'size': 0, 'weight': 0, 'family': 0}

# ── colour ────────────────────────────────────────────────────────────────
def shift(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    deg = h * 360
    if s <= 0.22 or not (190 <= deg <= 226):
        return None
    s2 = min(s, 0.46 if l < 0.62 else 0.58)
    if l < 0.2: l = max(l, 0.17)          # the near-black blues become the deep navy, not black
    r2, g2, b2 = colorsys.hls_to_rgb(238 / 360, l, s2)
    return tuple(round(x * 255) for x in (r2, g2, b2))

def hex_sub(m):
    raw = m.group(1)
    if len(raw) in (3, 4):
        r, g, b = (int(c * 2, 16) for c in raw[:3]); a = raw[3] * 2 if len(raw) == 4 else ''
    else:
        r, g, b = (int(raw[i:i + 2], 16) for i in (0, 2, 4)); a = raw[6:8]
    out = shift(r, g, b)
    if not out: return m.group(0)
    stats['colour'] += 1
    return '#%02x%02x%02x%s' % (*out, a)

def rgb_sub(m):
    r, g, b = int(m.group(2)), int(m.group(3)), int(m.group(4))
    out = shift(r, g, b)
    if not out: return m.group(0)
    stats['colour'] += 1
    return '%s(%d,%d,%d%s)' % (m.group(1), *out, m.group(5) or '')

HEX = re.compile(r'#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])')
RGB = re.compile(r'\b(rgba?)\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)')
def colours(text):
    return RGB.sub(rgb_sub, HEX.sub(hex_sub, text))

# ── type ──────────────────────────────────────────────────────────────────
def snap(px, heavy):
    if px < 9 or px > 40: return None
    if px < 12.5: return 12
    if px < 14: return 13
    if px < 16: return 15
    if px == 16: return 17 if heavy else 15
    if px < 19.5: return 17
    if px <= 25: return 22
    return 28

def to_px(num, unit):
    v = float(num)
    return v * 16 if unit == 'rem' else v

def weight(w):
    try: n = int(w)
    except ValueError: return w
    new = 400 if n < 450 else 600 if n < 650 else 700
    if new != n: stats['weight'] += 1
    return str(new)

def family(value):
    low = value.lower()
    if 'font-display' in low or 'font-ui' in low or 'font-body' in low or 'font-brand' in low or 'inherit' in low:
        return value
    if re.search(r'georgia|times|playfair|(?<!sans-)serif\s*$', low) and 'sans-serif' not in low.split(',')[-1]:
        stats['family'] += 1; return DISPLAY
    if re.search(r'arial|helvetica|system-ui|apple-system|segoe|roboto|inter|sans-serif', low):
        stats['family'] += 1; return UI
    return value

def declarations(block, selector):
    """Transform one declaration block. Returns the new text."""
    field = bool(re.search(r'(^|[\s,>+~(])(input|textarea|select)\b|::placeholder', selector))
    # Numeric badges and the desktop mockup's fake status bar are chrome, not
    # reading text: a 9px count in a 16px circle does not want to be 12px.
    if re.search(r'nav-badge|tab-badge|\.status|\.island|mc-back|mc-front', selector): 
        return colours(block)
    heavy = bool(re.search(r'font(?:-weight)?\s*:[^;]*\b(6|7|8|9)00\b|font-weight\s*:\s*bold', block))

    def size_decl(m):
        px = to_px(m.group(2), m.group(3))
        if field: new = 16 if px <= 17 else snap(px, heavy)
        else: new = snap(px, heavy)
        if new is None or abs(new - px) < 0.01: return m.group(0)
        stats['size'] += 1
        return '%s%dpx' % (m.group(1), new)
    block = re.sub(r'(font-size\s*:\s*)([\d.]+)(px|rem)\b', size_decl, block)

    def shorthand(m):
        head, body = m.group(1), m.group(2)
        mm = re.match(r'\s*((?:(?:italic|normal|small-caps)\s+)*)(\d{3}\s+)?([\d.]+)(px|rem)(\s*/\s*[\d.]+(?:px|em|rem)?)?\s+(.+)$', body, re.S)
        if not mm: return m.group(0)
        style, w, num, unit, lh, fam = mm.groups()
        px = to_px(num, unit)
        hv = heavy or (w and int(w) >= 600)
        new = (16 if px <= 17 else snap(px, hv)) if field else snap(px, hv)
        if new is not None and abs(new - px) >= 0.01: stats['size'] += 1
        else: new = px
        w2 = (weight(w.strip()) + ' ') if w else ''
        return '%s%s%s%gpx%s %s' % (head, style, w2, new, lh or '', family(fam.strip()))
    block = re.sub(r'((?<![-\w])font\s*:\s*)([^;}]+)', shorthand, block)
    block = re.sub(r'(font-weight\s*:\s*)(\d{3})', lambda m: m.group(1) + weight(m.group(2)), block)
    block = re.sub(r'(font-family\s*:\s*)([^;}]+)', lambda m: m.group(1) + family(m.group(2).strip()), block)
    return colours(block)

# ── CSS walking ───────────────────────────────────────────────────────────
RULE = re.compile(r'([^{}]+)\{([^{}]*)\}')
def rewrite_css(text):
    """In place: every flat rule's declarations; @media wrappers pass through."""
    return RULE.sub(lambda m: m.group(1) + '{' + declarations(m.group(2), m.group(1)) + '}', text)

def scope(selector):
    out = []
    for part in re.split(r',(?![^()]*\))', selector):
        p = part.strip()
        if not p: continue
        if p.startswith('.app'): out.append('.app' + p)               # .app.app …: same element, more specific
        elif re.match(r'(html|body|:root)\b', p): continue      # desktop-portal selectors; nothing on the phone matches them
        else: out.append('.app ' + p)
    return ','.join(x for x in out if x)

def overrides(text, source):
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    lines = []
    def walk(chunk, wrap=None):
        pos = 0
        while pos < len(chunk):
            m = re.compile(r'\s*([^{}]+)\{').match(chunk, pos)
            if not m: break
            sel = m.group(1).strip(); start = m.end(); depth = 1; i = start
            while i < len(chunk) and depth:
                depth += chunk[i] == '{'; depth -= chunk[i] == '}'; i += 1
            body = chunk[start:i - 1]; pos = i
            if sel.startswith('@media') or sel.startswith('@supports'):
                walk(body, sel)
            elif sel.startswith('@'):
                continue
            else:
                new = declarations(body, sel)
                if new == body: continue
                old = dict(d.split(':', 1) for d in body.split(';') if ':' in d)
                changed = [d.strip() for d in new.split(';') if ':' in d and old.get(d.split(':', 1)[0]) != d.split(':', 1)[1]]
                s = scope(sel)
                if not s or not changed: continue
                rule = s + '{' + ';'.join(changed) + '}'
                lines.append((wrap + '{' + rule + '}') if wrap else rule)
    walk(text)
    return lines

# ── run ───────────────────────────────────────────────────────────────────
os.chdir(ROOT)
page = open(PAGE).read()
page = re.sub(r'(<style[^>]*>)(.*?)(</style>)', lambda m: m.group(1) + rewrite_css(m.group(2)) + m.group(3), page, flags=re.S)
page = re.sub(r'(\sstyle=")([^"]*)(")', lambda m: m.group(1) + declarations(m.group(2), '') + m.group(3), page)
# colours written into markup by the page's own scripts ('background:#e8edf8' and friends)
page = re.sub(r"((?:background|color|border(?:-[a-z]+)?|fill|stroke)\s*[:=]\s*['\"]?\s*)(#[0-9a-fA-F]{3,8})\b", lambda m: m.group(1) + colours(m.group(2)), page)
open(PAGE, 'w').write(page)
for f in A_CSS:
    t = open(f).read(); open(f, 'w').write(rewrite_css(t))
print('in place:', dict(stats))

before = dict(stats); out = []
for f in B_CSS:
    rules = overrides(open(f).read(), f)
    if rules: out.append('/* from ' + os.path.basename(f) + ' */\n' + '\n'.join(rules))
header = """/* GENERATED by scripts/faithful-mobile-retheme.py; do not hand-edit. Hand-written theme rules
 * live in faithful-mobile-theme.css.
 *
 * The files named below are shared with the desktop portal, so the phone's
 * type scale and palette cannot be written into them. This sheet restates only
 * the declarations that differ on the phone -- sizes snapped to
 * 28 22 17 15 13 12 (fields 16), weights to 400 600 700, families to the two
 * shipped faces, Faithful's blues rotated to the indigo -- scoped under .app,
 * which exists only on the phone page. If one of those files changes a size or
 * a colour, regenerate rather than patching here.
 */
"""
open(OUT, 'w').write(header + '\n'.join(out) + '\n')
print('generated:', {k: stats[k] - before[k] for k in stats}, '->', OUT, sum(len(o.split('\n')) - 1 for o in out), 'rules')
