/* Reuse the portal's own GRACE duotone icons; no remote image dependency. */
(() => {
  function addIcon(target,name){
    if(!target||target.querySelector(':scope > .fg-icon')||typeof window.graceIcon!=='function')return;
    const icon=document.createElement('span');icon.className='fg-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=window.graceIcon(name,{size:23});target.prepend(icon);
  }
  function finish(){
    document.querySelectorAll('.fp-connection,.fi-disclosure').forEach(guide=>{
      const text=guide.querySelector(':scope > summary')?.textContent||'';
      const name=/reflection/i.test(text)?'bible':/card/i.test(text)?'card':/spending/i.test(text)?'dollar':/church can help/i.test(text)?'prayer':/connect/i.test(text)?'groups':'home';
      addIcon(guide.querySelector(':scope > summary'),name);
      guide.querySelectorAll('.fp-page-guide>section').forEach(section=>{const heading=section.querySelector('h3')?.textContent||'';addIcon(section,/people|leaders/i.test(heading)?'groups':/thought/i.test(heading)?'journal':/message|teaching/i.test(heading)?'bible':/support/i.test(heading)?'prayer':/choosing|ready/i.test(heading)?'shield':/conversation/i.test(heading)?'chat':'calendar');});
    });
  }
  finish();
  const observer=new MutationObserver(finish);observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
