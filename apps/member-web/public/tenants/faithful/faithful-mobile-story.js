/* Visitor-only session draft. Never imports Maya's saved profile or journal. */
(() => {
  const host=document.querySelector('#sec-mobile .mobile-link-page');if(!host)return;
  const sections=[['church','My Church','#sec-home .fp-questions'],['leadership','My Leadership','#fcg-story .fp-questions'],['wallet','Wallet','[name="kyc-interest"]'],['connect','Connect','#fp-connect-story'],['reflect','Reflect','#fp-reflect-story'],['impact','Impact','[data-visitor-impact-source]']];
  const draft={},touched=new Map();let profile=null;
  function read(selector){const root=document.querySelector(selector);if(!root)return [];
    const nodes=root.matches('input')?document.querySelectorAll('[name="kyc-interest"]'):root.querySelectorAll('textarea,input,select');
    return Array.from(nodes).filter(el=>touched.has(el)).filter(el=>el.matches('select')?touched.get(el):el.matches('textarea')?el.value.trim():el.checked).map(el=>el.matches('select')?touched.get(el):el.value.trim()).filter(Boolean);
  }
  // Only a visitor's interaction in this open page marks an answer as theirs.
  function capture(event){for(const [key,,selector] of sections){if(event.target.matches?.(selector)||event.target.closest?.(selector)){touched.set(event.target,event.target.matches('select')?event.target.value:true);setTimeout(()=>{draft[key]=read(selector);profile=null;renderStory();},0);}}}
  document.addEventListener('input',capture,true);document.addEventListener('change',capture,true);
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('button');if(!button)return;
    if(button.matches('[data-skip]')&&button.closest('details')?.querySelector('#fw-story')){delete draft.wallet;document.querySelectorAll('[name="kyc-interest"]').forEach(el=>touched.delete(el));profile=null;renderStory();return;}
    const clearing=[['church','#sec-home [data-story-skip],#sec-home [data-skip],#sec-home [data-clear]'],['leadership','[data-story-skip]'],['wallet','#fw-story [data-skip],.fw-guide [data-skip]'],['connect','[data-connect-skip]'],['reflect','[data-reflect-skip]']].find(([,selector])=>button.matches(selector));
    if(clearing){const [key]=clearing;delete draft[key];const selector=sections.find(row=>row[0]===key)[2];for(const element of touched.keys())if(element.matches(selector)||element.closest(selector))touched.delete(element);profile=null;renderStory();return;}
    if(button.closest('#fcg-story')){const notes=Array.from(document.querySelectorAll('#fcg-story .fp-questions textarea'));const before=notes.map(el=>el.value);setTimeout(()=>{notes.forEach((el,i)=>{if(el.value!==before[i])touched.set(el,true);});draft.leadership=read('#fcg-story .fp-questions');profile=null;renderStory();},0);}
  },true);
  const intro=host.querySelector('.mobile-link-intro');intro.querySelector('.mobile-link-desc').textContent='Explore Maya’s mobile experience, then make room for your own story.';
  const tags=intro.querySelector('.mobile-link-tags');tags.replaceChildren();tags.setAttribute('aria-label','Choose a mobile demo page');
  const preview=host.querySelector('.mobile-link-preview');preview.replaceChildren();
  const phone=document.createElement('iframe');phone.title='Interactive Faithful mobile demo for Maya';phone.className='visitor-phone';phone.src='grace_faithful_church_members_card_ios_app.html?embed=1&tour=1#home';preview.append(phone);
  for(const [label,route] of [['My Church','home'],['Wallet','give'],['Connect','community'],['Reflect','profile']]){const b=document.createElement('button');b.type='button';b.className='mobile-link-tag';b.textContent=label;b.setAttribute('aria-pressed',String(route==='home'));b.onclick=()=>{phone.src='grace_faithful_church_members_card_ios_app.html?embed=1&tour=1#'+route;tags.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};tags.append(b);}
  const side=host.querySelector('.mobile-share-panel');side.replaceChildren();
  side.innerHTML='<h2>Your story so far</h2><p>Only answers you share during this visit appear here. You can edit them before continuing.</p><div data-visitor-story></div><button type="button" data-refresh>Update from my answers</button><hr><h3>Create your account</h3><p>Take your story with you.</p><p>Bring together what you’ve shared, and choose what you’d like to carry forward.</p><button type="button" data-continue>Continue with my story</button><section data-signup hidden><h3>Make it yours</h3><label>Your preferred name<input maxlength="80" data-name autocomplete="given-name"></label><label><input type="checkbox" data-confirm> Use the answers shown above for my demo profile.</label><button type="button" data-create>Create demo profile</button></section><p role="status" aria-live="polite"></p><small>Demo only: no account is registered and nothing is transferred to a phone. This visitor draft clears when you reload. Photos can be added later.</small>';
  const list=side.querySelector('[data-visitor-story]'),status=side.querySelector('[role=status]');
  side.querySelector('h2 + p').textContent='Here’s what you’ve shared during this visit. You can add or change your answers in the next step.';
  const sublines={church:'Your church life, day by day.',leadership:'People to turn to.',wallet:'Explore how everyday spending could give back.',connect:'Find your people.',reflect:'Make the message part of your week.',impact:'See what your everyday choices could support.'};
  function renderStory(){list.replaceChildren();for(const [key,label] of sections){const article=document.createElement('article'),title=document.createElement('h3'),subline=document.createElement('small'),text=document.createElement('p'),edit=document.createElement('button');title.textContent=label;subline.className='visitor-story-subline';subline.textContent=sublines[key];text.textContent=draft[key]?.join(' · ')||'Not shared yet';edit.type='button';edit.textContent=draft[key]?.length?'Edit':'Add more';edit.onclick=()=>{const input=document.createElement('textarea');input.maxLength=1200;input.rows=3;input.setAttribute('aria-label',label+' story');input.value=(draft[key]||[]).join('\n');const save=document.createElement('button');save.type='button';save.textContent='Keep changes';save.onclick=()=>{draft[key]=input.value.split('\n').map(v=>v.trim()).filter(Boolean);profile=null;renderStory();};article.replaceChildren(title,subline,input,save);};article.append(title,subline,text,edit);list.append(article);}}
  side.querySelector('[data-refresh]').onclick=()=>{for(const [key,,selector]of sections)if(key!=='impact'&&Object.hasOwn(draft,key))draft[key]=read(selector);const impact=window.FAITHFUL_IMPACT_DRAFT?.getReviewed();if(impact){draft.impact=['Demo impact estimate',impact.cause||'No cause selected',...(impact.merchants||[]).map(x=>typeof x==='string'?x:JSON.stringify(x)),...Object.entries(impact.monthlySpendingCents||{}).filter(([,v])=>v!==null).map(([k,v])=>`${k}: $${(v/100).toFixed(2)} per month`)];}else delete draft.impact;profile=null;renderStory();status.textContent='Updated from the sections you used this visit and any reviewed impact estimate.';};
  const signup=side.querySelector('[data-signup]');
  signup.className='visitor-signup';signup.setAttribute('aria-label','Create your account');
  signup.innerHTML='<button type="button" data-back>Back to your story</button><p class="visitor-signup-note">Demo walkthrough · no account is registered or transferred. Your answers stay in this page until reload.</p><h2 tabindex="-1">Create your account</h2><p>Take the next step with the story you’ve started.</p><form><label for="visitor-preferred-name">Your preferred name</label><input id="visitor-preferred-name" maxlength="80" data-name autocomplete="given-name" required><p>You can add a photo later.</p><label><input type="checkbox" data-confirm required> Carry my reviewed story into my profile.</label><button type="submit" data-create>Continue</button></form><p role="status" aria-live="polite"></p>';
  host.after(signup);
  const storyAnchor=document.createComment('Story position on Mobile');list.before(storyAnchor);
  const signupStory=document.createElement('section');signupStory.setAttribute('aria-label','Your story so far');
  const storyHeading=document.createElement('h3');storyHeading.textContent='Your story so far';
  const storyIntro=document.createElement('p');storyIntro.textContent='Here’s what you’ve shared. Add a little more or adjust anything before continuing.';
  signupStory.className='visitor-signup-story';signupStory.append(storyHeading,storyIntro);
  signup.querySelector('[data-confirm]').closest('label').before(signupStory);
  const signupStatus=signup.querySelector('[role=status]');
  signup.querySelector('[data-back]').textContent='Back to Mobile';
  side.querySelector('[data-continue]').textContent='Make it yours';
  const pageTitle=document.getElementById('tb-title');
  side.querySelector('[data-continue]').onclick=()=>{signupStory.append(list);host.hidden=true;signup.hidden=false;signupStatus.textContent='';if(pageTitle)pageTitle.textContent='Create your account';signup.querySelector('h2').focus();};
  const topContinue=document.createElement('button');topContinue.type='button';topContinue.dataset.topContinue='';topContinue.textContent='Make it yours';topContinue.onclick=()=>side.querySelector('[data-continue]').click();side.querySelector('h2 + p').after(topContinue);
  const repeatHeading=side.querySelector(':scope > h3');
  if(repeatHeading){for(let i=0;i<2;i++){const paragraph=repeatHeading.nextElementSibling;if(paragraph?.tagName==='P')paragraph.remove();}repeatHeading.remove();}
  signup.querySelector('[data-back]').onclick=()=>{storyAnchor.after(list);signup.hidden=true;host.hidden=false;if(pageTitle)pageTitle.textContent='Mobile';side.querySelector('[data-continue]').focus();};
  signup.querySelector('form').onsubmit=event=>{event.preventDefault();const name=signup.querySelector('[data-name]').value.trim();if(!name||!signup.querySelector('[data-confirm]').checked){signupStatus.textContent='Add your preferred name and confirm your story to continue.';return;}profile={kind:'visitor-demo',preferredName:name,story:JSON.parse(JSON.stringify(draft))};if(window.openFaithfulMemberProfile)window.openFaithfulMemberProfile(profile);else signupStatus.textContent='Your story is prepared. The profile view is unavailable; your answers remain here.';};
  window.FAITHFUL_VISITOR_STORY={getProfile:()=>profile?JSON.parse(JSON.stringify(profile)):null};renderStory();
})();
