/* Faithful mobile · Get connected.
 *
 * "My story" asked a newcomer about themselves and then kept the answers in
 * their own browser, shared with nobody. As a preview that was honest. As the
 * way a church gets to know the people joining it, it was a form that went
 * nowhere -- worse than not asking.
 *
 * The way to the church already exists, and this joins it rather than adding a
 * second one. The desktop portal's walkthrough ends by POSTing a reviewed,
 * consented story to /api/story/handoff, which stores it as an anonymous draft
 * and mints a one-use, 15-minute token; the phone opens /claim with that token,
 * the person creates their account, and /api/portal/self-signup attaches the
 * draft to their record for a staff member to review
 * (docs/MEMBER_MOBILE_HANDOFF.md). The desktop needs a QR code for the hop to
 * the phone. Here the person is already on the phone, so the same request is
 * made and the claim page is opened directly.
 *
 * What is sent is exactly what the person typed on this screen, and only after
 * they tick the box that says so. Never sent: anything from localStorage, the
 * demo persona's sample answers, or anything inferred. The server's allowlist
 * (api/_lib/storySegments.ts) rejects anything else anyway.
 *
 * faithful-preferences.js still owns the fields and the "keep it on this
 * phone" controls; it is shared with the desktop portal and is not changed.
 */
(() => {
  const host = document.querySelector('[data-member-story]');
  if (!host) return;

  const make = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text) el.textContent = text; return el; };
  const STAGES = [
    ['new', 'New or exploring', 'Welcome. Tell the church a little about you, then create your account. A member of the team reviews every new account.'],
    ['attending', 'Attending, not yet a member', 'Good to have you. Tell the church a little about you, then create your account. It is the first step toward membership, and a member of the team reviews it.'],
    ['member', 'Already a member', 'You are already part of Faithful. Create your account, or sign in to it, and these answers are added to your record for the team to review.']
  ];
  const MAX_ITEM = 400;   // api/_lib/storySegments.ts MAX_ITEM_CHARS
  const chunks = text => { const out = []; for (let i = 0; i < text.length && out.length < 3; i += MAX_ITEM) out.push(text.slice(i, i + MAX_ITEM)); return out; };
  const tenantSlug = () => (/\/tenants\/([a-z0-9-]+)\//.exec(location.pathname) || [])[1] || null;

  function build(form) {
    if (form.dataset.getConnected) return;
    form.dataset.getConnected = '1';
    const layout = form.querySelector('.fp-connection-layout');
    if (!layout) return;

    // ── where are you with the church ───────────────────────────────────────
    const stage = make('fieldset', 'fp-question fgc-stage');
    stage.append(make('legend', '', 'Where are you with Faithful Church?'));
    const stageHint = make('p', 'fgc-hint', 'Choose the one that fits today. It only changes what happens next.');
    const stageChoices = make('div', 'fp-choices');
    STAGES.forEach(([value, label]) => {
      const option = make('label', ''), radio = make('input', '');
      radio.type = 'radio'; radio.name = 'fgc-stage'; radio.value = value;
      option.append(radio, document.createTextNode(label));
      stageChoices.append(option);
    });
    stage.append(stageChoices, stageHint);

    // ── what to call them ───────────────────────────────────────────────────
    const who = make('fieldset', 'fp-question fgc-name');
    const nameLabel = make('legend', '', 'What should we call you?');
    const name = make('input', ''); name.type = 'text'; name.maxLength = 80; name.autocomplete = 'given-name';
    name.placeholder = 'Your first name, or the name you go by'; name.setAttribute('aria-label', 'What should we call you?');
    who.append(nameLabel, name);
    layout.before(stage, who);

    // ── send it to the church ───────────────────────────────────────────────
    const send = make('section', 'fgc-send');
    send.append(make('h3', '', 'Send this to Faithful Church'));
    const consent = make('label', 'fgc-check'), agree = make('input', '');
    agree.type = 'checkbox'; agree.name = 'fgc-consent';
    consent.append(agree, document.createTextNode('Send these answers to Faithful Church with the account I am about to create.'));
    const follow = make('label', 'fgc-check'), followup = make('input', '');
    followup.type = 'checkbox'; followup.name = 'fgc-followup';
    follow.append(followup, document.createTextNode('Someone from the church may follow up with me. (Optional)'));
    const small = make('p', 'fgc-small', 'Nothing is sent until you press Continue. Your answers are then held for 15 minutes and attached to the account you create. If you do not create one, they are not linked to anybody.');
    const go = make('button', 'fgc-go', 'Continue to create my account'); go.type = 'button';
    const status = make('p', 'fgc-status'); status.setAttribute('role', 'status');
    send.append(consent, follow, small, go, status);
    const localConsent = form.querySelector('.fp-consent');
    (localConsent || layout.nextElementSibling || layout).before(send);
    if (localConsent) localConsent.before(make('p', 'fgc-or', 'Or keep it on this phone for now'));
    // That button is faithful-preferences.js's, and it saves to this browser.
    // Beside a button that sends to the church, it has to say so.
    const localSave = form.querySelector('.fp-actions button[type=submit]');
    if (localSave) localSave.textContent = 'Save on this phone';

    stage.addEventListener('change', () => {
      const chosen = STAGES.find(([value]) => value === stage.querySelector('input:checked')?.value);
      if (chosen) stageHint.textContent = chosen[2];
    });

    function payload() {
      const chosen = STAGES.find(([value]) => value === stage.querySelector('input:checked')?.value);
      const field = n => (form.elements[n]?.value || '').trim();
      const items = [];
      if (chosen) items.push('Where I am: ' + chosen[1]);
      [['connection', 'My connection to church'], ['engagement', 'How I take part'], ['support', 'What I am hoping to find']]
        .forEach(([n, label]) => { const v = field(n); if (v) items.push((label + ': ' + v).slice(0, MAX_ITEM)); });
      chunks(field('thoughts')).forEach((part, i) => items.push(((i ? 'In my own words (continued): ' : 'In my own words: ') + part).slice(0, MAX_ITEM)));
      return { chosen, items };
    }

    go.onclick = async () => {
      const { chosen, items } = payload();
      if (!chosen) { status.textContent = 'Choose where you are with the church, at the top.'; stage.querySelector('input')?.focus(); return; }
      if (!agree.checked) { status.textContent = 'Tick the box above to send your answers. Without it nothing leaves this phone.'; agree.focus(); return; }
      go.disabled = true; status.textContent = 'Sending…';
      const slug = tenantSlug();
      let resp, body = {};
      try {
        resp = await fetch('/api/story/handoff', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign(slug ? { tenant: slug } : {}, {
            preferredName: name.value.trim() || undefined,
            sections: { church: items }, segments: {},
            consentCarryStory: true, consentMoneySections: false, consentFollowup: followup.checked
          }))
        });
        body = await resp.json().catch(() => ({}));
      } catch (_) { resp = null; }
      // Never imply the church received something it did not.
      let claim = null;
      try { const u = new URL(body.claim_url, location.href); if (u.pathname === '/claim' && /^https?:$/.test(u.protocol)) claim = u.href; } catch (_) {}
      if (!resp || !resp.ok || !claim) {
        go.disabled = false;
        status.textContent = !resp ? 'That did not send. Check your connection and try again. Your answers are still on this page.'
          : resp.status === 429 ? 'Too many tries from this network just now. Wait a few minutes and try again. Your answers are still on this page.'
          : resp.status === 404 ? 'Sending is not available on this address. Your answers are still on this page and have not been sent.'
          : 'That did not send, and nothing was shared. Your answers are still on this page. Try again in a moment.';
        return;
      }
      status.textContent = 'Sent. Opening your account…';
      // One seam, so the test can see where this goes; jsdom cannot replace
      // location. `claim` was already checked to be our own /claim page.
      (window.FAITHFUL_GET_CONNECTED_NAVIGATE || (u => location.assign(u)))(claim);
    };
  }

  // faithful-mobile-welcome.js moves the form in here, after
  // faithful-preferences.js has built it, so it may not be here yet.
  const ready = () => { const form = host.querySelector('form'); if (form?.querySelector('.fp-connection-layout')) { build(form); return true; } return false; };
  if (!ready()) {
    const wait = new MutationObserver(() => { if (ready()) wait.disconnect(); });
    wait.observe(host, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => wait.disconnect(), { once: true });
  }
})();
