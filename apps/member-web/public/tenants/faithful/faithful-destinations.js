/* Shared Faithful member destinations. No submissions or new storage. */
(function () {
  'use strict';
  const mobile = !!document.getElementById('screen-home');
  const pages = {
    'first-step': ['Attend First Step', 'Get to know your church.', 'community'],
    'give-gift': ['Give a Gift', 'Choose how you would like to give.', ''],
    volunteer: ['Volunteer', 'Find a place to serve.', 'food-pantry'],
    'find-event': ['Find an Event', 'Discover what’s happening at Faithful Church.', 'worship-hero'],
    'join-group': ['Join a Group', 'Find your people.', 'reflection'],
    mission: ['Our Mission', 'Faith in everyday life.', 'community'],
    safety: ['Safety & support', 'Choose the support you need.', ''],
    privacy: ['Your privacy', 'Understand your choices.', ''],
    terms: ['Terms of use', 'Clear expectations for using the member portal.', ''],
    settings: ['Settings', 'Your preferences, in one place.', ''],
    'my-profile': ['My profile', 'Your story, with room to grow.', '']
  };
  const button = (label, action, secondary) => `<button type="button" class="fd-button${secondary ? ' fd-secondary' : ''}" data-fd-action="${action}">${label}</button>`;
  const card = (title, body) => `<article class="fd-card"><h2>${title}</h2>${body}</article>`;
  const detail = (title, body) => `<details class="fd-detail"><summary>${title}</summary><p>${body}</p></details>`;
  const draft = '<p class="fd-notice">Draft · Pending church approval. This is not a published policy.</p>';
  const content = {
    settings: card('Reading preferences', '<p>Adjust text on Journey and information pages. This choice applies to this open page only.</p><label for="fd-reading-size">Reading size</label><select id="fd-reading-size"><option value="standard">Standard</option><option value="large">Larger</option></select><p id="fd-settings-status" role="status"></p>') + card('Personalize your experience', '<p>Review your guidance preferences in the “Make this useful for you” section on Home.</p>' + button('Open Home preferences', 'home') + '<p>These preview preferences are stored in this browser, not synced across devices.</p>') + card('Privacy & your reflections', '<p>Weekly Journey reflections stay in the current page session. They clear on reload. Export only when you want to keep a copy.</p>' + button('Review privacy information', 'privacy', true)) + card('Account & notifications', '<p>Account editing, notification delivery preferences, and a complete app-wide light/dark theme are not connected in this preview. No account or notification settings are changed here.</p>'),
    'first-step': card('What to expect', '<ul><li>Meet the team</li><li>Explore next steps</li><li>Ask questions</li></ul><p>A proposed introduction for people getting to know Faithful Church.</p>') + card('First Step sessions', '<span class="fd-tag">Sample session</span><h3>Sunday after service</h3><p>Meet people and learn about church life. Dates and registration are not yet published.</p>' + detail('Preview a session', 'A welcome, an introduction to the church, and time for your questions. This is a sample outline, not a confirmed event.')),
    'give-gift': card('Your gift', '<p class="fd-notice">Demo · No real payment will be taken.</p><p>Choose your amount, fund, and frequency in the giving page. Review the details before continuing.</p>' + button('Open giving', 'giving')) + card('Before you give', '<p>Check the selected fund, amount, and frequency. Giving information in this preview is sample data.</p>'),
    volunteer: card('Explore opportunities', '<span class="fd-tag">Sample opportunities</span>' + detail('Welcome team', 'Help people feel at home at church gatherings. Role requirements and schedules will be confirmed by the church.') + detail('Food pantry', 'Help sort and prepare food for local families. Training and availability will be confirmed before participation.') + detail('Care & outreach', 'Explore practical ways to support your community. Some roles may require screening and training.')) + card('Your next step', '<p>Opportunity registration is not connected yet. Explore the existing community space while the church prepares its volunteer listings.</p>' + button('Open Connect', 'connect')),
    'find-event': card('Upcoming events', '<p>Browse the existing event listings, see details, and use the available event actions.</p>' + button('Browse events', 'events')) + card('Plan your visit', '<p>Check the event’s date, location, and registration details before making plans. Preview listings may contain sample information.</p>'),
    'join-group': card('Find a group', '<p>Explore the church’s existing groups and find a community that fits your interests.</p>' + button('Browse groups', 'groups')) + card('A place to connect', '<p>Start with a group’s meeting details and description. Check availability and participation requirements with the organizer.</p>'),
    mission: '<p class="fd-notice">Proposed copy · Church-approved content to be added.</p>' + card('Faith in everyday life', '<p>We’re a church family following Jesus, growing together, and seeking to make a positive difference in our community.</p>' + detail('What we believe', 'The church’s approved statement of belief will appear here.') + detail('How we serve', 'Approved ministry priorities and community partnerships will appear here.')) + card('Meet our leadership', '<p>Get to know the leaders represented in your member portal.</p>' + button('View leadership', 'leaders')),
    safety: '<article class="fd-card fd-urgent"><h2>Immediate danger?</h2><p>If you or someone else is in immediate danger, contact local emergency services. This portal is not an emergency service.</p>' + button('Emergency resources', 'crisis') + '</article>' + card('Pastoral support', '<p>Request support through the church’s existing care page. Response times vary.</p>' + button('Open pastoral care', 'care', true)) + card('Community safety', detail('Report a concern', 'A dedicated reporting channel is not connected yet. Use your church’s established contact channel for non-emergency concerns. Do not rely on an AI conversation to report urgent harm.') + detail('Community guidelines', 'Church-approved community guidelines will be added here.')),
    privacy: draft + card('Your information', '<p>This page will explain what information is collected, why it is used, who can access it, and how to ask questions.</p>' + detail('Profile visibility', 'Visibility controls are not connected on this page yet. Do not assume information is private without checking the current sharing context.') + detail('Notification preferences', 'Notification settings will be linked here when available.') + detail('Access, correction & deletion', 'The approved request process and contact details must be supplied before publication.')) + card('Privacy policy', '<p>Collection, sharing, retention, and contact details require review. No new privacy guarantees are introduced by this preview.</p>'),
    terms: draft + card('Using the portal', detail('Member accounts', 'Account eligibility and responsibilities require approved terms.') + detail('Community participation', 'Participation rules and moderation processes require church approval.') + detail('AI-assisted features', 'AI interactions must be identified. A leader’s AI avatar is not a live conversation with that person.') + detail('Giving & payments', 'The current preview uses demo financial flows. Final payment terms must reflect the actual service before launch.') + detail('Contact & questions', 'Approved support and legal contact details will be added before publication.'))
  };
  const parent = document.getElementById(mobile ? 'screen-home' : 'sec-home').parentElement;
  content['my-profile']='<div data-member-profile></div>';
  content.settings=card('My profile','<p>Your details, connections, and interests.</p>'+button('Open my profile','my-profile'))+content.settings;
  Object.entries(pages).forEach(([key, [title, subtitle, photo]]) => {
    const section = document.createElement(mobile ? 'section' : 'div');
    section.className = (mobile ? 'screen' : 'sec') + ' fd-destination';
    section.id = (mobile ? 'screen-' : 'sec-') + 'destination-' + key;
    section.innerHTML = `${mobile ? '<header class="fd-top"><button type="button" class="fd-back" data-fd-action="home" aria-label="Back to Home">‹</button><span>'+title+'</span><button type="button" class="fd-menu" aria-label="Open menu" aria-controls="app-drawer">☰</button></header>' : ''}<div class="${mobile ? 'scroll ' : ''}fd-page"><header class="fd-heading"><h1 tabindex="-1">${title}</h1><p>${subtitle}</p></header>${photo ? `<img class="fd-hero" src="../../assets/faithful-${photo}.jpg" alt="" loading="lazy">` : ''}<div class="fd-grid${key === 'terms' ? ' fd-grid-single' : ''}">${content[key]}</div></div>`;
    section.querySelector('.fd-menu')?.addEventListener('click', () => toggleAppMenu());
    parent.appendChild(section);
  });
  window.openMemberDestination = function (key) {
    if (!pages[key]) return;
    const id = 'destination-' + key;
    if (mobile) { closeAppMenu(); showScreen(id); }
    else { goSection(id); document.getElementById('tb-title').textContent = pages[key][0]; }
    const page = document.getElementById((mobile ? 'screen-' : 'sec-') + id);
    (mobile ? page.querySelector('.fd-page') : parent).scrollTop = 0;
    page.querySelector('h1').focus({preventScroll:true});
    if(key==='my-profile')window.dispatchEvent(new Event('faithful-profile-open'));
  };
  const settingsButton=document.createElement('button');
  settingsButton.type='button';settingsButton.className='fd-settings-cog';settingsButton.dataset.fdAction='settings';
  settingsButton.innerHTML='<span aria-hidden="true">⚙</span><span>Settings</span>';
  settingsButton.setAttribute('aria-label','Open Settings');
  const settingsHost=document.querySelector(mobile?'#app-drawer':'.sb-foot');
  if(settingsHost){if(mobile)settingsHost.append(settingsButton);else settingsHost.prepend(settingsButton);}
  window.openMemberSettings=()=>openMemberDestination('settings');
  document.querySelectorAll('[onclick="showToast(\'Settings\')"]').forEach(button=>{
    button.removeAttribute('onclick');button.dataset.fdAction='settings';
  });
  document.getElementById('fd-reading-size').addEventListener('change',event=>{
    document.documentElement.classList.toggle('fd-large-reading',event.target.value==='large');
    document.getElementById('fd-settings-status').textContent='Reading size updated for this page session.';
  });
  document.addEventListener('click', function (event) {
    const control = event.target.closest('[data-fd-action]');
    if (!control) return;
    const action = control.dataset.fdAction;
    if (pages[action]) { openMemberDestination(action); return; }
    if (action === 'crisis') {
      if (typeof openCrisisSupport === 'function') openCrisisSupport();
      else if (typeof window.GRACE_OPEN_CRISIS === 'function') window.GRACE_OPEN_CRISIS();
      else window.openMemberDestination('safety');
    } else if (mobile) {
      const target = {home:'home',giving:'give',connect:'community',events:'community',groups:'community',leaders:'leaders',care:'care'}[action];
      if (target) showScreen(target);
      if (action === 'events' || action === 'groups') communityTab('groups-events');
    } else {
      if (action === 'giving') openWalletTab('give');
      else if (['connect','events','groups'].includes(action)) openNetworkTab(action === 'connect' ? 'community' : 'groups-events');
      else goSection(action === 'home' ? 'home' : 'ai');
    }
  });
  if (mobile) {
    document.querySelectorAll('[onclick^="drawerMenuAction("]').forEach(button => {
      const key = button.getAttribute('onclick').match(/'([^']+)'/)?.[1];
      if (['mission','safety','privacy','terms','first-step','give-gift','volunteer','find-event','join-group'].includes(key)) { button.remove(); }
      else if (pages[key]) { button.removeAttribute('onclick'); button.dataset.fdAction = key; }
    });
  }
  const footerMarkup = '<span>Faithful Church</span><nav aria-label="Quick links">' + Object.entries({mission:'Our Mission',safety:'Safety',privacy:'Privacy',terms:'Terms'}).map(([key,label]) => `<button type="button" data-fd-action="${key}">${label}</button>`).join('') + '</nav>';
  const footerHosts = mobile ? parent.querySelectorAll('.screen:not(.push-screen) > .scroll') : [parent];
  footerHosts.forEach(host => {
    const footer = document.createElement('footer');
    footer.className = 'fd-footer'; footer.innerHTML = footerMarkup;
    host.appendChild(footer);
  });
  if (mobile) {
    document.querySelectorAll('.drawer-section-label').forEach(label => {
      if (['quick links','get connected'].includes(label.textContent.trim().toLowerCase())) label.remove();
    });
  }
  // Follow existing screen routing, including departures through primary navigation.
  const syncCurrent = () => {
    const active = parent.querySelector(mobile ? '.screen.active' : '.sec.active');
    const key = active?.id.split('destination-')[1];
    document.querySelectorAll('.fd-nav [data-fd-action],.fd-footer [data-fd-action],.drawer-link[data-fd-action]').forEach(link => {
      if (link.dataset.fdAction === key) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
  };
  new MutationObserver(syncCurrent).observe(parent,{subtree:true,attributes:true,attributeFilter:['class']});
  syncCurrent();
})();
