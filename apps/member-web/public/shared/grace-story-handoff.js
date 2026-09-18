/* Phone handoff: turns a reviewed story into a scannable, single-use code.
 *
 * Shared by every tenant. The QR image comes from the server
 * (api/story/_handoff.ts) as a PNG data URL; the portal's other codes go
 * through api.qrserver.com, which receives whatever it encodes — acceptable
 * for a public page address, disqualifying for a token.
 *
 * The code is shown with a live countdown and a cancel control because it sits
 * on a screen other people can see: a member who walks away should be able to
 * kill it, and one that quietly expires should say so rather than keep looking
 * valid.
 *
 * Call configure() once per page with the tenant's mount point; start() then
 * mints and displays a code.
 */
(function (global) {
  'use strict';

  var cfg = {
    /** Panel is inserted after this element. */
    mountAfter: null,
    /** Hidden while the code is on screen, restored on Back. */
    hideWhileOpen: null,
    /** Returns the pilot segmentation answers, or {}. */
    segments: function () { return {}; },
  };

  var panel = null;
  var timer = null;
  var current = null;      // { token, expiresAt }
  var lastPayload = null;

  function tenantSlug() {
    var m = /\/tenants\/([a-z0-9-]+)\//.exec(location.pathname);
    return m ? m[1] : null;
  }

  function build() {
    if (panel) return panel;
    panel = document.createElement('section');
    panel.className = 'story-handoff';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Scan to continue on your phone');
    panel.innerHTML =
      '<h2 tabindex="-1">Scan to continue on your phone</h2>' +
      '<p class="sh-lede">Point your phone camera at this code. It works once, and only for the next few minutes.</p>' +
      '<div class="sh-qr"><img alt="" data-qr width="220" height="220"></div>' +
      '<p class="sh-countdown" role="timer" aria-live="off" data-countdown></p>' +
      '<p class="sh-link">Or open <span data-link-text></span> on your phone.</p>' +
      '<div class="sh-actions">' +
        '<button type="button" data-new>Show a new code</button>' +
        '<button type="button" data-cancel>Cancel this code</button>' +
        '<button type="button" data-back>Back</button>' +
      '</div>' +
      '<p class="sh-note">Nothing is added to your profile until you finish on the phone.</p>' +
      '<p role="status" aria-live="polite" data-status></p>';

    if (cfg.mountAfter && cfg.mountAfter.after) cfg.mountAfter.after(panel);
    else document.body.append(panel);

    panel.querySelector('[data-cancel]').onclick = function () { cancel(false); };
    panel.querySelector('[data-new]').onclick = function () {
      // Retire the old code first so two live codes never point at one story.
      cancel(true).then(function () { if (lastPayload) mint(lastPayload); });
    };
    panel.querySelector('[data-back]').onclick = function () {
      cancel(true).then(function () {
        panel.hidden = true;
        if (cfg.hideWhileOpen) {
          cfg.hideWhileOpen.hidden = false;
          var h = cfg.hideWhileOpen.querySelector('h2');
          if (h) h.focus();
        }
      });
    };
    return panel;
  }

  function setStatus(text) { panel.querySelector('[data-status]').textContent = text; }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  function expire(message) {
    stopTimer();
    current = null;
    panel.querySelector('[data-qr]').removeAttribute('src');
    panel.querySelector('.sh-qr').hidden = true;
    panel.querySelector('[data-countdown]').textContent = '';
    setStatus(message);
  }

  function startCountdown(expiresAt) {
    stopTimer();
    var el = panel.querySelector('[data-countdown]');
    var tick = function () {
      var left = Math.floor((expiresAt - Date.now()) / 1000);
      if (left <= 0) {
        // Never leave a dead code on screen looking usable.
        expire('This code has expired. Show a new one when you are ready.');
        return;
      }
      el.textContent = 'Expires in ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  function mint(payload) {
    lastPayload = payload;
    build();
    panel.hidden = false;
    panel.querySelector('.sh-qr').hidden = true;
    panel.querySelector('[data-countdown]').textContent = '';
    setStatus('Preparing your code…');
    panel.querySelector('h2').focus();

    var slug = tenantSlug();
    return fetch('/api/story/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign(
        slug ? { tenant: slug } : {},
        {
          preferredName: payload.preferredName,
          sections: payload.sections,
          segments: cfg.segments() || {},
          consentCarryStory: true,
          consentMoneySections: !!(payload.consents && payload.consents.money),
          consentFollowup: !!(payload.consents && payload.consents.followup),
        },
      )),
    }).then(function (resp) {
      return resp.json().catch(function () { return {}; }).then(function (body) {
        if (!resp.ok) {
          // Say what happened: a silent failure looks identical to a code that
          // has simply not rendered yet.
          setStatus(body.error === 'consent_required'
            ? 'Your consent choice did not come through. Go back and try again.'
            : 'We could not prepare a code just now. Nothing was sent.');
          return;
        }
        current = { token: body.token, expiresAt: Date.parse(body.expires_at) };
        if (body.qr_png_data_url) {
          var img = panel.querySelector('[data-qr]');
          img.src = body.qr_png_data_url;
          img.alt = 'Scan this code with your phone camera to continue';
          panel.querySelector('.sh-qr').hidden = false;
        }
        panel.querySelector('[data-link-text]').textContent = String(body.claim_url).split('#')[0];
        startCountdown(current.expiresAt);
        setStatus('');
      });
    }).catch(function () {
      setStatus('We could not reach the church right now. Nothing was sent.');
    });
  }

  function cancel(quiet) {
    if (!current) return Promise.resolve();
    var token = current.token;
    var slug = tenantSlug();
    expire(quiet ? '' : 'This code has been cancelled.');
    return fetch('/api/story/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign(slug ? { tenant: slug } : {}, { token: token })),
    }).catch(function () {
      // The code is already off the screen and expires on its own; a failed
      // cancel is not worth alarming the member about.
    });
  }

  // Leaving the page with a live code on screen should not leave it live.
  global.addEventListener('pagehide', function () {
    if (!current || !navigator.sendBeacon) return;
    var slug = tenantSlug();
    navigator.sendBeacon('/api/story/cancel', new Blob(
      [JSON.stringify(Object.assign(slug ? { tenant: slug } : {}, { token: current.token }))],
      { type: 'application/json' },
    ));
  });

  global.GRACE_STORY_HANDOFF = {
    configure: function (options) {
      Object.assign(cfg, options || {});
      // Build on configure rather than on first use: the panel is hidden
      // either way, and having it in the DOM keeps focus order and assistive
      // tech stable instead of injecting a dialog mid-interaction.
      if (cfg.mountAfter) build();
    },
    start: function (payload) {
      if (cfg.hideWhileOpen) cfg.hideWhileOpen.hidden = true;
      return mint(payload);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
