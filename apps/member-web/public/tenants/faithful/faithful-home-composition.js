/* Faithful's approved home composition. Move live controls, not copies of state. */
(() => {
  const home = document.getElementById('sec-home');
  const impact = home?.querySelector('.faithful-home-impact');
  if (!impact || home.dataset.composed) return;
  home.dataset.composed = 'true';
  const make = (tag, className, text) => {
    const node = document.createElement(tag); node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const overview = make('div', 'fh-overview');
  impact.before(overview); overview.append(impact);
  const week = make('section', 'fh-week');
  week.append(make('h2', '', 'This week'));
  const shortcuts = home.querySelector('.dash-kpis');
  // The impact figure now has one home beside the card, not a second shortcut.
  shortcuts.lastElementChild.hidden = true;
  week.append(shortcuts); overview.append(week);
  const card = impact.querySelector('.faithful-impact-card');
  card.prepend(make('h2', 'fh-card-title', 'Your IMPACT card'));
  const cause = impact.querySelector('.faithful-impact-cause');
  cause.prepend(make('h2', 'fh-impact-title', 'Everyday spending. Shared impact.'));
  const stats = cause.querySelector('.faithful-impact-stats');
  stats.children[0].lastChild.textContent = 'Illustrative impact this month';
  cause.querySelector('.fh-impact-title').after(stats);
  cause.querySelector('p').textContent = 'Your chosen cause';
  cause.querySelector('button').textContent = 'View impact';
  cause.querySelector('button').onclick = () => openWalletTab('impact');
  card.querySelector('.faithful-impact-balance button').onclick = () => openWalletTab('give');
  const give = impact.querySelector('.faithful-impact-give');
  const lower = make('section', 'fh-life');
  const feed = home.querySelector('.faithful-community-wall');
  const pantry = make('article', 'fh-pantry');
  pantry.append(make('h3', '', 'A morning at the food pantry'), make('p', '', 'Find a way to lend a hand alongside your church.'));
  const photo = make('img', ''); photo.src = '../../assets/faithful-food-pantry.jpg'; photo.alt = 'Volunteers at the food pantry'; pantry.append(photo);
  const volunteer = make('button', '', 'See volunteering'); volunteer.type = 'button';
  volunteer.onclick = () => document.querySelector('.sb [data-destination="volunteer"]')?.click();
  // Reuse the existing destination control regardless of its internal route name.
  const volunteerLink = [...document.querySelectorAll('.sb button')].find(button => button.textContent.trim() === 'Volunteer');
  if (volunteerLink) volunteer.onclick = () => volunteerLink.click();
  else volunteer.onclick = () => openNetworkTab('community');
  pantry.append(volunteer);
  feed.querySelector('.faithful-community-feed').prepend(pantry);
  const posts = feed.querySelectorAll('.post');
  if (posts[1]) posts[1].hidden = true;
  const community = make('div', 'fh-community');
  community.append(make('h2', 'fh-life-title', 'Life in your church'), make('p', 'fh-life-sub', 'Stay connected. Take part.'), feed);
  const aside = make('aside', 'fh-support');
  aside.append(give);
  give.append(make('p', 'fh-gift-note', 'Direct gifts are separate from card impact.'));
  const care = make('section', 'fh-care');
  care.append(make('h2', '', 'People to turn to'), make('p', '', 'Find support for the season you’re in.'));
  const services = make('div', 'fh-care-services');
  const categories = getPastoralCareCategories();
  const preferred = ['marriage', 'grief', 'parenting', 'faith'];
  preferred.map(id => categories.find(category => category.id === id)).filter(Boolean).forEach(category => {
    const button = make('button', 'fh-care-service');
    button.type = 'button';
    const copy = make('span', 'fh-care-copy');
    copy.append(make('strong', '', category.title), make('small', '', category.subtitle));
    const arrow = make('span', 'fh-care-arrow', '›'); arrow.setAttribute('aria-hidden', 'true');
    button.append(copy, arrow);
    button.onclick = () => {
      goSection('ai');
      const target = document.querySelector(`#pcare-grid [data-pcare-id="${category.id}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.focus({ preventScroll: true });
    };
    services.append(button);
  });
  care.append(services);
  const allCare = make('button', 'fh-care-more', 'View all support options');
  allCare.type = 'button'; allCare.onclick = () => { goSection('ai'); document.getElementById('leader-pastoral-care')?.scrollIntoView({ block: 'start' }); };
  const leaders = make('button', 'fh-care-more', 'Meet your leaders');
  leaders.type = 'button'; leaders.onclick = () => goSection('ai');
  care.append(allCare, leaders, make('p', 'fh-care-note', 'Browse first. Nothing is sent by choosing a topic here.'));
  aside.append(care); lower.append(community, aside); home.append(lower);
  const prayer = home.querySelector('.faithful-invitation-card');
  if (prayer) { prayer.classList.add('fh-prayer'); home.append(prayer); }
  const watch = document.getElementById('home-live-pill');
  watch.textContent = 'Watch the service'; watch.setAttribute('aria-label', 'Watch the service');
  // Reuse the original transient badges; this only presents existing demo data.
  let badgeIndex = 0;
  window.setInterval(() => {
    if (document.hidden || !home.classList.contains('active')) return;
    const donation = document.getElementById('dash-hero-toast');
    if (badgeIndex % 2 === 0) {
      dismissImpactFloat();
      donation?.classList.add('show');
      setTimeout(() => donation?.classList.remove('show'), 6000);
    } else if (demoPurchaseQueue.length) {
      donation?.classList.remove('show');
      showImpactFloat(demoPurchaseQueue[Math.floor(badgeIndex / 2) % demoPurchaseQueue.length]);
      setTimeout(dismissImpactFloat, 6000);
    }
    badgeIndex++;
  }, 14000);
})();
