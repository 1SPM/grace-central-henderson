/* Faithful mobile · the first visit.
 *
 * Every tab used to open with an expandable row -- "Your church, at a glance"
 * on Home -- holding three things needed once: an explanation of the page, a
 * guided tour, and a "tell us about you" form. Needed once, shown forever:
 * 95 to 145px near the top of five tabs on every visit, under a title that did
 * not say "start here". And the tour could not work on a phone. Its controls
 * sat inside the row while it highlighted things elsewhere on the page, so the
 * highlight and the Next button were never on screen together; two of its four
 * steps pointed at elements the phone does not have.
 *
 * So, by lifecycle:
 *   first visit   a tour that points at the real screen, offered once
 *   other tabs    one dismissible tip the first time each is opened
 *   afterwards    nothing on the page. "Take the tour" and "My story" are in
 *                 the side menu.
 *   My story      a screen of its own (faithful-destinations.js), with one
 *                 slim, dismissible line on Home until it is filled in
 *
 * faithful-preferences.js is not changed: the desktop portal uses it too, and
 * its tests run it in both modes. This layer runs after it and moves the form
 * it builds. The form's handlers are bound to nodes, so they move with it and
 * saving works exactly as before.
 *
 * Stores UI flags only ("has seen the tour"), never anything someone wrote.
 */
