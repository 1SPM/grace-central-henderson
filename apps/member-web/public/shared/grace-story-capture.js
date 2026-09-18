/* "Let us know" story capture — self-contained, tenant-neutral.
 *
 * Faithful's equivalent is spread across ~six modules that scrape a DOM
 * faithful-preferences.js builds. That coupling is why the capture could not
 * simply be copied to Central: Central's markup has none of those hooks, and
 * a selector contract nobody else knows they are party to is how Faithful's
 * Impact panel silently captured nothing for months.
 *
 * This builds its own DOM inside whatever container it is given, keeps its own
 * state, and never reads another module's markup. It mounts wherever a page
 * puts <div data-grace-story-capture>.
 *
 * WHAT IT COLLECTS
 *   sections  — free-text answers, allowlisted server-side (storySegments.ts)
 *   segments  — the four pilot fields, enum-only, every one declinable
 *   consents  — three independent choices, none of them compulsory
 *
 * NOTHING PERSISTS HERE. Answers live in this page until the member chooses to
 * carry them to a phone; there is no localStorage write and no autosave. The
 * only way anything leaves is the explicit handoff.
 */
(function (global) {
  'use strict';

  var SECTIONS = [
    { key: 'church', label: 'My connection to church',
      help: 'How long you have been around, and how you usually take part.',
      placeholder: 'New here, back after a while, or part of things for years…' },
    { key: 'connect', label: 'What I am hoping to find',
      help: 'People, a group, somewhere to serve, or just a place to start.',
      placeholder: 'Meet people, find a group, somewhere to help…' },
    { key: 'leadership', label: 'Where the church could help',
      help: 'Optional. Keep private care details out of this — there is a care form for that.',
      placeholder: 'Prayer, encouragement, practical help, or knowing who to ask…' },
    { key: 'reflect', label: 'Anything else you would like us to know',
      help: 'A hope, a question, something on your mind.',
      placeholder: 'In your own words…' },
  ];

  /* Values must match SEGMENT_FIELDS in api/_lib/storySegments.ts exactly; the
     server rejects anything else rather than quietly dropping it. */
  var DECLINE = 'prefer_not_to_say';
  var SEGMENTS = [
    { key: 'age_band', label: 'My age',
      why: 'So the church can see whether this works for every generation.',
      options: [['under_18','Under 18'],['18_24','18–24'],['25_34','25–34'],['35_44','35–44'],
                ['45_54','45–54'],['55_64','55–64'],['65_plus','65 or older']] },
    { key: 'language_preference', label: 'The language I would prefer',
      why: 'So nothing important is only available in one language.',
      options: [['en','English'],['es','Spanish / Español'],['other','Another language']] },
    { key: 'attendance_mode', label: 'How I usually take part',
      why: 'So the online experience gets the same attention as the room.',
      options: [['in_person','In person'],['online','Online'],['both','Both']] },
    { key: 'digital_confidence', label: 'How I feel about apps and websites',
      why: 'So this is built for everyone, not only for people who find it easy.',
      options: [['very_comfortable','Very comfortable'],['comfortable','Comfortable enough'],
                ['some_help','I usually want a hand']] },
  ];

  var mounted = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function build(container) {
    var wrap = el('section', 'gsc');
    wrap.setAttribute('aria-label', 'Tell us about you');

    var heading = el('h2', null, 'Let us know');
    heading.tabIndex = -1;
    wrap.append(heading);
    wrap.append(el('p', 'gsc-lede',
      'A few optional questions. They help the church understand who this is working for. ' +
      'Everything here is optional, and nothing leaves this page unless you choose to carry it to your phone.'));

    var form = el('form', 'gsc-form');

    SECTIONS.forEach(function (s) {
      var row = el('div', 'gsc-row');
      var label = el('label', null, s.label);
      label.htmlFor = 'gsc-' + s.key;
      var area = document.createElement('textarea');
      area.id = 'gsc-' + s.key;
      area.rows = 3;
      area.maxLength = 400;
      area.placeholder = s.placeholder;
      area.setAttribute('data-section', s.key);
      var help = el('p', 'gsc-help', s.help);
      help.id = 'gsc-help-' + s.key;
      area.setAttribute('aria-describedby', help.id);
      row.append(label, area, help);
      form.append(row);
    });

    var segs = el('fieldset', 'gsc-segments');
    segs.append(el('legend', null, 'About you'));
    segs.append(el('p', 'gsc-help', 'Four optional questions. Every one can be left unanswered.'));
    SEGMENTS.forEach(function (f) {
      var row = el('div', 'gsc-row');
      var label = el('label', null, f.label);
      label.htmlFor = 'gsc-seg-' + f.key;
      var select = document.createElement('select');
      select.id = 'gsc-seg-' + f.key;
      select.setAttribute('data-segment', f.key);
      // The decline is first and selected: answering is a deliberate act, and
      // a blank is never recorded as an answer.
      select.append(new Option('Prefer not to say', DECLINE, true, true));
      f.options.forEach(function (o) { select.append(new Option(o[1], o[0])); });
      var why = el('p', 'gsc-help', f.why);
      why.id = 'gsc-why-' + f.key;
      select.setAttribute('aria-describedby', why.id);
      row.append(label, select, why);
      segs.append(row);
    });
    var minorNote = el('p', 'gsc-minor-note',
      'Thanks for telling us. Please set an account up together with a parent or a member of the church team.');
    minorNote.hidden = true;
    segs.append(minorNote);
    form.append(segs);

    var name = el('div', 'gsc-row');
    var nameLabel = el('label', null, 'Your preferred name');
    nameLabel.htmlFor = 'gsc-name';
    var nameInput = document.createElement('input');
    nameInput.id = 'gsc-name';
    nameInput.type = 'text';
    nameInput.maxLength = 80;
    nameInput.setAttribute('data-name', '');
    name.append(nameLabel, nameInput);
    form.append(name);

    var consents = el('fieldset', 'gsc-consents');
    consents.append(el('legend', null, 'What would you like to share?'));
    [['carry', 'Carry my story to my phone.'],
     ['money', 'Include anything I explored about the Impact Card.'],
     ['followup', 'Let the church team follow up with me about this.']
    ].forEach(function (c) {
      var label = el('label');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.setAttribute('data-consent-' + c[0], '');
      label.append(box, document.createTextNode(' ' + c[1]));
      consents.append(label);
    });
    form.append(consents);

    var submit = el('button', null, 'Create my handoff');
    submit.type = 'submit';
    submit.setAttribute('data-create', '');
    var decline = el('button', null, 'Continue without sharing my story');
    decline.type = 'button';
    decline.setAttribute('data-decline', '');
    form.append(submit, decline);

    var status = el('p', 'gsc-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    wrap.append(form, status);
    container.append(wrap);

    // The pilot's first round is adult-only, so this does not carry on silently.
    segs.querySelector('[data-segment="age_band"]').addEventListener('change', function (e) {
      minorNote.hidden = e.target.value !== 'under_18';
    });

    form.addEventListener('submit', function (e) { e.preventDefault(); handoff(wrap, status); });
    decline.onclick = function () {
      status.textContent = 'Nothing was sent. Your answers stay on this page.';
    };
    return wrap;
  }

  function readSections(wrap) {
    var out = {};
    wrap.querySelectorAll('[data-section]').forEach(function (area) {
      var value = area.value.trim();
      if (value) out[area.getAttribute('data-section')] = [value];
    });
    return out;
  }

  function readSegments(wrap) {
    var out = {};
    wrap.querySelectorAll('[data-segment]').forEach(function (select) {
      // An explicit decline carries no information and is not stored as an answer.
      if (select.value && select.value !== DECLINE) out[select.getAttribute('data-segment')] = select.value;
    });
    return out;
  }

  function consent(wrap, key) {
    var box = wrap.querySelector('[data-consent-' + key + ']');
    return !!(box && box.checked);
  }

  function handoff(wrap, status) {
    var name = wrap.querySelector('[data-name]').value.trim();
    if (!name) { status.textContent = 'Add your preferred name to continue.'; return; }
    // Carrying the story is what the handoff IS, so it gates this button only.
    // A consent you cannot decline is not consent, which is why the decline
    // button sits beside it.
    if (!consent(wrap, 'carry')) {
      status.textContent = 'Tick “Carry my story to my phone”, or use “Continue without sharing my story”.';
      return;
    }
    if (!global.GRACE_STORY_HANDOFF) {
      status.textContent = 'The phone handoff is unavailable right now. Nothing was sent.';
      return;
    }
    status.textContent = '';
    global.GRACE_STORY_HANDOFF.start({
      preferredName: name,
      sections: readSections(wrap),
      consents: { carry: true, money: consent(wrap, 'money'), followup: consent(wrap, 'followup') },
    });
  }

  function mount() {
    var container = document.querySelector('[data-grace-story-capture]');
    if (!container || mounted) return false;
    mounted = build(container);
    if (global.GRACE_STORY_HANDOFF) {
      global.GRACE_STORY_HANDOFF.configure({
        mountAfter: mounted,
        hideWhileOpen: mounted,
        segments: function () { return readSegments(mounted); },
      });
    }
    return true;
  }

  if (!mount()) {
    document.addEventListener('DOMContentLoaded', mount);
  }

  global.GRACE_STORY_CAPTURE = {
    getDraft: function () { return mounted ? readSections(mounted) : {}; },
    getSegments: function () { return mounted ? readSegments(mounted) : {}; },
    getConsents: function () {
      if (!mounted) return { carry: false, money: false, followup: false };
      return { carry: consent(mounted, 'carry'), money: consent(mounted, 'money'), followup: consent(mounted, 'followup') };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
