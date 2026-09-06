/**
 * Real member identity + gating bootstrap for the static Member Portal
 * pages (apps/member-web/public/tenants/*). These pages have no bundler
 * of their own — this bridges the Clerk session already established at
 * sign-in (see apps/member-web/src/portal/PortalRoot.tsx's
 * StaticPortalHandoff, which redirects here after real auth +
 * api/portal/_self-signup.ts) into plain browser JS.
 *
 * Deliberately narrow scope (see the member-portal-audit plan): this
 * fetches just enough — the member's real name and their
 * identity_verified status (api/_lib/authz.ts's MemberActor field,
 * migration 078) — to fix two real problems:
 *   1. Every visitor seeing the same hardcoded demo name.
 *   2. Care/Impact history rendering as available when a self-signed-up
 *      member hasn't actually been reviewed by staff yet.
 * It does NOT wire real data into every section — giving history, the
 * community feed, etc. stay static/demo content for now.
 *
 * No-session fallback: if there's no Clerk session at all (staff
 * "Preview Portal" opens this page directly with no member token), this
 * quietly does nothing and the page renders exactly as it does today —
 * that's the correct, safe behavior for that path, not an error.
 *
 * Exposes window.GRACE_SESSION = { ready: Promise<Session|null> } for
 * other scripts (grace-companion.js's real-assistant wiring) to await
 * the same bootstrap instead of duplicating it.
 */
