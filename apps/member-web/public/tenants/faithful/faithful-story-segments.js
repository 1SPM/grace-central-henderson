/* The four pilot segmentation questions, added to the My Church "Let us know" panel.
 *
 * WHY THESE FOUR. The Discovery + Validation pilot needs to know whether
 * comprehension and trust differ by language and by digital confidence --
 * Henderson is roughly a fifth Hispanic/Latino and a fifth over 65, and Central
 * runs a Spanish experience. Without these fields a larger sample just produces
 * more undifferentiated data, which is the thing a staged cohort exists to avoid.
 *
 * WHERE IT MOUNTS, AND WHY IT MATTERS. Inside #fp-story-fields but OUTSIDE
 * .fp-questions. faithful-mobile-story.js scrapes '#sec-home .fp-questions' for
 * the visitor's free-text answers; a <select> living in there would be swallowed
 * into draft.church and shown back to the member as if they had typed it. As a
 * sibling it still opens and closes with the Let us know bar, and travels
 * separately as `segments`.
 *
 * NOT IN faithful-preferences.js. That module is keyed to a localStorage bucket
 * and promises answers stay in the browser; these are bound for a server, and
 * scripts/test-mobile-story.mjs asserts localStorage stays empty for a visitor.
 *
 * NO NUMERIC SCALE, DELIBERATELY. Confidence is four named options, not 1-5. A
 * number invites a derived "score" about a member, which this product does not
 * build -- the same reason the Journey page shows steps taken, not a rating.
 */
(() => {
  // Values must match SEGMENT_FIELDS in api/_lib/storySegments.ts exactly; the
  // server rejects anything else rather than quietly dropping it.
  const DECLINE = 'prefer_not_to_say';
  const FIELDS = [
    {
      key: 'age_band',
      label: 'My age',
      why: 'So the church can see whether this works as well for every generation.',
      options: [
        ['under_18', 'Under 18'], ['18_24', '18–24'], ['25_34', '25–34'],
        ['35_44', '35–44'], ['45_54', '45–54'], ['55_64', '55–64'], ['65_plus', '65 or older'],
      ],
    },
    {
      key: 'language_preference',
      label: 'The language I would prefer',
      why: 'So nothing important is only available in one language.',
      options: [['en', 'English'], ['es', 'Spanish / Español'], ['other', 'Another language']],
    },
    {
      key: 'attendance_mode',
      label: 'How I usually take part',
      why: 'So the online experience gets the same attention as the room.',
      options: [['in_person', 'In person'], ['online', 'Online'], ['both', 'Both']],
    },
    {
      key: 'digital_confidence',
      label: 'How I feel about apps and websites',
      why: 'So this can be built for everyone, not only for people who find it easy.',
      options: [
        ['very_comfortable', 'Very comfortable'],
        ['comfortable', 'Comfortable enough'],
        ['some_help', 'I usually want a hand'],
      ],
    },
  ];

  const selects = new Map();

  function build(container) {
    const wrap = document.createElement('fieldset');
    wrap.className = 'fp-question fss-segments';
    wrap.dataset.storySegments = '';

    const legend = document.createElement('legend');
    legend.textContent = 'About you';
    const intro = document.createElement('p');
    intro.textContent = 'Four optional questions. They help the church understand who this is working for — every one can be left unanswered.';
    wrap.append(legend, intro);

    FIELDS.forEach(field => {
      const row = document.createElement('div');
      row.className = 'fss-row';

      const label = document.createElement('label');
      label.htmlFor = 'fss-' + field.key;
      label.textContent = field.label;

      const select = document.createElement('select');
      select.id = 'fss-' + field.key;
      select.dataset.segment = field.key;
      // The decline is the default and the first option: answering is a
      // deliberate act, and a blank never gets recorded as an answer.
      select.append(new Option('Prefer not to say', DECLINE, true, true));
      field.options.forEach(([value, text]) => select.append(new Option(text, value)));

      const why = document.createElement('p');
      why.className = 'fss-why';
      why.id = 'fss-why-' + field.key;
      why.textContent = field.why;
      select.setAttribute('aria-describedby', why.id);

      row.append(label, select, why);
      wrap.append(row);
      selects.set(field.key, select);
    });

    const minorNote = document.createElement('p');
    minorNote.className = 'fss-minor-note';
    minorNote.hidden = true;
    minorNote.textContent = 'Thanks for telling us. Please set an account up together with a parent or a member of the church team.';
    wrap.append(minorNote);

    // The pilot is adult-only for its first round, so this does not silently
    // carry on as though nothing were different.
    selects.get('age_band').addEventListener('change', event => {
      minorNote.hidden = event.target.value !== 'under_18';
    });

    const note = document.createElement('p');
    note.className = 'fp-storage';
    note.textContent = 'These travel with your story only if you choose to carry it to your phone.';
    wrap.append(note);

    container.append(wrap);
  }

  function mount() {
    const container = document.getElementById('fp-story-fields');
    if (!container || container.querySelector('[data-story-segments]')) return false;
    // Guard the contract in code, not just in a comment above.
    if (container.classList.contains('fp-questions') || container.closest('.fp-questions')) return false;
    build(container);
    return true;
  }

  // faithful-preferences.js builds this panel inside an async IIFE that awaits
  // GRACE_SESSION.ready, so the container does not exist at DOMContentLoaded.
  // Observing is the only reliable way in; a fixed timeout would be a race.
  if (!mount()) {
    const home = document.getElementById('sec-home') || document.body;
    const observer = new MutationObserver(() => { if (mount()) observer.disconnect(); });
    observer.observe(home, { childList: true, subtree: true });
    // Stop watching eventually rather than leaving an observer on the page for
    // the life of the session if the panel never appears.
    setTimeout(() => observer.disconnect(), 30000);
  }

  // "Skip this part" clears the whole Let us know block, including these.
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-story-skip]');
    if (button && button.closest('#sec-home')) api.clear();
  }, true);

  const api = {
    /** Only answered fields. A decline carries no information and is omitted. */
    get() {
      const out = {};
      selects.forEach((select, key) => {
        if (select.value && select.value !== DECLINE) out[key] = select.value;
      });
      return out;
    },
    clear() {
      selects.forEach(select => { select.value = DECLINE; });
      const note = document.querySelector('.fss-minor-note');
      if (note) note.hidden = true;
    },
  };

  window.FAITHFUL_STORY_SEGMENTS = api;
})();
