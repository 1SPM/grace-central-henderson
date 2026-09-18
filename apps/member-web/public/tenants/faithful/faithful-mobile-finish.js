/* Mobile counterparts of Faithful's home refinements. No account or care writes. */
(() => {
  const home = document.querySelector('#screen-home > .scroll');
  if (!home) return;
  const make = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls; if (text) el.textContent = text; return el; };
  document.querySelectorAll('.mc-front').forEach(front => {
    const image = make('img', 'fm-card-image');
    image.src = '../../assets/faithful-church-card.png'; image.alt = 'Faithful Church IMPACT card — demo';
    front.replaceChildren(image);
  });
  document.querySelectorAll('.mc-flip').forEach(card => {
    card.tabIndex = 0;
    card.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); } };
  });
  const activity = make('section', 'fm-activity');
  activity.setAttribute('aria-label', 'Illustrative church activity');
  const text = make('span', 'fm-activity-text');
  const pause = make('button', '', 'Pause'); pause.type = 'button';
  activity.append(make('small', '', 'Demo activity'), text, pause); home.prepend(activity);
  let index = 0, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const messages = () => [
    ...watchDonationPool.slice(0, 2).map(g => `${g.name} gave $${g.amount} to ${g.fund}`),
    'IMPACT card · McDonald’s · $0.26 for Youth',
    'IMPACT card · Chevron Fuel · $0.63 for Missions'
  ];
  const update = () => { const items = messages(); text.textContent = items[index++ % items.length]; };
  const buttonState = () => { pause.textContent = paused ? 'Resume' : 'Pause'; pause.setAttribute('aria-pressed', String(paused)); };
  pause.onclick = () => { paused = !paused; buttonState(); }; update(); buttonState();
  setInterval(() => { if (!paused && !document.hidden && document.getElementById('screen-home').classList.contains('active') && !activity.matches(':hover, :focus-within')) update(); }, 8000);
  const care = make('section', 'fm-care');
  care.append(make('h2', '', 'People to turn to'), make('p', '', 'Find support for the season you’re in.'));
  [ ['Marriage & relationships', 'Relationships & family'], ['Grief & loss', 'Grief & life changes'], ['Parenting', 'Relationships & family'], ['Faith questions', 'Help me decide'] ].forEach(([label, topic]) => {
    const button = make('button', '', label); button.type = 'button';
    button.onclick = () => {
      showScreen('leaders');
      const choices = document.querySelector('#screen-leaders [data-care-choices]');
      const guide = choices?.closest('details');
      if (guide) guide.open = true;
      if (choices) {
        let context = guide.querySelector('.fm-care-context');
        if (!context) { context = make('p', 'fm-care-context'); choices.before(context); }
        context.textContent = `${label}: explore an initial conversation with the church team. Choose a starting point below; nothing is sent.`;
        context.tabIndex = -1; context.scrollIntoView({ block: 'center' }); context.focus({ preventScroll: true });
      }
    }; care.append(button);
  });
  const leaders = make('button', '', 'Meet your leaders'); leaders.type = 'button'; leaders.onclick = () => showScreen('leaders');
  care.append(leaders, make('small', '', 'Explore the options. No care request is sent here.'));
  home.append(care);
  const prayer = make('section', 'fm-prayer');
  const photo = make('img', ''); photo.src = '../../assets/watch/schedule-prayer.jpg'; photo.alt = ''; photo.loading = 'lazy';
  const copy = make('div', ''); copy.append(make('h2', '', 'Pray with your church'), make('p', '', 'Share a prayer request or pray for others.'));
  const link = make('button', '', 'Go to prayer wall'); link.type = 'button'; link.onclick = () => document.getElementById('home-prayer-wall')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  copy.append(link); prayer.append(photo, copy); home.append(prayer);
})();
