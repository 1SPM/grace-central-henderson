/* Compose the existing controls once; retain their handlers and state. */
(() => {
  const leadership = document.getElementById('sec-ai');
  const leaderMain = leadership.querySelector('.ai-main');
  const layout = leaderMain.parentElement;
  layout.classList.add('faithful-leadership-layout');
  const leaderHeading = document.createElement('header');
  leaderHeading.className = 'faithful-leadership-heading';
  leaderHeading.innerHTML = '<h1>People to walk with you</h1><p>Meet your leaders. Find guidance. Ask for support.</p>';
  layout.before(leaderHeading);
  const roster = document.getElementById('leader-gallery-wrap');
  layout.after(roster);
  const support = document.createElement('aside'); support.className='faithful-leadership-support';
  const care = document.getElementById('leader-pastoral-care');
  support.append(care); layout.append(support);
  care.querySelector('.pcare-head-title').textContent='Talk with your church';
  care.querySelector('.pcare-head-sub').textContent='Request personal pastoral support';
  care.querySelector('.pcare-intro p').textContent='Select the support you need. Response times vary.';
  care.querySelector('.pcare-foot').textContent='Choose what you share when requesting support.';
  leadership.querySelector('.ai-hero-begin').textContent='Open AI avatar';
  const carePhoto=document.createElement('img');carePhoto.src='../../assets/faithful-care.jpg';carePhoto.alt='';carePhoto.className='faithful-care-photo';care.prepend(carePhoto);
  const urgent=document.createElement('section');urgent.className='faithful-urgent-help';
  urgent.setAttribute('aria-labelledby','faithful-emergency-heading');
  urgent.innerHTML='<div class="faithful-emergency-heading"><span aria-hidden="true">♡</span><div><h3 id="faithful-emergency-heading">Emergency & crisis care</h3><p>You do not have to face this alone.</p></div></div><div class="faithful-emergency-path"><h4>Need immediate help?</h4><p>If there is immediate danger, contact your local emergency services. Do not wait for a church reply or an AI conversation.</p><button type="button" data-support="crisis">Find crisis support resources</button></div><div class="faithful-emergency-path"><h4>Connect with pastoral care</h4><p>Request support from your church for what you are going through. Response times vary; this is not an emergency service.</p><button type="button" data-support="pastoral">Request pastoral support</button></div><small>Support resources and church care are separate from your leader’s AI avatar.</small>';
  urgent.querySelector('[data-support="crisis"]').onclick=openCrisisSupport;
  urgent.querySelector('[data-support="pastoral"]').onclick=()=>startPastoralCareRequest('other');
  support.append(urgent);
  const leadershipFaq=leadership.querySelector('.grace-faq-block');
  if(leadershipFaq)leaderMain.append(leadershipFaq);
  const chatHeading=document.createElement('header');chatHeading.className='faithful-leader-chat-heading';chatHeading.innerHTML='<h3>Conversation with your leader’s AI avatar</h3><span>AI · not a live pastor</span>';
  leadership.querySelector('.ai-chat').prepend(chatHeading);
  const home = document.getElementById('sec-home');
  document.getElementById('home-leader-strip-sub').textContent = 'AI avatar · not a live pastor';
  document.getElementById('home-leader-strip-cta').textContent = 'Open avatar →';
  const careLink = document.createElement('button');
  careLink.type = 'button'; careLink.className = 'faithful-human-care'; careLink.textContent = 'Request pastoral care';
  careLink.onclick = event => { event.stopPropagation(); goSection('outreach'); };
  document.querySelector('.home-leader-strip-copy').append(careLink);
  const hero = home.querySelector('.dash-hero');
  const shortcuts = hero.querySelector('.dash-kpis');
  hero.after(shortcuts);
  const routes = [openWatchLive, () => openNetworkTab('community'), () => goSection('outreach'), () => openWalletTab('impact')];
  [...shortcuts.children].forEach((item, index) => {
    const icon = document.createElement('span');
    icon.className = 'faithful-shortcut-icon'; icon.setAttribute('aria-hidden', 'true');
    if (index < 3) {
      icon.setAttribute('data-grace-icon', ['calendar', 'people', 'heart'][index]);
      icon.setAttribute('data-grace-size', '30');
    } else {
      icon.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none"><path d="M20 3C9 3 4 7 4 13c0 3 2 5 5 5 7 0 10-7 11-15Z" fill="currentColor"/><path d="M3 22C7 14 12 10 18 6" stroke="#fff" stroke-width="1.2"/></svg>';
    }
    item.prepend(icon);
    item.setAttribute('role', 'button'); item.tabIndex = 0;
    item.onclick = routes[index];
    item.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); routes[index](); } };
  });
  if (typeof hydrateGraceIcons === 'function') hydrateGraceIcons(shortcuts);
  document.getElementById('nav-give').onclick = () => openWalletTab('impact');
  const oldDetails = document.querySelector('#wlt-impact .wlt-impact-flow');
  const details = document.createElement('details');
  details.className = 'faithful-impact-details';
  details.open = true;
  const summary = document.createElement('summary');
  summary.textContent = 'Manage allocation and view detailed activity';
  oldDetails.before(details); details.append(summary, oldDetails);
  const originalActivity = window.openWalletActivity;
  window.openWalletActivity = function () {
    details.open = true;
    originalActivity();
  };
  const demo = document.createElement('small');
  demo.className = 'faithful-demo-label';
  demo.textContent = 'Demo preview · illustrative balances and impact';
  document.querySelector('.faithful-impact-header').append(demo);
  document.querySelector('.faithful-impact-cause > button').onclick = () => {
    details.open = true;
    openWalletTab('impact');
    setTimeout(() => document.getElementById('wlt-alloc-card').scrollIntoView({behavior:'smooth'}), 150);
  };
  const balance = document.getElementById('faithful-impact-balance');
  balance.textContent = Number(WALLET_STATE.available).toLocaleString();
  const funds = ['General Tithe', 'Missions Fund', 'Youth Ministry', 'Food Pantry'];
  document.querySelectorAll('.faithful-impact-give > button:not(.faithful-impact-give-cta)').forEach((button,index) => {
    button.onclick = () => {
      openWalletGive();
      const select = document.getElementById('give-to-select');
      select.value = funds[index]; syncFundChips();
    };
  });
  const ask = document.querySelector('.faithful-ask-grace');
  ask.removeAttribute('role'); ask.removeAttribute('tabindex'); ask.onclick = null;
  home.querySelector('.dash-mod-body').append(ask);
  ask.classList.add('faithful-next-step-invitation');
  ask.querySelector('strong').textContent = 'Need help finding your next step?';
  ask.querySelector('small').textContent = 'Ask GRACE to help you find your way into church life.';
  const explore = document.createElement('button');
  explore.type = 'button'; explore.className = 'faithful-explore-grace';
  explore.textContent = 'Explore GRACE →';
  explore.onclick = () => sendHomeCmd('Help me find my next step');
  ask.querySelector('.faithful-ask-copy').append(explore);
  ask.querySelectorAll('.faithful-ask-prompt').forEach(item => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = item.className;
    button.textContent = item.textContent; button.onclick = item.onclick; item.replaceWith(button);
  });
  const invitationRow = document.createElement('div');
  invitationRow.className = 'faithful-invitation-row';
  home.append(invitationRow); invitationRow.append(ask);
  ask.querySelectorAll('.faithful-ask-prompt').forEach(button => button.remove());
  [
    {title:'Pray with your church',copy:'Share a prayer request or pray for others.',action:'Go to prayer wall →',image:'faithful-care.jpg',open:() => openNetworkTab('community')},
    {title:'Your shared impact',copy:'See how everyday generosity supports your church community.',action:'See the difference →',image:'faithful-dawn.jpg',open:() => openWalletTab('impact')}
  ].forEach(item => {
    const card = document.createElement('article'); card.className = 'faithful-invitation-card';
    const img = document.createElement('img'); img.src = '../../assets/' + item.image; img.alt = '';
    const body = document.createElement('div');
    const title = document.createElement('h3'); title.textContent = item.title;
    const copy = document.createElement('p'); copy.textContent = item.copy;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = item.action; button.onclick = item.open;
    body.append(title, copy, button); card.append(img, body); invitationRow.append(card);
  });
  // One overview, on My Church; retain detailed wallet controls in their destination.
  const homeImpact = document.createElement('section');
  homeImpact.className = 'faithful-home-impact';
  homeImpact.setAttribute('aria-label', 'Your card and ministry impact');
  homeImpact.append(demo, document.querySelector('.faithful-impact-primary'));
  const homeCardArt = homeImpact.querySelector('.faithful-impact-card-art');
  const homeFlipSource = document.querySelector('#sec-home .dash-wallet .pf-card-flip');
  if (homeCardArt && homeFlipSource) {
    const flip = homeFlipSource.cloneNode(true);
    flip.setAttribute('role', 'button');
    flip.tabIndex = 0;
    flip.setAttribute('aria-label', 'Flip GRACE Impact Card');
    flip.setAttribute('aria-pressed', 'false');
    flip.removeAttribute('onclick');
    flip.onclick = () => {
      pfFlipCard(flip);
      flip.setAttribute('aria-pressed', String(flip.querySelector('.pf-card-inner').classList.contains('pf-flipped')));
    };
    flip.onkeydown = event => {
      if (event.target === flip && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        flip.click();
      }
    };
    homeCardArt.replaceChildren(flip);
  }
  document.getElementById('grace-home-tutorial-wrap').after(homeImpact);
  document.querySelector('.faithful-impact-balance button').onclick = () => openWalletTab('give');
  const impactTile = document.getElementById('home-giving-impact');
  impactTile.hidden = true;
  const wall = document.createElement('section');
  wall.className = 'card faithful-community-wall';
  const heading = document.createElement('h3');
  heading.textContent = 'Community wall';
  const all = document.createElement('button');
  all.type = 'button'; all.textContent = 'Open community wall'; all.onclick = () => openNetworkTab('community');
  wall.append(heading, all);
  const feed = document.createElement('div'); feed.className = 'faithful-community-feed';
  [...document.querySelectorAll('#net-feed > .post')].slice(0, 3).forEach(source => {
    const post = source.cloneNode(true);
    post.removeAttribute('id'); post.style.removeProperty('display');
    post.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    post.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));
    post.querySelectorAll('.comment-area').forEach(el => el.remove());
    post.setAttribute('role', 'link'); post.tabIndex = 0;
    post.setAttribute('aria-label', 'View this post in the Connect community wall');
    const openPost = () => {
      openNetworkTab('community');
      setTimeout(() => source.scrollIntoView({behavior:'smooth',block:'center'}), 150);
    };
    post.onclick = openPost;
    post.onkeydown = event => { if (event.key === 'Enter') openPost(); };
    feed.append(post);
  });
  wall.append(feed); impactTile.after(wall);
  const reel = document.querySelector('.home-prayer-reel');
  const pause = document.createElement('button'); pause.type = 'button';
  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const updatePause = () => { pause.textContent = paused ? 'Resume slides' : 'Pause slides'; };
  pause.onclick = () => { paused = !paused; updatePause(); }; updatePause();
  reel.querySelector('.home-prayer-reel-dots').after(pause);
  document.getElementById('home-prayer-reel-video').onclick = () => cyclePrayerReel();
  setInterval(() => {
    if (!paused && !document.hidden && home.classList.contains('active') && !reel.matches(':hover') && !reel.contains(document.activeElement)) cyclePrayerReel();
  }, 7000);
})();
