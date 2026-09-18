/* Member-side care request — the first thing in this codebase to actually call
 * POST /api/portal/care.
 *
 * That endpoint has been complete for some time: it writes a real
 * care_requests row, flags crisis language, raises an agent_finding at
 * critical severity, pages on-call staff with no member detail in the body,
 * and sets a sentinel review the system can never clear itself. Nothing
 * called it. The member-facing care buttons fired a toast that said a request
 * had been submitted, which is the failure this replaces.
 *
 * SHARED, NOT PER-TENANT. Both tenants load grace-member-session.js, so both
 * get this. The care surface is the one place where a tenant gap is not a
 * cosmetic difference.
 *
 * AUTHENTICATION IS REQUIRED, AND ITS ABSENCE IS SAID OUT LOUD. The endpoint
 * resolves a member from a Clerk bearer token. On a signed-out preview there
 * is nobody to attach a request to, so the form does not pretend to send —
 * it says so and offers the leader conversation, which does work signed out.
 *
 * Note POST deliberately does NOT require a staff-verified identity (only GET
 * does): someone who signed up an hour ago and is still pending review can
 * still ask for help. Do not add a verification gate here.
 */
(function (global) {
  'use strict';

  /* The portal's own category ids differ from the endpoint's. Three do not
     match, and a mismatch is a 400 at the moment a member asks for help. */
  var CATEGORY_MAP = {
    marriage: 'marriage', addiction: 'addiction', grief: 'grief',
    faith: 'faith-questions', 'faith-questions': 'faith-questions',
    crisis: 'crisis', financial: 'financial',
    anxiety: 'anxiety-depression', 'anxiety-depression': 'anxiety-depression',
    parenting: 'parenting', other: 'general', general: 'general'
  };

  var LABELS = {
    marriage: 'Marriage & relationships', addiction: 'Addiction & recovery',
    grief: 'Grief & loss', 'faith-questions': 'Faith questions',
    crisis: 'Crisis / urgent', financial: 'Financial help',
    'anxiety-depression': 'Anxiety & depression', parenting: 'Parenting',
    general: 'Something else'
  };

  var root = null;
  /* Bumped on every open() and every submit(). Both do async work that ends in
     a status message, and GRACE_SESSION.ready can settle after the member has
     already pressed send -- without this, a late "you are not signed in" check
     can overwrite the result of a submit, or blank it. Only the newest
     interaction is allowed to write. */
  var generation = 0;

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  function session() {
    return global.GRACE_SESSION && global.GRACE_SESSION.ready
      ? global.GRACE_SESSION.ready.catch(function () { return null; })
      : Promise.resolve(null);
  }

  function build() {
    if (root) return root;
    root = el('div', { class: 'gcr-backdrop', role: 'presentation', hidden: 'hidden' });
    root.innerHTML =
      '<div class="gcr-panel" role="dialog" aria-modal="true" aria-labelledby="gcr-title">' +
        '<button type="button" class="gcr-close" data-close aria-label="Close">×</button>' +
        '<h2 id="gcr-title" tabindex="-1">Ask for support</h2>' +
        '<p class="gcr-lede">A member of the church team will see this. It is kept confidential to the care team.</p>' +
        '<div class="gcr-crisis" data-crisis hidden>' +
          '<strong>If someone is in immediate danger, this is not the fastest way to get help.</strong>' +
          ' Call 988 (Suicide &amp; Crisis Lifeline) or 911. This form is not monitored continuously.' +
        '</div>' +
        '<form>' +
          '<label for="gcr-category">What is this about?</label>' +
          '<select id="gcr-category" data-category></select>' +
          '<label for="gcr-message">What would you like us to know?</label>' +
          '<textarea id="gcr-message" data-message rows="5" maxlength="4000" ' +
            'placeholder="Share as much or as little as you want."></textarea>' +
          '<label for="gcr-contact">How should we reach you?</label>' +
          '<select id="gcr-contact" data-contact>' +
            '<option value="either">Either email or phone</option>' +
            '<option value="email">Email</option>' +
            '<option value="phone">Phone</option>' +
            '<option value="sms">Text message</option>' +
          '</select>' +
          '<label class="gcr-consent"><input type="checkbox" data-followup checked> ' +
            'I would like someone from the church to contact me about this.</label>' +
          '<p class="gcr-consent-note">Leaving this ticked records your consent for the team to contact you. ' +
            'Untick it and your request is still seen, but nobody will reach out.</p>' +
          '<button type="submit" data-submit>Send to the care team</button>' +
          '<button type="button" data-cancel>Cancel</button>' +
        '</form>' +
        '<p class="gcr-status" role="status" aria-live="polite" data-status></p>' +
      '</div>';

    var select = root.querySelector('[data-category]');
    Object.keys(LABELS).forEach(function (value) {
      select.append(new Option(LABELS[value], value));
    });
    select.addEventListener('change', function () {
      root.querySelector('[data-crisis]').hidden = select.value !== 'crisis';
    });

    root.querySelector('[data-close]').onclick = close;
    root.querySelector('[data-cancel]').onclick = close;
    root.addEventListener('click', function (e) { if (e.target === root) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !root.hidden) close();
    });
    root.querySelector('form').addEventListener('submit', submit);

    document.body.append(root);
    return root;
  }

  function close() { if (root) root.hidden = true; }

  function status(text, tone) {
    var n = root.querySelector('[data-status]');
    n.textContent = text;
    n.setAttribute('data-tone', tone || '');
  }

  /** Writes only if nothing newer has happened since `mine` was taken. */
  function statusIfCurrent(mine, text, tone) {
    if (mine !== generation) return;
    status(text, tone);
  }

  function submit(event) {
    event.preventDefault();
    var mine = ++generation;
    var message = root.querySelector('[data-message]').value.trim();
    if (!message) { statusIfCurrent(mine, 'Add a little about what you need before sending.', 'warn'); return; }

    var category = CATEGORY_MAP[root.querySelector('[data-category]').value] || 'general';
    var contact = root.querySelector('[data-contact]').value;
    var followup = root.querySelector('[data-followup]').checked;
    var button = root.querySelector('[data-submit]');
    button.disabled = true;
    statusIfCurrent(mine, 'Sending…');

    session().then(function (s) {
      if (!s || !s.getToken) {
        // Never claim a send that cannot happen.
        button.disabled = false;
        statusIfCurrent(mine, 'You are not signed in, so this cannot reach the church team. ' +
               'Sign in and try again, or use the leader conversation on this page.', 'warn');
        return null;
      }
      return s.getToken().then(function (token) {
        return fetch('/api/portal/care', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            category: category,
            message: message,
            preferred_contact_method: contact,
            requests_human_followup: followup
          })
        });
      }).then(function (resp) {
        return resp.json().catch(function () { return {}; }).then(function (body) {
          button.disabled = false;
          if (!resp.ok) {
            statusIfCurrent(mine, body.error === 'rate_limited'
              ? 'You have sent several requests just now. Please wait a few minutes.'
              : 'That did not send. Nothing has reached the church team — please try again.', 'warn');
            return;
          }
          root.querySelector('form').hidden = true;
          statusIfCurrent(mine, followup
            ? 'Sent. The care team can see this, and someone will be in touch. Response times vary.'
            : 'Sent. The care team can see this. You asked not to be contacted, so nobody will reach out.', 'ok');
        });
      });
    }).catch(function () {
      button.disabled = false;
      statusIfCurrent(mine, 'We could not reach the church just now. Nothing was sent.', 'warn');
    });
  }

  var api = {
    /** @param category a portal or endpoint category id; unknown falls back to general */
    open: function (category) {
      build();
      var mine = ++generation;
      root.hidden = false;
      root.querySelector('form').hidden = false;
      // Clear anything from a previous request. A member's own words about a
      // bereavement or an addiction must not still be sitting in the box the
      // next time this opens -- on a shared screen that is a disclosure, and
      // it would also resend content they did not mean to send again.
      root.querySelector('[data-message]').value = '';
      root.querySelector('[data-followup]').checked = true;
      root.querySelector('[data-contact]').value = 'either';
      status('');
      var select = root.querySelector('[data-category]');
      var mapped = CATEGORY_MAP[category] || 'general';
      select.value = mapped;
      root.querySelector('[data-crisis]').hidden = mapped !== 'crisis';
      root.querySelector('[data-submit]').disabled = false;
      root.querySelector('h2').focus();
      // Tell a signed-out member up front rather than after they have typed.
      session().then(function (s) {
        if (!s || !s.getToken) {
          statusIfCurrent(mine, 'You are viewing a preview and are not signed in. This form cannot ' +
                 'reach the church team until you sign in.', 'warn');
        }
      });
    },
    close: close
  };

  global.GRACE_CARE_REQUEST = api;
})(typeof window !== 'undefined' ? window : globalThis);