(() => {
  const app = document.querySelector('.app');
  const homeScreen = document.getElementById('screen-home');
  const home = homeScreen?.querySelector(':scope > .scroll');
  if (!app || !home) return;

  // ── what has been seen ────────────────────────────────────────────────────
  // Memory first, so a browser that refuses storage shows each thing once per
  // visit instead of on every tap.
  const KEY = 'grace.faithful.mobile.welcome.v1';
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) {}
  if (typeof seen !== 'object' || Array.isArray(seen)) seen = {};
  const mark = (name, value = 1) => { seen[name] = value; try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch (_) {} };

  const make = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text) el.textContent = text; return el; };
  const button = (cls, text) => { const b = make('button', cls, text); b.type = 'button'; return b; };
  const openStory = () => window.openMemberDestination?.('my-story');

  // ── My story: lift the form out of Home's row, onto its own screen ────────
  let nudge = null;
  function liftStory(row) {
    const host = document.querySelector('[data-member-story]');
    const form = row.querySelector('form');
    // No screen to move it to: leave the row exactly as it was.
    if (!host || !form || host.contains(form)) return;
    const parts = form.querySelectorAll('.fp-connection-layout, .fp-consent, .fp-actions');
    const show = () => parts.forEach(el => { el.hidden = false; });
    // The intro, tour and explainer cards become the tour below; the
    // "Let us know · Open · Skip this part" bar was a door to fields that are
    // now simply the page.
    const bar = form.querySelector('.fp-story-bar');
    bar?.nextElementSibling?.matches('p') && bar.nextElementSibling.remove();
    bar?.remove();
    form.querySelector('.fp-intro')?.remove();
    show();
    // "Skip" used to fold the fields away. On their own screen that would leave
    // an empty page, so it still restores the saved answers and then goes back.
    form.querySelector('[data-skip]')?.addEventListener('click', () => { show(); window.showScreen?.('home'); });
    form.addEventListener('submit', () => setTimeout(syncNudge, 0));
    form.querySelector('[data-clear]')?.addEventListener('click', () => setTimeout(syncNudge, 0));
    host.append(form);
    row.remove();
    mountNudge();
  }
  const storySaved = () => !!window.FAITHFUL_PREVIEW_PREFERENCES?.get?.().homeConnection;
  function syncNudge() { if (nudge) nudge.hidden = !!seen.storyNudge || storySaved(); }
  function mountNudge() {
    if (nudge) return;
    nudge = make('div', 'fw-story-nudge');
    const go = button('fw-story-nudge-go', 'Tell us a little about you');
    go.append(make('small', '', 'Optional · about 2 minutes'));
    go.onclick = openStory;
    const close = button('fw-story-nudge-close', '×');
    close.setAttribute('aria-label', 'Dismiss');
    close.onclick = () => { mark('storyNudge'); syncNudge(); };
    nudge.append(go, close);
    (home.querySelector(':scope > .home-hero-leader') || home.querySelector(':scope > .home-hero'))?.after(nudge);
    syncNudge();
  }
  // faithful-preferences.js mounts after an await, so the row may not exist yet.
  const findRow = () => home.querySelector(':scope > .fp-preferences');
  if (findRow()) liftStory(findRow());
  else {
    const wait = new MutationObserver(() => { const row = findRow(); if (row?.querySelector('form .fp-actions')) { wait.disconnect(); liftStory(row); } });
    wait.observe(home, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => wait.disconnect(), { once: true });
  }

  // ── the tour ──────────────────────────────────────────────────────────────
  // Each step names something that is really on the phone's Home. The captions
  // are the explainer cards' words, shortened to a sentence or two.
  const STEPS = [
    ['#screen-home .home-hero', 'Follow the message', 'Start with the service at the top of My Church. When you want more time with a passage, Reflect gives you a place to read and write.'],
    ['#screen-home .mobile-shortcuts', 'Find your people', 'Sunday, groups, care and your impact are one tap from here. You can look around without joining anything or sending a request.'],
    ['#home-leader-chip', 'Meet your leader', 'Your pastor’s AI avatar can help you explore your faith. It is always labelled as an avatar, and you can ask for a person under Care.'],
    ['#screen-home .fm-grace-dock', 'Ask GRACE', 'GRACE helps you find your way around church life. Ask about services, groups, events or giving.'],
    [null, 'Begin your story', 'A little about your connection gives this experience context. Add what feels useful, in your own words. It stays in this browser.']
  ];
  const tour = make('div', 'fw-tour');
  tour.hidden = true;
  tour.setAttribute('role', 'dialog');
  tour.setAttribute('aria-modal', 'true');
  tour.setAttribute('aria-labelledby', 'fw-tour-title');
  const dim = make('div', 'fw-tour-dim');
  const hole = make('div', 'fw-tour-hole');
  const card = make('div', 'fw-tour-card');
  const position = make('p', 'fw-tour-position');
  const title = make('h2', 'fw-tour-title'); title.id = 'fw-tour-title'; title.tabIndex = -1;
  const caption = make('p', 'fw-tour-caption');
  const status = make('p', 'fw-tour-status'); status.setAttribute('role', 'status');
  const skip = button('fw-tour-skip', 'Skip');
  const listen = button('fw-tour-listen', 'Listen');
  const next = button('fw-tour-next', 'Next');
  const actions = make('div', 'fw-tour-actions');
  actions.append(skip, listen, next);
  card.append(position, title, caption, actions, status);
  tour.append(dim, hole, card);
  app.append(tour);

  let index = -1, hiddenFromReaders = [], returnFocus = null, narration = 0, follow = 0;
  function stopAudio() { narration++; window.GRACE_COMPANION?.stopNarration?.(); listen.disabled = false; status.textContent = ''; }

  function place(target) {
    const frame = app.getBoundingClientRect();
    // On a desktop the phone is a scaled mockup; rects come back scaled, and
    // positions inside .app are not.
    const scale = (frame.width / app.offsetWidth) || 1;
    card.style.top = card.style.bottom = '';
    // The dimming is one filled layer with the spotlight cut out of it
    // (clip-path, even-odd: the outer rectangle minus a rounded one). It was a
    // 2000px box-shadow round the hole; that repainted unreliably as the hole
    // moved -- some steps came out pale instead of dark. A fill always paints.
    const W = app.offsetWidth, H = app.offsetHeight, outer = 'M0 0H' + W + 'V' + H + 'H0Z';
    hole.hidden = !target;
    if (!target) {
      dim.style.clipPath = 'path(evenodd,"' + outer + '")';
      card.style.bottom = '20px';
      return;
    }
    const r = target.getBoundingClientRect(), pad = 6;
    const left = Math.round((r.left - frame.left) / scale - pad), top = Math.round((r.top - frame.top) / scale - pad);
    const width = Math.round(r.width / scale + pad * 2), height = Math.round(r.height / scale + pad * 2);
    const c = Math.min(26, width / 2, height / 2);
    const rounded = 'M' + (left + c) + ' ' + top + 'h' + (width - 2 * c) + 'a' + c + ' ' + c + ' 0 0 1 ' + c + ' ' + c +
      'v' + (height - 2 * c) + 'a' + c + ' ' + c + ' 0 0 1 -' + c + ' ' + c + 'h-' + (width - 2 * c) +
      'a' + c + ' ' + c + ' 0 0 1 -' + c + ' -' + c + 'v-' + (height - 2 * c) + 'a' + c + ' ' + c + ' 0 0 1 ' + c + ' -' + c + 'z';
    dim.style.clipPath = 'path(evenodd,"' + outer + rounded + '")';
    Object.assign(hole.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px', borderRadius: c + 'px' });
    // The caption goes on whichever side of the target has the room.
    const appHeight = app.offsetHeight;
    if (top + height / 2 < appHeight / 2) card.style.top = Math.min(top + height + 12, appHeight - 260) + 'px';
    else card.style.bottom = Math.max(appHeight - top + 12, 16) + 'px';
  }

  function show() {
    stopAudio();
    const welcome = index < 0, last = index === STEPS.length - 1;
    const [selector, heading, text] = welcome
      ? [null, 'Welcome to Faithful Church', 'Want a quick look around? It takes about a minute, and you can stop whenever you like.']
      : STEPS[index];
    position.textContent = welcome ? '' : 'Step ' + (index + 1) + ' of ' + STEPS.length;
    position.hidden = welcome;
    title.textContent = heading;
    caption.textContent = text;
    skip.textContent = welcome ? 'Not now' : last ? 'Finish' : 'Skip';
    next.textContent = welcome ? 'Show me around' : last ? 'Add my story' : 'Next';
    listen.hidden = welcome || typeof window.GRACE_COMPANION?.narratePage !== 'function';
    const target = selector && document.querySelector(selector);
    // Centre the target by setting the scroll position outright. The list
    // scrolls smoothly by stylesheet, and scrollIntoView left it still moving
    // when the target was measured -- the spotlight landed on whatever had
    // been there a moment earlier.
    if (target && home.contains(target)) {
      home.style.scrollBehavior = 'auto';
      const offset = target.getBoundingClientRect().top - home.getBoundingClientRect().top + home.scrollTop;
      home.scrollTop = Math.max(0, offset - (home.clientHeight - target.offsetHeight) / 2);
    }
    // Measure once that has been laid out.
    requestAnimationFrame(() => requestAnimationFrame(() => { place(target); title.focus({ preventScroll: true }); }));
  }

  function open(from) {
    if (!tour.hidden) return;
    window.closeAppMenu?.();
    window.showScreen?.('home');
    document.getElementById('impact-float')?.classList.remove('show');
    returnFocus = document.activeElement;
    // Everything under the tour is out of reach while it runs: the layer takes
    // every tap, the Tab trap below keeps the keyboard in the caption, and
    // aria-hidden keeps a screen reader there too. Not `inert` -- some engines
    // paint inert content washed-out, which turned the dimming pale grey.
    // Remember what was already hidden so closing does not reveal it.
    hiddenFromReaders = [...app.children].filter(el => el !== tour && el.getAttribute('aria-hidden') !== 'true');
    hiddenFromReaders.forEach(el => el.setAttribute('aria-hidden', 'true'));
    app.classList.add('fw-touring');
    tour.hidden = false;
    index = from;
    show();
    // The page can still move under a step (an image finishing, a late module),
    // so the spotlight is re-measured while the tour is open rather than once.
    follow = setInterval(() => { const sel = index >= 0 && STEPS[index][0]; place(sel ? document.querySelector(sel) : null); }, 300);
  }
  function close(outcome) {
    clearInterval(follow);
    stopAudio();
    tour.hidden = true;
    hiddenFromReaders.forEach(el => el.removeAttribute('aria-hidden'));
    hiddenFromReaders = [];
    app.classList.remove('fw-touring');
    home.scrollTop = 0;
    home.style.scrollBehavior = '';
    mark('tour', outcome);
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }

  next.onclick = () => {
    if (index < STEPS.length - 1) { index++; show(); return; }
    close('done'); openStory();
  };
  skip.onclick = () => close(index === STEPS.length - 1 ? 'done' : 'skipped');
  listen.onclick = () => {
    stopAudio();
    const version = narration;
    listen.disabled = true; status.textContent = 'Preparing audio…';
    const accepted = window.GRACE_COMPANION?.narratePage?.(caption.textContent,
      () => { if (version === narration) status.textContent = 'Speaking'; },
      () => { if (version === narration) { listen.disabled = false; status.textContent = ''; } });
    if (!accepted) { listen.disabled = false; status.textContent = 'Audio is unavailable right now. You can read each step.'; }
  };
  tour.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); skip.click(); return; }
    if (event.key !== 'Tab') return;
    const stops = [skip, listen, next].filter(b => !b.hidden && !b.disabled);
    const first = stops[0], final = stops.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === title)) { event.preventDefault(); final.focus(); }
    else if (!event.shiftKey && document.activeElement === final) { event.preventDefault(); first.focus(); }
  });
  window.addEventListener('resize', () => { if (!tour.hidden) show(); });
  window.addEventListener('pagehide', stopAudio);

  // Offered once, after someone is actually in the app -- not over the landing
  // screen, not inside the marketing embed, and not to someone arriving from
  // the portal walkthrough's QR (?tour=1), who is already mid-tour.
  const device = document.querySelector('.device');
  const embedded = document.documentElement.classList.contains('embed-preview');
  const handoff = new URLSearchParams(location.search).get('tour') === '1';
  function offer() {
    if (seen.tour || embedded || handoff || !device || device.classList.contains('landing-active')) return;
    if (!homeScreen.classList.contains('active') || app.classList.contains('menu-open')) return;
    open(-1);
  }
  if (device) {
    new MutationObserver(() => setTimeout(offer, 700)).observe(device, { attributes: true, attributeFilter: ['class'] });
    setTimeout(offer, 700);
  }

  // ── the other tabs: one tip, the first time ───────────────────────────────
  // The words are the tab's own row title and subline, read at the moment of
  // showing, so they cannot drift from what the row says.
  const TABS = { leaders: 'screen-leaders', give: 'screen-give', community: 'screen-community', profile: 'screen-profile' };
  let tip = null;
  function dismissTip() { tip?.remove(); tip = null; }
  function offerTip(name) {
    dismissTip();
    if (seen['tip.' + name] || embedded || !tour.hidden) return;
    const screen = document.getElementById(TABS[name]);
    const row = screen?.querySelector('.scroll > .fp-connection, .scroll .fp-connection');
    const summary = row?.querySelector(':scope > summary');
    if (!summary) return;
    const subline = summary.querySelector('.fh-guide-subline')?.textContent.trim();
    const heading = [...summary.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').trim();
    if (!heading || !subline) return;
    tip = make('aside', 'fw-tip');
    tip.setAttribute('aria-label', 'About this page');
    const more = button('fw-tip-more', 'Tell me more');
    const ok = button('fw-tip-ok', 'Got it');
    const row2 = make('div', 'fw-tip-actions');
    row2.append(more, ok);
    tip.append(make('h2', '', heading), make('p', '', subline), row2);
    ok.onclick = () => { mark('tip.' + name); dismissTip(); };
    more.onclick = () => { mark('tip.' + name); dismissTip(); row.open = true; row.scrollIntoView({ block: 'start', behavior: 'smooth' }); summary.focus({ preventScroll: true }); };
    screen.append(tip);
  }
  Object.entries(TABS).forEach(([name, id]) => {
    const screen = document.getElementById(id);
    if (!screen) return;
    new MutationObserver(() => {
      if (screen.classList.contains('active')) setTimeout(() => offerTip(name), 350);
      else if (tip?.parentElement === screen) { mark('tip.' + name); dismissTip(); }
    }).observe(screen, { attributes: true, attributeFilter: ['class'] });
  });

  // ── the way back in: the side menu ────────────────────────────────────────
  const drawerNav = document.querySelector('#app-drawer .drawer-nav');
  if (drawerNav) {
    const row = make('div', 'fw-drawer-row');
    const again = button('fw-drawer-chip', 'Take the tour');
    again.onclick = () => { window.closeAppMenu?.(); setTimeout(() => open(0), 320); };
    const story = button('fw-drawer-chip', 'My story');
    story.dataset.fdAction = 'my-story';   // routed by faithful-destinations.js
    row.append(again, story);
    drawerNav.after(row);
  }

  window.FAITHFUL_MOBILE_WELCOME = { startTour: () => open(0), steps: STEPS.length };
})();
