/* Reuse existing Settings and profile content; no duplicate profile state. */
(() => {
  const mobile=!!document.getElementById('screen-home');
  const settings=document.getElementById((mobile?'screen-':'sec-')+'destination-settings');
  const grid=settings?.querySelector('.fd-grid'),profile=document.querySelector('[data-member-profile]');
  if(!grid||!profile)return;
  const cards=Array.from(grid.children);grid.replaceChildren();grid.classList.add('settings-tab-content');
  const nav=document.createElement('div');nav.className='settings-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Settings sections');grid.before(nav);
  const entries=[['profile','My profile',[profile]],['guidance','Guidance',[cards[2]]],['reading','Reading & voice',[cards[1]]],['information','Your information',[cards[3],cards[4]]]];
  const tabs=[],panels=[];
  function select(index,focus=false){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});if(focus)tabs[index].focus();}
  entries.forEach(([key,label,nodes],index)=>{
    const tab=document.createElement('button');tab.type='button';tab.id='settings-tab-'+key;tab.textContent=label;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','settings-panel-'+key);
    const panel=document.createElement('section');panel.id='settings-panel-'+key;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.tabIndex=0;
    nodes.filter(Boolean).forEach(node=>panel.append(node));
    if(key==='reading'){const note=document.createElement('p');note.textContent='Voice controls remain in GRACE and the reflection editor. A saved voice preference is not connected yet.';panel.append(note);}
    tab.onclick=()=>select(index);tab.onkeydown=e=>{let next=index;if(e.key==='ArrowRight')next=(index+1)%entries.length;else if(e.key==='ArrowLeft')next=(index+entries.length-1)%entries.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=entries.length-1;else return;e.preventDefault();select(next,true);};
    tabs.push(tab);panels.push(panel);nav.append(tab);grid.append(panel);
  });
  const open=window.openMemberDestination;
  window.openMemberDestination=key=>{if(key==='my-profile'){open('settings');select(0);window.dispatchEvent(new Event('faithful-profile-open'));tabs[0].focus();}else open(key);};
  select(0);window.dispatchEvent(new Event('faithful-profile-open'));
})();
