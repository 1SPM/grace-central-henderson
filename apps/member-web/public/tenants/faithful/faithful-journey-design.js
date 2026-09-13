/* Retain canonical JOURNEY_STATE and handlers; no parallel member data store. */
(() => {
  const root = document.getElementById('sec-profile');
  if (!root || root.dataset.journeyDesign) return;
  root.dataset.journeyDesign = '1';
  const q = s => root.querySelector(s);
  const make = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e; };
  const button = (label, action, cls = 'jy-link') => { const b = make('button', cls, label); b.type = 'button'; b.addEventListener('click', action); return b; };
  const note = (parent, title, copy) => { const n = make('div', 'jy-note'); n.append(make('strong', '', title), document.createTextNode(copy)); parent.append(n); };
  const photoLink = (parent, image, label, action) => { const b = button('', action, 'jy-photo-link'); const img = new Image(); img.src = '../../assets/' + image; img.alt = ''; b.append(img, make('span', '', label)); parent.append(b); };
  q('.journey-title').textContent = 'Reflect';
  q('.journey-sub').textContent = 'Reflect. Explore. Choose your next step.';
  const specs = {
    journal: ['A little space for your soul', 'Reflect, give thanks, and make room for what is on your heart.', 'faithful-reflection.jpg'],
    growth: ['Growth happens in small steps', 'Notice your rhythms, reflect on your experiences, choose your next step.', 'faithful-growth.jpg'],
    study: ['Let Scripture meet your everyday life', 'Real questions. Deeper understanding. A path you can return to.', 'faithful-reflection.jpg'],
    activity: ['Moments along your journey', 'A simple record of reflection, participation, and generosity.', 'journey-hero.jpg'],
    goals: ['Small steps, chosen by you', 'Make room for what matters, at a pace that fits your life.', 'faithful-growth.jpg']
  };
  Object.entries(specs).forEach(([key, [title, copy, image]]) => {
    const panel = q('#journey-' + key), hero = make('div', 'jy-banner');
    hero.style.setProperty('--jy-photo', `url('../../assets/${image}')`);
    const content = make('div', ''); content.append(make('h2', '', title), make('p', '', copy)); hero.append(content);
    panel.prepend(hero);
    hero.after(make('small', 'jy-demo', 'Demo portal · illustrative church milestones · entries and goals use this session’s state'));
  });
  // Expose keyboard equivalents for existing click-only controls.
  root.querySelectorAll('.mood-chip,.goal-idea,.badge-item').forEach(el => {
    el.tabIndex = 0; el.setAttribute('role', 'button');
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
  });
  q('#jd-textarea').setAttribute('aria-label', 'Your reflection');
  root.querySelectorAll('.mood-chip').forEach(el => {
    el.setAttribute('aria-pressed', String(el.classList.contains('selected')));
    el.addEventListener('click', () => root.querySelectorAll('.mood-chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip.classList.contains('selected')))));
  });
  q('#jy-goal-name').setAttribute('aria-label', 'Goal name');
  q('#jy-goal-cadence').setAttribute('aria-label', 'Goal rhythm');
  const journalAside = q('.prof-journal-layout').lastElementChild;
  const recent = make('div', 'card'); recent.innerHTML = '<div class="card-head"><div class="card-title">Previous reflections</div></div>';
  const recentBody = make('div', 'jy-inset'); recent.append(recentBody); journalAside.prepend(recent);
  const refreshRecent = () => {
    recentBody.replaceChildren();
    const entries = JOURNEY_STATE.journalLog.slice(0, 3);
    if (!entries.length) recentBody.append(make('p', '', 'Your reflections will appear here after you save your first entry.'));
    entries.forEach(entry => { const p = make('p', '', entry.date + (entry.mood ? ' · ' + entry.mood : '')); recentBody.append(p); });
    recentBody.append(button('View reflection history', () => switchDesktopJTab('history')));
  };
  const originalHistory = window.renderJournalHistory;
  window.renderJournalHistory = function(...args) { const r = originalHistory.apply(this, args); refreshRecent(); return r; };
  refreshRecent();
  photoLink(journalAside, 'faithful-reflection.jpg', 'Take a thought into Bible Study', () => journeyTab('study'));
  note(q('#journey-journal'), 'Come as you are.', 'There is no perfect entry. A few honest words are enough.');
  // Remove financial grading from Growth while leaving metric hooks intact.
  q('#jy-growth-fill').closest('.card').hidden = true;
  const growthLayout = q('#journey-growth .journey-two-col');
  growthLayout.replaceChildren();
  const rhythms = make('div', 'card'); rhythms.innerHTML = '<div class="card-head"><div class="card-title">Your rhythms</div></div>';
  [
    ['Reflection', 'Make space to notice what is on your heart.', 'Write a reflection', () => journeyTab('journal')],
    ['Scripture', 'Return to a study or explore a new question.', 'Continue study', () => journeyTab('study')],
    ['Community', 'Find belonging in the life of your church.', 'Open Connect', () => goSection('connect')],
    ['Personal intentions', 'Choose a rhythm that fits your life.', 'View goals', () => journeyTab('goals')]
  ].forEach(([title, copy, label, action]) => { const row = make('div', 'jy-rhythm'), text = make('div', ''); text.append(make('strong', '', title), make('p', '', copy)); row.append(text, button(label, action)); rhythms.append(row); });
  const growthAside = make('div', '');
  photoLink(growthAside, 'faithful-reflection.jpg', 'Make space for stillness', () => journeyTab('journal'));
  photoLink(growthAside, 'faithful-community.jpg', 'Connect with your people', () => goSection('connect'));
  growthLayout.append(rhythms, growthAside);
  note(q('#journey-growth'), 'Your journey is not a score.', 'These rhythms are invitations, not measures of spiritual maturity. Giving details remain in your Impact Card.');
  // Canonical study controls stay in place, including all five steps.
  const study = q('#journey-study');
  const aiLabel = make('div', 'jy-note'); aiLabel.textContent = 'AI-guided study · Study guidance is distinct from Scripture. Bring questions to your church leadership when you need personal support.';
  study.append(aiLabel);
  // Activity uses current journal and study records; no invented member events.
  const activityLayout = q('#journey-activity .journey-two-col');
  const oldSummary = activityLayout.firstElementChild; oldSummary.hidden = true;
  const activity = make('div', 'card'); activity.innerHTML = '<div class="card-head"><div class="card-title">Your recent activity</div></div>';
  const filters = make('div', 'jy-filter'), events = make('div', 'jy-timeline'); activity.append(filters, events); oldSummary.after(activity);
  // Hidden legacy summary must not occupy a grid track.
  oldSummary.style.display = 'none';
  let filter = 'All';
  const renderActivity = () => {
    events.replaceChildren();
    const records = [];
    JOURNEY_STATE.journalLog.forEach(e => records.push({type:'Reflections', title:'Saved a journal reflection', date:e.date, action:() => { journeyTab('journal'); switchDesktopJTab('history'); }}));
    JOURNEY_STATE.study.paths.forEach(p => records.push({type:'Studies', title:p.title, date:p.completedAt ? 'Completed study' : 'Study in progress', action:() => journeyTab('study')}));
    const activePath = JOURNEY_STATE.study.activePath;
    if (activePath && !JOURNEY_STATE.study.paths.some(p => p.id === activePath.id)) records.unshift({type:'Studies', title:activePath.title, date:'Study in progress', action:() => journeyTab('study')});
    records.filter(r => filter === 'All' || filter === r.type).forEach(r => { const row = make('div', 'jy-event'); row.append(make('strong', '', r.title), make('small', '', r.date), button('View ' + (r.type === 'Studies' ? 'study' : 'reflection'), r.action)); events.append(row); });
    if (!events.childElementCount) events.append(make('p', 'jy-inset', 'No activity here yet. Your saved reflections and study paths will appear as you use Reflect.'));
    filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === filter)));
  };
  ['All','Reflections','Studies'].forEach(label => filters.append(button(label, () => { filter = label; renderActivity(); })));
  const giving = button('Review giving', () => openWalletGive()); activity.append(giving); giving.style.margin = '16px 22px';
  note(q('#journey-activity'), 'Space to notice how far you have come.', 'Return to a reflection, continue a study, or choose a personal next step.');
  // Move the existing creation form into the supporting column, retaining Add/Cancel.
  const goalPanel = q('#journey-goals'), goalAside = q('.journey-goals-layout').lastElementChild;
  const goalToolbar = make('div', 'jy-rhythm'); goalToolbar.append(make('strong', '', 'Your personal goals'), button('+ New goal', () => toggleGoalForm(), 'jy-primary'));
  q('.journey-goals-layout').before(goalToolbar);
  goalAside.prepend(q('#jy-goal-form'));
  const formRow = q('#jy-goal-form').firstElementChild;
  formRow.style.gridTemplateColumns = '1fr';
  const targetLabel = make('label', 'jy-inset', 'Check-ins per goal cycle');
  const target = make('input', ''); target.type = 'number'; target.min = '1'; target.max = '31'; target.value = '5'; target.id = 'jy-goal-target';
  targetLabel.append(target); formRow.insertBefore(targetLabel, formRow.lastElementChild);
  let editingGoal = null;
  const originalToggleGoalForm = window.toggleGoalForm;
  window.toggleGoalForm = function() {
    editingGoal = null;
    q('#jy-goal-name').value = '';
    target.value = '5';
    q('#jy-goal-cadence').value = 'Daily';
    return originalToggleGoalForm.apply(this, arguments);
  };
  const originalAddGoal = window.addJourneyGoal;
  window.addJourneyGoal = function(title, subtitle) {
    const name = (title || q('#jy-goal-name').value || '').trim();
    if (!name) return originalAddGoal.apply(this, arguments);
    const count = Math.max(1, Math.min(31, Math.floor(Number(target.value) || 5)));
    // Featured ideas always create a goal; they must never overwrite an open edit.
    if (title) editingGoal = null;
    if (editingGoal) {
      editingGoal.title = name; editingGoal.target = count;
      editingGoal.subtitle = q('#jy-goal-cadence').value === 'Weekly' ? 'Weekly rhythm' : 'Daily rhythm';
      editingGoal.cadence = q('#jy-goal-cadence').value;
      editingGoal.checkins = Math.min(count, editingGoal.checkins || 0);
      editingGoal.progress = Math.round(editingGoal.checkins / count * 100);
      editingGoal = null; q('#jy-goal-form').style.display = 'none'; q('#jy-goal-name').value = '';
    } else {
      originalAddGoal.call(this, title, subtitle);
      JOURNEY_STATE.goals[0].target = count; JOURNEY_STATE.goals[0].checkins = 0;
      JOURNEY_STATE.goals[0].cadence = q('#jy-goal-cadence').value;
    }
    renderGoalsList();
  };
  window.renderGoalsList = function() {
    const list = q('#jy-goals-items'); list.replaceChildren();
    JOURNEY_STATE.goals.forEach(g => {
      const card = make('div', 'jy-goal-card');
      const top = make('div', 'jy-goal-card-top'), copy = make('div', '');
      copy.append(make('div', 'jy-goal-card-title', g.title), make('div', 'jy-goal-card-sub', g.subtitle));
      const actions = make('div', '');
      actions.append(button('Edit', () => { editingGoal = g; q('#jy-goal-form').style.display = 'block'; q('#jy-goal-name').value = g.title; target.value = g.target || 5; q('#jy-goal-cadence').value = g.cadence || (/week/i.test(g.subtitle) ? 'Weekly' : 'Daily'); q('#jy-goal-name').focus(); }), button(g.paused ? 'Resume' : 'Pause', () => { g.paused = !g.paused; renderGoalsList(); }));
      top.append(copy, actions); card.append(top);
      const progress = make('div', 'jy-goal-progress'), fill = make('div', 'jy-goal-progress-fill');
      const pct = g.target ? Math.min(100, ((g.checkins || 0) / g.target) * 100) : Math.max(0, Math.min(100, Number(g.progress) || 0));
      fill.style.width = pct + '%'; progress.append(fill); progress.setAttribute('role', 'progressbar'); progress.setAttribute('aria-label', g.title); progress.setAttribute('aria-valuemin', '0'); progress.setAttribute('aria-valuemax', '100'); progress.setAttribute('aria-valuenow', String(Math.round(pct)));
      card.append(make('p', 'jy-goal-card-sub', g.paused ? 'Paused — return when you are ready' : g.target ? `${g.checkins || 0} of ${g.target} check-ins` : `${pct}% recorded progress`), progress);
      const check = button(pct >= 100 ? 'Completed' : 'Check in', () => { if (!g.target) { g.target = 5; g.checkins = Math.round(pct / 20); } g.checkins = Math.min(g.target, (g.checkins || 0) + 1); g.progress = Math.round(g.checkins / g.target * 100); renderGoalsList(); }, 'jy-primary');
      check.disabled = !!g.paused || pct >= 100; check.style.marginTop = '18px'; card.append(check); list.append(card);
    });
    JOURNEY_STATE.activeGoals = JOURNEY_STATE.goals.filter(g => !g.paused).length;
    syncJourneyKpis();
  };
  q('#jy-goal-form').querySelector('button').addEventListener('click', () => { editingGoal = null; });
  renderGoalsList();
  note(goalPanel, 'Some weeks look different.', 'Choose a goal that fits your life. Progress is personal, not a comparison with others.');
  const originalTab = window.journeyTab;
  window.journeyTab = function(...args) { const result = originalTab.apply(this, args); renderActivity(); root.querySelectorAll('.journey-nav-btn').forEach(b => b.setAttribute('aria-current', b.classList.contains('active') ? 'page' : 'false')); return result; };
  renderActivity();
  // Keep the rhythm language gentle when canonical counts update.
  const originalSync = window.syncJourneyKpis;
  window.syncJourneyKpis = function(...args) { const r = originalSync.apply(this, args); const hint = q('#jd-rhythm-hint'); if (hint) hint.textContent = 'Return whenever you have a moment'; return r; };
  syncJourneyKpis();
})();
