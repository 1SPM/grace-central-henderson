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

  // The walkthrough ends here, so this is where it points at the survey.
  //
  // The survey used to be mounted at this spot. Structurally that was right --
  // after everything else -- but this scroll is about twelve phone screens, so
  // it was in practice unreachable, and a completion rate near zero would have
  // read as disinterest rather than as nobody ever finding it. It lives on its
  // own tab now; what stays here is the invitation.
  const invite = make('section', 'fm-survey-invite');
  invite.append(
    make('h2', '', 'One last thing'),
    make('p', '', 'A few questions about what you just saw. It takes about two minutes, every question is optional, and nothing is linked to your name.'),
  );
  const go = make('button', '', 'Answer the questions');
  go.type = 'button';
  go.onclick = () => { showScreen('survey'); };
  invite.append(go);
  home.append(invite);

  // faithful-destinations.js appends the page footer, and it runs before this
  // module -- so everything added above lands BELOW it. That left three
  // sections and the survey sitting under a footer, which reads as if the page
  // had already ended. On desktop the footer is last, as a footer should be.
  // append() moves an existing node rather than copying it.
  const footer = home.querySelector(':scope > .fd-footer');
  if (footer) home.append(footer);
})();