(function () {
  var CLERK_SDK_URL = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js';

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function lockSensitiveSections(state) {
    var nodes = document.querySelectorAll('[data-gr-lock]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var group = el.getAttribute('data-gr-lock');
      var shouldLock = state.identity_verified === false && (group === 'care' || group === 'impact');
      el.classList.toggle('gr-locked', shouldLock);
      if (shouldLock && !el.querySelector('.gr-lock-overlay')) {
        var overlay = document.createElement('div');
        overlay.className = 'gr-lock-overlay';
        overlay.innerHTML =
          '<div class="gr-lock-icon" aria-hidden="true">&#128274;</div>' +
          '<div class="gr-lock-text">This unlocks once church staff confirms your account.</div>';
        el.appendChild(overlay);
      }
    }
  }

  function applyMemberName(name) {
    if (!name) return;
    var nameEls = document.querySelectorAll('.sb-name');
    for (var i = 0; i < nameEls.length; i++) nameEls[i].textContent = name;
    if (typeof window.HOME_STATE === 'object' && window.HOME_STATE) {
      window.HOME_STATE.memberName = name;
      if (typeof window.hydrateHome === 'function') {
        try { window.hydrateHome(); } catch (e) { /* best-effort re-render only */ }
      }
    }
    // GRACE_COMPANION.mount() ran synchronously at page load with whatever
    // HOME_STATE.memberName was at that moment (the static demo default) —
    // correct its already-captured copy too.
    if (window.GRACE_COMPANION && typeof window.GRACE_COMPANION.setMemberName === 'function') {
      window.GRACE_COMPANION.setMemberName(name);
    }
  }

  /* ══ "Continue onboarding with GRACE" — Impact Card KYC ══
   * Deliberately reuses the existing, real submit_kyc/review_kyc
   * plumbing (api/neobank/_index.ts) rather than building anything new —
   * see the member-portal-audit plan's Phase D. Only offered to an
   * already identity_verified member (an unreviewed self-signup
   * shouldn't be able to start financial account enrollment), and only
   * a real structured form (not free-text chat parsing) for the
   * date-of-birth field — that's compliance-adjacent structured data, a
   * form is simply more reliable than an LLM parsing a typed sentence. */
  function escapeAttr(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function kycStatusLabel(status) {
    return { pending: 'pending review', in_review: 'in review', approved: 'approved', rejected: 'not approved', expired: 'expired' }[status] || status;
  }

  function renderKycStatus(container, status) {
    container.hidden = false;
    container.innerHTML =
      '<div class="gr-kyc-card gr-kyc-card--done">' +
      '<div class="gr-kyc-head"><span class="gr-kyc-orb" aria-hidden="true"></span><strong>Impact Card application ' + escapeAttr(kycStatusLabel(status)) + '</strong></div>' +
      '<p class="gr-kyc-copy">Our team will follow up once it’s reviewed — you can check back here anytime, or just ask me.</p>' +
      '</div>';
  }

  function renderKycForm(container, prefillName) {
    container.hidden = false;
    container.innerHTML =
      '<div class="gr-kyc-card">' +
      '<div class="gr-kyc-head"><span class="gr-kyc-orb" aria-hidden="true"></span><strong>Let’s get your Impact Card set up</strong></div>' +
      '<p class="gr-kyc-copy">I’ll need a few details, then our team reviews and approves your account.</p>' +
      '<form id="gr-kyc-form" class="gr-kyc-form">' +
      '<label>Full legal name<input type="text" id="gr-kyc-name" required value="' + escapeAttr(prefillName) + '"></label>' +
      '<label>Date of birth<input type="date" id="gr-kyc-dob" required></label>' +
      '<label>Email<input type="email" id="gr-kyc-email" required></label>' +
      '<label>Phone (optional)<input type="tel" id="gr-kyc-phone"></label>' +
      '<button type="submit" class="gr-kyc-btn">Submit for review</button>' +
      '<p class="gr-kyc-error" id="gr-kyc-error" hidden></p>' +
      '</form>' +
      '</div>';
    document.getElementById('gr-kyc-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      submitKyc(container);
    });
  }

  function submitKyc(container) {
    var errorEl = document.getElementById('gr-kyc-error');
    var btn = container.querySelector('.gr-kyc-btn');
    var payload = {
      action: 'submit_kyc',
      full_name: document.getElementById('gr-kyc-name').value.trim(),
      date_of_birth: document.getElementById('gr-kyc-dob').value,
      email: document.getElementById('gr-kyc-email').value.trim(),
      phone: document.getElementById('gr-kyc-phone').value.trim(),
    };
    btn.disabled = true;
    window.GRACE_SESSION.ready.then(function (session) {
      return session.getToken().then(function (token) {
        return fetch('/api/neobank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(payload),
        });
      });
    }).then(function (r) {
      return r.json().then(function (body) { return { status: r.status, body: body }; });
    }).then(function (res) {
      if (res.status === 201) {
        renderKycStatus(container, res.body.kyc.status);
      } else if (res.status === 409) {
        renderKycStatus(container, res.body.status);
      } else {
        errorEl.hidden = false;
        errorEl.textContent = (res.body && res.body.error) || 'Something went wrong — please try again.';
        btn.disabled = false;
      }
    }).catch(function () {
      errorEl.hidden = false;
      errorEl.textContent = 'Could not reach the server — please try again.';
      btn.disabled = false;
    });
  }

  function renderKycCta(container, prefillName) {
    container.hidden = false;
    container.innerHTML =
      '<div class="gr-kyc-card">' +
      '<div class="gr-kyc-head"><span class="gr-kyc-orb" aria-hidden="true"></span><strong>Continue onboarding with GRACE</strong></div>' +
      '<p class="gr-kyc-copy">Set up your GRACE Impact Card account — a few quick details, then our team reviews and approves it.</p>' +
      '<button type="button" class="gr-kyc-btn" id="gr-kyc-start">Continue onboarding with GRACE</button>' +
      '</div>';
    document.getElementById('gr-kyc-start').addEventListener('click', function () {
      renderKycForm(container, prefillName);
      if (window.GRACE_COMPANION && typeof window.GRACE_COMPANION.open === 'function') {
        window.GRACE_COMPANION.open();
      }
    });
  }

  function setupImpactOnboarding(session) {
    var container = document.getElementById('gr-kyc-cta');
    if (!container || !session.home.identity_verified) return;
    session.getToken().then(function (token) {
      return fetch('/api/neobank?resource=me', { headers: { Authorization: 'Bearer ' + token } });
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        if (!data.kyc) {
          renderKycCta(container, session.home.greeting_name);
        } else if (data.kyc.status === 'pending' || data.kyc.status === 'in_review') {
          renderKycStatus(container, data.kyc.status);
        }
        // approved/rejected/expired: leave the existing Impact Card UI as
        // the source of truth rather than duplicating it here.
      })
      .catch(function () { /* best-effort — leave the CTA hidden on failure */ });
  }

  function fetchTenantConfig() {
    return fetch('/api/tenant/config?host=' + encodeURIComponent(location.hostname))
      .then(function (r) { return r.json(); })
      .catch(function () { return {}; });
  }

  function boot() {
    return fetchTenantConfig().then(function (cfg) {
      var pubKey = cfg && cfg.clerk_publishable_key;
      if (!pubKey) return null;
      return loadScript(CLERK_SDK_URL)
        .then(function () {
          var clerk = new window.Clerk(pubKey);
          return clerk.load().then(function () { return clerk; });
        })
        .then(function (clerk) {
          if (!clerk.session) return null; // no signed-in member (e.g. staff preview)
          return clerk.session.getToken().then(function (token) {
            if (!token) return null;
            return fetch('/api/portal/home', { headers: { Authorization: 'Bearer ' + token } })
              .then(function (r) { return r.ok ? r.json() : null; })
              .then(function (home) {
                if (!home) return null;
                return {
                  getToken: function () { return clerk.session.getToken(); },
                  home: home,
                };
              });
          });
        });
    }).catch(function (err) {
      console.warn('[grace-member-session] bootstrap failed — page renders unpersonalized', err);
      return null;
    });
  }

  var ready = boot().then(function (session) {
    if (session && session.home) {
      applyMemberName(session.home.greeting_name);
      lockSensitiveSections(session.home);
      setupImpactOnboarding(session);
    }
    return session;
  });

  window.GRACE_SESSION = { ready: ready };
})();
