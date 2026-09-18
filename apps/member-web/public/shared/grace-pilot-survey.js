/* The pilot's member survey (Track C), rendered in the portal.
 *
 * Twelve questions, wording verbatim from the pilot document. It mounts
 * wherever a page puts <div data-grace-pilot-survey> and builds its own DOM,
 * so it works on any tenant without a per-tenant module.
 *
 * FOUR THINGS THE PILOT DOCUMENT REQUIRES, AND THIS HONOURS
 *
 * 1. Every question is skippable. "You may stop at any time or skip any
 *    question." Nothing is required, and a partial answer set is saved rather
 *    than refused.
 * 2. No identity. Answers are keyed by a random respondent token, never a
 *    person. The token lives in sessionStorage so a member can change an
 *    answer within a sitting; it identifies nobody and dies with the tab.
 * 3. Segmentation without naming anyone. If the walkthrough captured a story
 *    draft, its id rides along so results can be read by language or digital
 *    confidence — not so anyone can be looked up.
 * 4. Answers are saved as they go. A member who stops halfway has still told
 *    the church something, and losing it because they closed a tab would be
 *    the research equivalent of the false-confirmation bug.
 */
(function (global) {
  'use strict';

  var LIKERT = [1, 2, 3, 4, 5];
  var STORAGE_KEY = 'grace.pilot-survey.respondent';
  var mounted = null;
  var questions = [];
  var saveTimer = null;

  function tenantSlug() {
    var m = /\/tenants\/([a-z0-9-]+)\//.exec(location.pathname);
    return m ? m[1] : null;
  }

  /** Random, per-sitting, identifies no one. */
  function respondentKey() {
    try {
      var existing = sessionStorage.getItem(STORAGE_KEY);
      if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
      var bytes = new Uint8Array(24);
      (global.crypto || global.msCrypto).getRandomValues(bytes);
      var key = btoa(String.fromCharCode.apply(null, bytes))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      sessionStorage.setItem(STORAGE_KEY, key);
      return key;
    } catch (_) {
      // Storage blocked: still answerable, just not resumable.
      return 'anon-' + Math.random().toString(36).slice(2).padEnd(16, '0').slice(0, 16);
    }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderQuestion(q, index) {
    var row = el('fieldset', 'gps-q');
    var legend = el('legend');
    legend.append(el('span', 'gps-num', String(index + 1) + '.'), document.createTextNode(' ' + q.text));
    row.append(legend);

    if (q.type === 'likert5') {
      var scale = el('div', 'gps-scale');
      scale.append(el('span', 'gps-anchor', q.low));
      LIKERT.forEach(function (n) {
        var label = el('label', 'gps-dot');
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = q.key;
        input.value = String(n);
        input.setAttribute('data-answer', q.key);
        label.append(input, el('span', null, String(n)));
        // Screen readers get the anchor wording, not a bare number.
        input.setAttribute('aria-label', n === 1 ? q.low : n === 5 ? q.high : String(n));
        scale.append(label);
      });
      scale.append(el('span', 'gps-anchor', q.high));
      row.append(scale);
    } else if (q.type === 'choice') {
      var list = el('div', 'gps-choices');
      q.options.forEach(function (opt) {
        var label = el('label', 'gps-choice');
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = q.key;
        input.value = opt;
        input.setAttribute('data-answer', q.key);
        label.append(input, document.createTextNode(' ' + opt));
        list.append(label);
      });
      row.append(list);
    } else {
      var area = document.createElement('textarea');
      area.rows = 3;
      area.maxLength = q.maxLength || 1000;
      area.setAttribute('data-answer', q.key);
      area.setAttribute('aria-label', q.text);
      row.append(area);
    }

    var skip = el('p', 'gps-skip', 'You can leave this blank.');
    row.append(skip);
    return row;
  }

  function collect() {
    var answers = {};
    mounted.querySelectorAll('[data-answer]').forEach(function (node) {
      var key = node.getAttribute('data-answer');
      if (node.type === 'radio') {
        if (node.checked) answers[key] = node.value;
      } else if (node.value.trim()) {
        answers[key] = node.value.trim();
      }
    });
    return answers;
  }

  function send(completed) {
    var answers = collect();
    var status = mounted.querySelector('[data-status]');

    // Nothing to save. This matters on a reload: the respondent key survives in
    // sessionStorage but the form comes back empty, and sending {} would replace
    // whatever they had already answered with nothing.
    if (!completed && !Object.keys(answers).length) return Promise.resolve(false);
    var draftId = null;
    try { draftId = sessionStorage.getItem('grace.pilot-survey.draft-id'); } catch (_) {}

    return fetch('/api/survey/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign(
        tenantSlug() ? { tenant: tenantSlug() } : {},
        draftId ? { storyDraftId: draftId } : {},
        { track: 'members', respondentKey: respondentKey(), answers: answers, completed: !!completed },
      )),
    }).then(function (resp) {
      return resp.json().catch(function () { return {}; }).then(function (body) {
        if (!resp.ok) {
          // Never imply the church received something it did not.
          status.textContent = 'That did not save. Your answers are still on this page — try again in a moment.';
          return false;
        }
        status.textContent = completed
          ? 'Thank you. Your answers have been sent to the church.'
          : 'Saved.';
        if (completed) {
          mounted.querySelector('form').hidden = true;
          mounted.querySelector('[data-done]').hidden = false;
        }
        return true;
      });
    }).catch(function () {
      status.textContent = 'We could not reach the church just now. Nothing was sent.';
      return false;
    });
  }

  /** Save quietly as they go: a member who stops halfway has still said something. */
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { send(false); }, 1200);
  }

  function build(container) {
    var wrap = el('section', 'gps');
    wrap.setAttribute('aria-label', 'Pilot survey');
    var h = el('h2', null, 'A few questions about what you just saw');
    h.tabIndex = -1;
    wrap.append(h);
    // The question wording is the pilot document's, verbatim, including where it
    // names the church — changing it would break comparability with the scaled
    // survey. This lede is ours, so it stays tenant-neutral like the module.
    wrap.append(el('p', 'gps-lede',
      'Your church is deciding whether GRACE is worth continuing, and your answers are the evidence. ' +
      'There are no right answers, every question is optional, and nothing here is linked to your name.'));

    var form = el('form', 'gps-form');
    questions.forEach(function (q, i) { form.append(renderQuestion(q, i)); });

    var submit = el('button', null, 'Send my answers');
    submit.type = 'submit';
    submit.setAttribute('data-submit', '');
    form.append(submit);
    wrap.append(form);

    var status = el('p', 'gps-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('data-status', '');
    wrap.append(status);

    var done = el('div', 'gps-done');
    done.hidden = true;
    done.setAttribute('data-done', '');
    done.append(el('h3', null, 'Thank you'));
    done.append(el('p', null,
      'Your answers go to the team reviewing this pilot. They are reported together with everyone else’s, not individually.'));
    wrap.append(done);

    form.addEventListener('input', scheduleSave);
    form.addEventListener('change', scheduleSave);
    form.addEventListener('submit', function (e) { e.preventDefault(); if (saveTimer) clearTimeout(saveTimer); send(true); });

    container.append(wrap);
    return wrap;
  }

  function mount() {
    var container = document.querySelector('[data-grace-pilot-survey]');
    if (!container || mounted) return false;
    questions = global.GRACE_PILOT_SURVEY_QUESTIONS || [];
    if (!questions.length) return false;
    mounted = build(container);
    return true;
  }

  global.GRACE_PILOT_SURVEY = {
    mount: mount,
    /** Links this response to the walkthrough's segmentation. No identity. */
    linkStoryDraft: function (id) {
      try { sessionStorage.setItem('grace.pilot-survey.draft-id', id); } catch (_) {}
    },
    getAnswers: function () { return mounted ? collect() : {}; },
  };

  if (!mount()) document.addEventListener('DOMContentLoaded', mount);
})(typeof window !== 'undefined' ? window : globalThis);
