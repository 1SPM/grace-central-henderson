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
  // Home is the short answer to "what is next for me"; this list is the long
  // answer to "who can help", so it lives on Care, where the Care shortcut and
  // the leader card's "Request pastoral care" already send people.
  // Above that screen's footer: faithful-destinations.js has already appended
  // one, and a section under a footer reads as if the page had ended.
  const careScroll = document.querySelector('#screen-care > .scroll') || home;
  careScroll.insertBefore(care, careScroll.querySelector(':scope > .fd-footer'));
  const prayer = make('section', 'fm-prayer');
  const photo = make('img', ''); photo.src = '../../assets/watch/schedule-prayer.jpg'; photo.alt = ''; photo.loading = 'lazy';
  const copy = make('div', ''); copy.append(make('h2', '', 'Pray with your church'), make('p', '', 'Share a prayer request or pray for others.'));
  const link = make('button', '', 'Go to prayer wall'); link.type = 'button'; link.onclick = () => document.getElementById('home-prayer-wall')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  copy.append(link); prayer.append(photo, copy);
  // Prayer moves to Connect as a pair: the invitation, then the wall it points
  // at. The wall is moved, not copied, so #home-prayer-wall and #cn-reels-wall
  // stay unique and openCnReelsFull() finds them wherever they are.
  const wall = document.getElementById('home-prayer-wall');
  const connect = document.getElementById('cn-panel-community');
  if (connect) {
    const before = connect.querySelector(':scope > .fmc-care');
    [prayer, wall].forEach(el => { if (el) connect.insertBefore(el, before); });
  } else home.append(prayer);

  // What Home keeps of both is one line under the community post.
  const summary = home.querySelector(':scope > .mobile-community-summary');
  if (summary && connect && wall) {
    const toWall = make('button', 'fm-prayer-link', 'Prayer wall →'); toWall.type = 'button';
    toWall.onclick = () => openCnReelsFull();
    summary.querySelector(':scope > button')?.after(toWall);
  }

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

  // GRACE docks above the tab bar instead of sitting two screens down the page.
  //
  // It is the same card, moved -- not a second launcher. The input is still
  // #home-grace-input and the arrow still calls sendGraceHome(), so whatever
  // GRACE does with a message it does from here too. Everything else in the
  // card (title, note, dismiss, "Got it", the reopen button) is hidden by
  // faithful-mobile-home.css: a bar that is always one thumb away has nothing
  // to dismiss. It sits in the screen, not the scroll, so it does not move.
  const grace = document.getElementById('home-grace-wrap');
  if (grace) {
    grace.classList.add('fm-grace-dock');
    grace.querySelector('.grace-orb')?.classList.replace('grace-orb--md', 'grace-orb--sm');
    const ask = document.getElementById('home-grace-input');
    if (ask) ask.placeholder = 'Ask GRACE anything…';
    home.parentElement.append(grace);
  }

  // One row has room for the leader's whole name or for "Open avatar →", not
  // both -- the name was wrapping. The line under the name already says this
  // is an AI avatar, and the card keeps its "Open your leader avatar" label
  // for screen readers, so the visible word can be short.
  const talk = home.querySelector('#home-leader-chip .home-leader-chip-cta');
  if (talk) talk.textContent = 'Talk';

  // The hero's date line ended "· Faithful Church", which the bar above it
  // already says. That slot now answers the question people open a church app
  // with. 9:45 is the same service the Sunday shortcut and the live pill use;
  // "today" only until that service's window closes at 12:30.
  const heroDate = document.getElementById('home-hero-date');
  if (heroDate) {
    const now = new Date(), day = now.getDay();
    const when = day === 0 && now.getHours() * 60 + now.getMinutes() <= 750 ? 'today' : day === 6 ? 'tomorrow' : 'Sunday';
    heroDate.textContent = heroDate.textContent.split(' · ')[0] + ' · Worship ' + when + ' 9:45 AM';
  }

  // faithful-destinations.js appends the page footer, and it runs before this
  // module -- so everything added above lands BELOW it. That left three
  // sections and the survey sitting under a footer, which reads as if the page
  // had already ended. On desktop the footer is last, as a footer should be.
  // append() moves an existing node rather than copying it.
  // ── the reading order, matched to the portal's My Church ──
  //
  // The phone had grown its own order: the shortcuts row above the dropdown,
  // and the IMPACT summary three sections below where the portal puts the card.
  // Someone shown the portal and then handed the phone was reading two
  // different pages, which is the opposite of what a demo of one product
  // should do.
  //
  // Ordered explicitly rather than by moving individual pieces, so the sequence
  // is readable here and a section added later lands deliberately instead of
  // wherever its own module happened to append it. Anything not listed keeps
  // its position, and a missing section is skipped rather than throwing --
  // several of these are built by other modules that may not have run.
  //
  // The portal's My Church goes on to the prayer wall, people to turn to and
  // pray with your church. The phone keeps the portal's order but stops early:
  // those three live on Connect and Care, one tap away, so Home is about three
  // screens instead of six. Same sequence, shorter page. GRACE is not in the
  // list at all: it has no portal equivalent, and it is docked above the tabs.
  //
  // Two deliberate departures from the portal's order, both the owner's call
  // after seeing the page on a phone. The shortcuts row sits directly under the
  // hero: on a phone those four tiles ARE the navigation, and below the IMPACT
  // module they were a screen and a half away. And the G-R-A-C-E pathways are
  // not shown on the phone's Home (hidden in faithful-mobile-home.css, still
  // in the DOM because updateDashboard() writes its badges by ID): all five
  // destinations are already a tab or a tile -- Journey, Give, Care, Connect.
  [
    '.home-hero',              // Good morning, Maya
    '.mobile-shortcuts',       // This week: service, groups, care, impact
    '.home-hero-leader',       // Your leader
    '.fp-preferences',         // Your church, at a glance  (the onboarding)
    '.mobile-impact-summary',  // Your IMPACT card
    '.mobile-community-summary', // Life in your church / Community wall (+ the prayer wall link)
    '.fm-survey-invite',       // One last thing -> the survey tab
  ].forEach(sel => {
    const el = home.querySelector(':scope > ' + sel);
    if (el) home.append(el);   // append() moves an existing node
  });

  const footer = home.querySelector(':scope > .fd-footer');
  if (footer) home.append(footer);
})();
