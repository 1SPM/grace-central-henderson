/* Faithful Connect: retain canonical nodes, listeners and feed state. */
(() => {
 const root=document.getElementById('sec-network');if(!root)return;
 const make=(tag,cls,html)=>{const e=document.createElement(tag);e.className=cls;e.innerHTML=html;return e;};
 const img=(name)=>'../../assets/faithful-'+name+'.jpg';
 root.querySelector('.net-tabs').before(make('header','fc-heading','<h1>Connect</h1><p>Real people. A deeper sense of belonging.</p><small>Demo content</small>'));
 const flow=root.querySelector('.net-community-flow'), widgets=flow.querySelector('.net-widgets-stack');
 const main=make('div','fc-feed-column','');flow.prepend(main);
 main.append(make('section','fc-community-hero','<h2>Life together<br>at Faithful.</h2><p>A place to share, pray, and encourage one another.</p>'));
 ['#net-feed-tabs','.composer','#net-feed'].forEach(s=>{const e=flow.querySelector(s);if(e)main.append(e);});
 const care=make('section','fc-support-card','<h2>Need prayer or care?</h2><p>Find pastoral support for what is on your heart. Response times vary.</p><button type="button">Request pastoral care</button>');care.querySelector('button').onclick=()=>goSection('outreach');widgets.prepend(care);
 const guidelines=make('section','fc-support-card','<h2>Community guidelines</h2><p>Share thoughtfully, respect one another, and choose who can see your post.</p><button type="button">Read community guidelines</button>');guidelines.querySelector('button').onclick=openGuidelinesModal;care.after(guidelines);
 const groups=document.getElementById('net-groups-events');groups.querySelector('.ge-hero h2').textContent='Find your people. Make room for what matters.';
 const discover=document.getElementById('ge-discover');discover.style.display='block';
 const search=make('input','fc-group-search','');search.type='search';search.placeholder='Search groups by name';search.setAttribute('aria-label','Search discover groups');discover.querySelector('.card-head').after(search);
 const empty=make('p','fc-search-empty','No groups match your search. Try another name.');empty.hidden=true;empty.setAttribute('role','status');discover.append(empty);
 search.oninput=()=>{let count=0;discover.querySelectorAll('.group-chip').forEach(e=>{e.hidden=!e.textContent.toLowerCase().includes(search.value.trim().toLowerCase());if(!e.hidden)count++;});empty.hidden=count>0;};
 const findMore=document.querySelector('#ge-mygroups .card-link');findMore.onclick=()=>{discover.style.display='flex';discover.scrollIntoView({behavior:'smooth',block:'start'});search.focus({preventScroll:true});};
 groups.querySelectorAll('.group-chip').forEach((e,i)=>{const photo=document.createElement('img');photo.className='fc-group-photo';photo.src=img(['parenting','community','community','reflection','care'][i%5]);photo.alt='';e.prepend(photo);});
 const events=document.getElementById('net-event-list');const calendar=make('section','fc-calendar','<h3>June 2026</h3><p>Sample church calendar</p><div class="fc-calendar-grid"></div><button type="button" class="fc-calendar-reset">Show all dates</button>');events.closest('.card').prepend(calendar);
 const grid=calendar.querySelector('.fc-calendar-grid');['S','M','T','W','T','F','S'].forEach(d=>grid.append(make('span','fc-weekday',d)));grid.append(make('span','',''));
 for(let day=1;day<=30;day++){const b=make('button','',String(day));b.type='button';b.setAttribute('aria-label','June '+day+', 2026');const has=[...events.querySelectorAll('.event-date-day')].some(e=>Number(e.textContent)===day);b.disabled=!has;if(has)b.classList.add('has-events');b.onclick=()=>{calendar.querySelectorAll('[aria-pressed]').forEach(e=>e.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');events.querySelectorAll('.event-row').forEach(e=>e.style.display=Number(e.querySelector('.event-date-day')?.textContent)===day?'':'none');};grid.append(b);}
 calendar.querySelector('.fc-calendar-reset').onclick=()=>{events.querySelectorAll('.event-row').forEach(e=>e.style.display='');calendar.querySelectorAll('[aria-pressed]').forEach(e=>e.setAttribute('aria-pressed','false'));};
 const originalFilter=window.filterNetEvents;
 window.filterNetEvents=function(cat,el){calendar.querySelectorAll('[aria-pressed]').forEach(e=>e.setAttribute('aria-pressed','false'));return originalFilter(cat,el);};
 calendar.querySelectorAll('.has-events').forEach(b=>{b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{groups.querySelectorAll('.event-filter-pill').forEach(e=>e.classList.toggle('active',e.textContent.trim()==='All'));});});
 const people=document.getElementById('net-people');people.querySelector('.net-section-head h3').textContent='Faith Moments';
 people.querySelector('.net-section-head span').textContent='The people and moments that make us church.';
 people.querySelector('.net-wall-create-lbl').textContent='Choose your audience before posting';people.querySelector('.net-wall-create').textContent='Share a moment';
 people.querySelector('.net-wall-create').onclick=openMomentComposer;
 const tabs=[...root.querySelectorAll('.net-tab')];root.querySelector('.net-tabs').setAttribute('role','tablist');
 const syncTabs=()=>tabs.forEach(t=>{const selected=t.classList.contains('active');t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;});
 tabs.forEach((t,i)=>{t.setAttribute('role','tab');t.id='fc-tab-'+t.dataset.net;t.setAttribute('aria-controls','net-'+t.dataset.net);const panel=document.getElementById('net-'+t.dataset.net);panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',t.id);t.addEventListener('keydown',e=>{let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();tabs[n].click();tabs[n].focus();});new MutationObserver(syncTabs).observe(t,{attributes:true,attributeFilter:['class']});});syncTabs();
 const photoMap={grouplife:'community',worship:'worship-hero',serve:'food-pantry',milestones:'parenting'};
 people.querySelectorAll('.net-wall-card').forEach(e=>{const photo=e.querySelector('.net-wall-img-wrap img');if(photo&&photoMap[e.dataset.wallCat])photo.src=img(photoMap[e.dataset.wallCat]);});
 people.append(make('footer','fc-footer','<h2>Different people. One church family.</h2>'));
})();
