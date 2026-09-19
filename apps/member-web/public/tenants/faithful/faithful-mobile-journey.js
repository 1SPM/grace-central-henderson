(() => {
 const root=document.getElementById('jy-scroll'); if(!root)return;
 const q=s=>root.querySelector(s), el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;n.textContent=text||'';return n;};
 const btn=(text,fn,cls='fmj-row')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
 q('.jy-title').textContent='Reflect';q('.jy-tagline').textContent='Read this week’s message and write down what stays with you.';
 const keys=['journal','growth','study','activity','goals'];
 const titles=['A little space for your soul','Growth happens in small steps','Let Scripture meet your everyday life','Moments along your journey','Small steps, chosen by you'];
 const photos=['reflection','growth','reflection','dawn','growth'];
 const nav=q('.jy-nav');nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Reflect');
 keys.forEach((key,i)=>{
  const id='jy-'+key,p=q('#'+id),b=[...nav.children].find(n=>n.getAttribute('onclick').includes(id));nav.append(b);b.id='fmj-tab-'+key;b.setAttribute('role','tab');b.setAttribute('aria-controls',id);p.setAttribute('role','tabpanel');p.setAttribute('aria-labelledby',b.id);
  const hero=el('div','fmj-hero');hero.style.setProperty('--photo',`url('../../assets/faithful-${photos[i]}.jpg')`);hero.append(el('h2','',titles[i]));p.prepend(hero);
  b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const j=e.key==='Home'?0:e.key==='End'?4:(i+(e.key==='ArrowRight'?1:4))%5;scrollJourney('jy-'+keys[j]);nav.children[j].focus();}});
 });
 window.scrollJourney=function(id){if(!keys.some(k=>'jy-'+k===id))return;keys.forEach(k=>{q('#jy-'+k).hidden='jy-'+k!==id;const b=q('#fmj-tab-'+k);b.setAttribute('aria-selected',String('jy-'+k===id));b.tabIndex='jy-'+k===id?0:-1;});root.scrollTop=0;};
 q('#journal-entry').maxLength=1500;q('#journal-entry').setAttribute('aria-label','Your reflection');
 root.querySelectorAll('.jy-mood-chip,.jy-goal-idea').forEach(n=>{n.tabIndex=0;n.setAttribute('role','button');n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();n.click();}});});
 const note=(id,text)=>q(id).append(el('div','fmj-note',text));
 note('#jy-journal','No perfect streak needed. Return whenever you have a moment.');
 q('#jy-growth .jy-card').hidden=true;
 [['Reflection','Write a reflection','journal'],['Scripture','Continue study','study'],['Community','Open Connect','connect'],['Personal intentions','View goals','goals']].forEach(([title,copy,key])=>{const b=btn('',()=>key==='connect'?showScreen('community'):scrollJourney('jy-'+key));b.append(el('strong','',title),el('span','',copy+' →'));q('#jy-growth').append(b);});
 note('#jy-growth','Your journey is not a score.');
 q('#jy-activity .jy-card').hidden=true;
 const recent=el('div','jy-card');recent.append(el('h3','','Your recent activity'),btn('Reflection history',()=>{scrollJourney('jy-journal');jyJournalTab('history',q('#jy-jtab-hist'));}),btn('Your study paths',()=>scrollJourney('jy-study')));q('#jy-activity .fmj-hero').after(recent);
 q('#jy-activity .jy-badge-scroll').before(el('p','','Illustrative milestones · demo portal'));
 note('#jy-study','AI-guided study. Guidance is distinct from Scripture; your church leadership is here for personal support.');
 q('#jy-goal-empty-card p').textContent='Choose a personal rhythm that fits your life. Start small and return at your own pace.';
 q('#jy-goals .fmj-hero').after(btn('+ New goal',()=>jyToggleGoalForm(true),'fmj-primary'));
 q('#jy-goal-name').setAttribute('aria-label','Goal name');q('#jy-goal-cadence').setAttribute('aria-label','Rhythm');
 window.jyRenderGoals=function(){const wrap=q('#jy-goals-items');wrap.replaceChildren();jyGoals.forEach(g=>{const card=el('div','fmj-goal');card.append(el('strong','',g.title),el('p','',g.subtitle));const p=el('progress','');p.max=100;p.value=g.progress||0;p.setAttribute('aria-label',g.title+' progress');card.append(p,el('p','',g.paused?'Paused':`${g.progress||0}% recorded progress`));const check=btn('Check in',()=>{g.progress=Math.min(100,(g.progress||0)+20);jyRenderGoals();},'fmj-primary');check.disabled=g.paused||g.progress>=100;card.append(check,btn(g.paused?'Resume':'Pause',()=>{g.paused=!g.paused;jyRenderGoals();},'jy-btn-ghost'));wrap.append(card);});q('#jy-goals-list-card').style.display=jyGoals.length?'':'none';q('#jy-goal-empty-card').style.display=jyGoals.length?'none':'';};
 note('#jy-goals','Some weeks look different. Choose a pace that fits your life.');
 // Surface the existing session records instead of a second static sample feed.
 const feed=el('div','');recent.replaceChildren(el('h3','','Recent activity'),feed);
 const updateFeed=()=>{feed.replaceChildren();
  q('#jy-hist-items').querySelectorAll(':scope > div').forEach(()=>feed.append(btn('Saved a journal reflection · Today',()=>{scrollJourney('jy-journal');jyJournalTab('history',q('#jy-jtab-hist'));})));
  q('#jy-study-path-list').querySelectorAll('.jy-study-path').forEach(p=>feed.append(btn(p.textContent.trim(),()=>scrollJourney('jy-study'))));
  if(!feed.children.length)feed.append(el('p','','Your saved reflections and study paths will appear here.'));
 };
 new MutationObserver(updateFeed).observe(q('#jy-hist-items'),{childList:true});
 new MutationObserver(updateFeed).observe(q('#jy-study-path-list'),{childList:true});updateFeed();
 root.querySelectorAll('.jy-mood-chip').forEach(n=>{n.setAttribute('aria-pressed','false');n.addEventListener('click',()=>root.querySelectorAll('.jy-mood-chip').forEach(m=>m.setAttribute('aria-pressed',String(m.classList.contains('selected')))));});
 const save=window.saveJournal;window.saveJournal=function(){save();root.querySelectorAll('.jy-mood-chip').forEach(n=>n.setAttribute('aria-pressed',String(n.classList.contains('selected'))));};
 // Local guided preview: explicit demo content, not a claim of live AI generation.
 const studyBox=el('div','jy-card'),steps=['Receive','Learn','Reflect','Apply','Connect'];
 const stepper=el('div','fmj-steps'),guidance=el('p',''),notes=el('textarea',''),next=btn('Begin learning',()=>{step=Math.min(4,step+1);renderStep();},'fmj-primary');
 let step=0;
 notes.setAttribute('aria-label','Study notes');notes.placeholder='Your notes for this study…';
 studyBox.append(el('h3','','Take the message into your week'),el('p','','Demo guided path · notes remain in this page session'),stepper,guidance,notes,next);
 const prompts=['Receive: return to the message or Scripture passage you want to explore.','Learn: what stands out, and what questions would you bring to your church leader?','Reflect: where does this connect with your everyday life?','Apply: choose one small step you can take this week.','Connect: share your questions with your group or church leadership.'];
 const renderStep=()=>{stepper.replaceChildren();steps.forEach((label,i)=>{const b=btn(label,()=>{step=i;renderStep();},'jy-btn-ghost');b.setAttribute('aria-current',i===step?'step':'false');stepper.append(b);});guidance.textContent=prompts[step];next.textContent=step===4?'Open Connect':'Continue to '+steps[step+1];next.onclick=step===4?()=>showScreen('community'):()=>{step++;renderStep();};};
 q('.jy-study-banner').after(studyBox);q('.jy-study-banner button').onclick=()=>{studyBox.scrollIntoView({block:'nearest',behavior:'smooth'});notes.focus();};renderStep();
 // Render newly entered topic text safely and accurately label the session-only demo.
 window.startJyStudy=function(topic){const title=String(topic||'').trim();if(!title)return;const row=el('div','jy-study-path');row.append(el('strong','',title),el('p','','Demo path · just started'));q('#jy-study-path-list').prepend(row);q('#jy-study-active-title').textContent=title;step=0;notes.value='';renderStep();scrollJourney('jy-study');};
 q('#jy-study-input').setAttribute('aria-label','Study topic');
 jyRenderGoals();scrollJourney('jy-journal');
})();
