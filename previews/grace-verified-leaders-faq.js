/**
 * Verified Leaders FAQ — shared congregation-facing copy + modal/sheet UI
 * graceVerifiedFaq.init({ churchName, variant: 'modal'|'sheet' })
 */
(function (global) {
  'use strict';

  const TRUST_PILLARS = [
    {
      icon: 'shield',
      title: 'Vetted leaders',
      text: 'Identity and credentials are verified before anyone is listed. Our team reviews for quality, safety, and alignment.',
    },
    {
      icon: 'brain',
      title: 'Leader-controlled avatars',
      text: 'Each avatar is built only from a leader\'s approved teachings, tone, and boundaries — not a generic chatbot. Nothing goes live without their review.',
    },
    {
      icon: 'people',
      title: 'Human follow-up',
      text: 'Verified avatars help with first steps; real leaders follow up for pastoral care. Avatars do not replace counselors or emergency support (988 / crisis routing).',
    },
  ];

  function buildFaqItems(churchName) {
    const church = churchName || 'your church';
    return [
      {
        icon: 'shield',
        q: 'What is a Verified Leader?',
        a: `Verified Leaders are ${church} pastors and ministers whose identity, role, and avatar training have been confirmed before they appear in the directory. You will see a verified badge on their profile and in the Leaders roster.`,
      },
      {
        icon: 'brain',
        q: 'How do leader avatars work?',
        a: 'Each leader has a verified avatar grounded in their approved sermons, teachings, and pastoral responses — not a generic chatbot. It reflects their voice and is available when they cannot be present, including late-night moments of doubt. Conversations are asynchronous; a real leader can follow up on their own schedule.',
      },
      {
        icon: 'people',
        q: 'Is this the same as talking to my pastor?',
        a: 'The avatar reflects each leader\'s pastoral style and knowledge, but it is not a live person. You can always request human follow-up. Crisis keywords and "I need help now" route immediately to on-call pastoral care.',
      },
      {
        icon: 'shield',
        q: 'How do you keep this safe and respectful?',
        a: 'Leaders define what their avatar helps with, avoids, and redirects. Sensitive topics are handled within those boundaries. Interactions are logged so leaders can review and respond when care is needed.',
      },
      {
        icon: 'chat',
        q: 'What can a leader avatar help me with?',
        a: 'Prayer, guidance, giving, groups, scripture, and next steps — within each leader\'s defined scope. Quick commands in the chat surface the most common paths.',
      },
      {
        icon: 'people',
        q: 'When does a real person get involved?',
        a: 'When you request human follow-up, send a direct message, use crisis language, or when pastoral care is clearly needed. Avatars are designed for first steps; your church\'s leaders provide follow-up.',
      },
      {
        icon: 'shield',
        q: 'Is my conversation private?',
        a: `Sessions are confidential within ${church}. Crisis keywords (self-harm, abuse, suicidal thoughts) automatically alert a live pastor — you will never be left alone in those moments.`,
      },
      {
        icon: 'chat',
        q: 'Why does this program exist?',
        a: 'People search for guidance at 2am, in moments of doubt, in places a building cannot reach. Verified Leaders extend trusted pastoral wisdom to those moments — with human care when it matters most.',
      },
    ];
  }

  let config = { churchName: 'your church', variant: 'modal' };
  let faqOpen = -1;
  let overlayEl = null;

  function iconTile(icon, active) {
    if (typeof global.graceIconTile === 'function') return global.graceIconTile(icon, active);
    return '';
  }

  function icon(name, opts) {
    if (typeof global.graceIcon === 'function') return global.graceIcon(name, opts || { size: 14 });
    return '';
  }

  function renderAccordion(items, prefix) {
    const id = prefix || 'vl-faq';
    return items.map((f, i) => `
      <div class="faq-card${i === 0 ? ' open' : ''}" id="${id}-card-${i}">
        <div class="faq-card-head" onclick="graceVerifiedFaq.toggle(${i})">
          <span id="${id}-tile-${i}">${iconTile(f.icon, i === 0)}</span>
          <div class="faq-card-q">${f.q}</div>
          <span class="faq-toggle" id="${id}-toggle-${i}">${icon(i === 0 ? 'chevronUp' : 'chevronDown', { size: 14, variant: i === 0 ? 'inverse' : 'default' })}</span>
        </div>
        <div class="faq-answer" id="${id}-body-${i}"${i === 0 ? '' : ' style="display:none"'}>${f.a}</div>
      </div>`).join('');
  }

  function renderTrustPillars() {
    return TRUST_PILLARS.map((p) => `
      <div class="vl-trust-pillar">
        <div class="vl-trust-pillar-icon">${iconTile(p.icon, false)}</div>
        <div class="vl-trust-pillar-title">${p.title}</div>
        <div class="vl-trust-pillar-text">${p.text}</div>
      </div>`).join('');
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    const isSheet = config.variant === 'sheet';
    overlayEl = document.createElement('div');
    overlayEl.id = 'vl-faq-overlay';
    overlayEl.className = 'vl-faq-overlay' + (isSheet ? ' vl-faq-overlay--sheet' : '');
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');
    overlayEl.setAttribute('aria-labelledby', 'vl-faq-title');
    overlayEl.innerHTML = `
      <div class="vl-faq-backdrop" onclick="graceVerifiedFaq.close()"></div>
      <div class="vl-faq-modal${isSheet ? ' vl-faq-modal--sheet' : ''}" onclick="event.stopPropagation()">
        <button type="button" class="vl-faq-close" onclick="graceVerifiedFaq.close()" aria-label="Close">✕</button>
        <div class="vl-faq-scroll">
          <div class="faq-hero vl-faq-hero">
            <div class="faq-hero-icon" id="vl-faq-hero-icon"></div>
            <div class="faq-eyebrow">Verified Leaders</div>
            <h2 class="faq-title" id="vl-faq-title">How verified avatars work with your leaders</h2>
            <p class="faq-subtitle" id="vl-faq-subtitle">Trusted guidance, leader-controlled companions, and human follow-up when care is needed.</p>
          </div>
          <div class="vl-trust-grid" id="vl-faq-pillars"></div>
          <div class="faq-list" id="vl-faq-list"></div>
        </div>
      </div>`;
    document.body.appendChild(overlayEl);

    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' && overlayEl && overlayEl.classList.contains('open')) graceVerifiedFaq.close();
    });

    return overlayEl;
  }

  function populate() {
    const items = buildFaqItems(config.churchName);
    const pillars = document.getElementById('vl-faq-pillars');
    const list = document.getElementById('vl-faq-list');
    const subtitle = document.getElementById('vl-faq-subtitle');
    const heroIcon = document.getElementById('vl-faq-hero-icon');
    if (subtitle) {
      subtitle.textContent = `How ${config.churchName} extends trusted pastoral care with verified leader avatars — and when a real leader steps in.`;
    }
    if (pillars) pillars.innerHTML = renderTrustPillars();
    if (list) {
      list.innerHTML = renderAccordion(items, 'vl-faq');
      faqOpen = 0;
    }
    if (heroIcon) heroIcon.innerHTML = iconTile('leadership', false);
  }

  const graceVerifiedFaq = {
    TRUST_PILLARS,
    buildFaqItems,

    init(opts) {
      config = Object.assign({ churchName: 'your church', variant: 'modal' }, opts || {});
      ensureOverlay();
      populate();
    },

    open() {
      ensureOverlay();
      populate();
      overlayEl.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (typeof config.onOpen === 'function') config.onOpen();
    },

    close() {
      if (!overlayEl) return;
      overlayEl.classList.remove('open');
      document.body.style.overflow = '';
      if (typeof config.onClose === 'function') config.onClose();
    },

    toggle(i) {
      const items = buildFaqItems(config.churchName);
      const isOpen = faqOpen === i;
      items.forEach((f, j) => {
        const card = document.getElementById('vl-faq-card-' + j);
        const body = document.getElementById('vl-faq-body-' + j);
        const tile = document.getElementById('vl-faq-tile-' + j);
        const toggleEl = document.getElementById('vl-faq-toggle-' + j);
        const open = !isOpen && j === i;
        if (card) card.classList.toggle('open', open);
        if (body) body.style.display = open ? 'block' : 'none';
        if (tile) tile.innerHTML = iconTile(f.icon, open);
        if (toggleEl) toggleEl.innerHTML = icon(open ? 'chevronUp' : 'chevronDown', { size: 14, variant: open ? 'inverse' : 'default' });
      });
      faqOpen = isOpen ? -1 : i;
    },
  };

  global.graceVerifiedFaq = graceVerifiedFaq;
})(typeof window !== 'undefined' ? window : this);
