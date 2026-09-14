/* Reuse the portal's own GRACE duotone icons; no remote image dependency. */
(() => {
  function addIcon(target,name){
    if(!target||target.querySelector(':scope > .fg-icon')||typeof window.graceIcon!=='function')return;
    const icon=document.createElement('span');icon.className='fg-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=window.graceIcon(name,{size:23});target.prepend(icon);
  }
  function finish(){
    document.querySelectorAll('.fp-connection,.fi-disclosure').forEach(guide=>{
      const summary=guide.querySelector(':scope > summary');
      if(!summary)return;
      const text=summary.textContent||'';
      const spec=/message|reflection/i.test(text)?['bible','Reflect on the message and make room for your own thoughts.']
        :/card/i.test(text)?['card','How the card works, what to expect, and getting ready to apply.']
        :/spending|impact/i.test(text)?['dollar','See how everyday purchases could support a cause you care about.']
        :/church can help|leadership/i.test(text)?['prayer','Meet your leaders, explore teachings, and find personal support.']
        :/connect|find your people/i.test(text)?['groups','Groups, events, and ways to build connections in your church.']
        :['home','Services, people, and ways to take part.'];
      const existingIcon=summary.querySelector(':scope > .fg-icon');
      if(existingIcon && summary.dataset.guideIcon!==spec[0])existingIcon.remove();
      addIcon(summary,spec[0]);summary.dataset.guideIcon=spec[0];
      let subline=summary.querySelector(':scope > .fh-guide-subline');
      if(!subline){subline=document.createElement('small');subline.className='fh-guide-subline';summary.append(subline);}
      if(subline.textContent!==spec[1])subline.textContent=spec[1];
      guide.querySelectorAll('.fp-page-guide>section').forEach(section=>{const heading=section.querySelector('h3')?.textContent||'';addIcon(section,/people|leaders/i.test(heading)?'groups':/thought/i.test(heading)?'journal':/message|teaching/i.test(heading)?'bible':/support/i.test(heading)?'prayer':/choosing|ready/i.test(heading)?'shield':/conversation/i.test(heading)?'chat':'calendar');});
    });
  }
  finish();
  const observer=new MutationObserver(finish);observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
