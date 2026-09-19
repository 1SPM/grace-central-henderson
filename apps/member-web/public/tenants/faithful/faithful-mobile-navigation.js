(() => {
 // Preserve each action while giving header controls keyboard access and names.
 document.querySelectorAll('.screen > .home-nav .nav-btn,.screen > .nav .nav-btn').forEach(control=>{
   control.setAttribute('role','button');control.tabIndex=0;
   const action=control.getAttribute('onclick')||'';
   const label=action.includes('Crisis')?'Emergency resources':action.includes('Social')?'Community notifications':action.includes('Impact')?'Impact notifications':action.includes('Goals')?'Open goals':control.title||'Leader video call preview';
   control.setAttribute('aria-label',label);
   control.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();control.click();}});
 });
 // Emergency help remains a clearly labeled action in the care content.
 const care=document.querySelector('#screen-care > .home-nav .home-nav-actions');
 if(care){care.replaceChildren();const help=document.createElement('button');help.type='button';help.className='btn soft';help.textContent='Emergency resources';help.onclick=()=>openCrisisSupport();document.querySelector('#screen-care > .scroll')?.prepend(help);}
 const drawer=document.getElementById('app-drawer');if(!drawer)return;
 const close=document.createElement('button');close.type='button';close.className='fmn-close';close.textContent='×';close.setAttribute('aria-label','Close menu');close.onclick=()=>closeAppMenu();drawer.querySelector('.drawer-head').append(close);
 drawer.querySelector('.drawer-logo').alt='Faithful Church';
 // The drawer is for going somewhere. It opened with a 32px "Menu" heading and
 // an "Ask GRACE" block, which together pushed the first destination 220px
 // down a panel that is obviously the menu. GRACE has its own place now -- the
 // bar docked above the tabs on Home (faithful-mobile-finish.js) -- so here it
 // was a second, quieter door to the same thing. Removed rather than hidden so
 // the companion does not bind an orb nobody can see.
 drawer.querySelector('.drawer-head-title')?.remove();
 drawer.querySelector('#drawer-grace')?.remove();
 // Sign Out joins Settings in the bar pinned under the list: the two account
 // actions together, apart from the places you can go. It also gives the
 // crisis card the height it needs -- with Sign Out in the scroll, the card's
 // button sat half under the Settings bar. faithful-destinations.js appends
 // Settings to the drawer later; the stylesheet lays the two out side by side.
 const signOut=drawer.querySelector('.drawer-signout');
 if(signOut){
   const before=signOut.previousElementSibling;
   if(before?.classList.contains('drawer-divider'))before.remove();
   drawer.append(signOut);
 }
 const labels={home:'My Church',leaders:'My Leadership',give:'GRACE Impact Card'};
 Object.entries(labels).forEach(([key,label])=>{drawer.querySelector(`[data-drawer-tab="${key}"]`).lastElementChild.textContent=label;});
 const nav=drawer.querySelector('.drawer-nav');['home','leaders','care','give','community','profile'].forEach(key=>nav.append(drawer.querySelector(`[data-drawer-tab="${key}"]`)));
 const bar=document.querySelector('.tabbar');bar.setAttribute('role','navigation');bar.setAttribute('aria-label','Primary navigation');
 const app=drawer.closest('.app');let wasOpen=false,returnFocus=null;
 const sync=()=>{const open=app.classList.contains('menu-open');bar.inert=open;drawer.inert=!open;bar.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-current',b.classList.contains('active')?'page':'false'));if(open&&!wasOpen){returnFocus=document.activeElement;close.focus();}if(!open&&wasOpen&&returnFocus?.isConnected)returnFocus.focus();wasOpen=open;};
 new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['class']});
 new MutationObserver(sync).observe(bar,{subtree:true,attributes:true,attributeFilter:['class']});sync();
 drawer.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const nodes=[...drawer.querySelectorAll('button,[tabindex="0"],a[href]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
})();
