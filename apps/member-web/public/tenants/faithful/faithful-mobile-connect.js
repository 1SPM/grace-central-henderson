/* Mobile Connect presentation. Existing feeds and actions remain canonical. */
(() => {
 const root=document.getElementById('screen-community');
 const make=(tag,cls,html)=>{const e=document.createElement(tag);e.className=cls;e.innerHTML=html;return e;};
 root.querySelector('#cn-tabs').before(make('header','fmc-heading','<h1>Connect</h1><p>The people and the care of your church family.</p><small>Demo content</small>'));
 const community=document.getElementById('cn-panel-community');community.prepend(make('section','fmc-hero','<h2>Life together<br>at Faithful.</h2>'));
 const care=make('section','fmc-care','<h2>Need prayer or care?</h2><p>Find support from your church. Response times vary.</p><button type="button">Request pastoral care</button>');care.querySelector('button').onclick=()=>showScreen('care');community.append(care);
 const photoAction=community.querySelector('.cn-composer-actions button:last-child');photoAction.onclick=openFaithMomentCreate;
 const groups=document.getElementById('cn-panel-groups-events');groups.querySelector('.cn-ge-hero h2').textContent='Find your people.';
 const demoNote=make('p','fmc-demo-note','Group opening, discovery, and event creation are demo previews.');groups.querySelector('.cn-ge-hero').after(demoNote);
 groups.querySelectorAll('.cn-group-row').forEach((e,i)=>{const photo=make('img','fmc-group-photo','');photo.src='../../assets/faithful-'+(i===0?'parenting':'community')+'.jpg';photo.alt='';e.prepend(photo);});
 const people=document.getElementById('cn-panel-people');const hero=people.querySelector('.cn-fm-hero');hero.querySelector('p').textContent='The people and moments that make us church.';
 const share=make('button','fmc-share','+ Share a moment');share.type='button';share.onclick=openFaithMomentCreate;hero.append(share);
 hero.append(make('p','fmc-privacy','Choose your audience before posting.'));
 const filters=document.getElementById('cn-wall-filters');hero.after(filters);
 const tabs=[...root.querySelectorAll('.cn-tab')];root.querySelector('#cn-tabs').setAttribute('role','tablist');
 const syncTabs=()=>tabs.forEach(t=>{const active=t.classList.contains('active');t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;});
 tabs.forEach((t,i)=>{t.setAttribute('role','tab');t.id='fmc-tab-'+t.dataset.cn;t.setAttribute('aria-controls','cn-panel-'+t.dataset.cn);const panel=document.getElementById('cn-panel-'+t.dataset.cn);panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',t.id);t.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;tabs[n].click();tabs[n].focus();});new MutationObserver(syncTabs).observe(t,{attributes:true,attributeFilter:['class']});});syncTabs();
 [community,groups,people].forEach(panel=>panel.append(make('footer','fmc-footer','<h2>Different people.<br>One church family.</h2>')));
})();
