/* Preview preferences only. Never infer authenticated identity from a display name. */
(async () => {
  const mobile = !!document.getElementById('screen-home');
  const session = window.GRACE_SESSION ? await window.GRACE_SESSION.ready.catch(()=>null) : null;
  const memberId = session?.memberIdentity;
  if (!memberId && window.Clerk?.user) return; // Do not load demo preferences for an unresolved signed-in account.
  const identity = memberId ? 'member.'+encodeURIComponent(memberId) : 'demo-maya';
  const key = 'grace.preferences.faithful.'+identity+'.v1';
  const identityValid = () => memberId ? window.Clerk?.user?.id === memberId : !window.Clerk?.user;
  const context = memberId ? 'Personal preferences, saved only in this browser. These do not update church records.' : 'Demo preferences for Maya, saved only in this browser. These do not update church records.';
  let answers = {};
  try { answers = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) answers = {};
  const sections = [
    ['home',mobile?'#screen-home > .scroll':'#sec-home','How much guidance would you like?',['Explore on my own','Guide me','Help me decide']],
    ['connect',mobile?'#screen-community > .scroll':'#sec-network','What would you like to explore?',['Groups','Events','People','Help me decide']],
    ['journey',mobile?'#screen-profile > .scroll':'#sec-profile','What would you like to focus on?',['Journal','Bible study','Goals','Help me decide']]
  ];
  const mounted = [];
  function enhanceHome(details){
    details.classList.add('fp-connection');
    details.querySelector('summary').innerHTML='Explore this page <span>What you can do here, and where your story begins</span>';
    const form=details.querySelector('form');
    form.innerHTML=`<header class="fp-intro"><h2>Your church, at a glance</h2><p>My Church brings the week together: a service to watch, people to connect with, and ways to take part. Start with what matters to you.</p><div class="fp-page-guide"><section><h3>Follow the message</h3><p>Find the service from the main banner. Reflect gives you a place to return to the passage and put your thoughts into words.</p></section><section><h3>Find your people</h3><p>Explore groups and events through Connect, or get to know the leaders and care options available in the portal.</p></section><section><h3>Take part your way</h3><p>Browse volunteering, giving, and the Impact Card example. Exploring a page doesn’t commit you to anything.</p></section></div><h3>Begin with the connection you already have</h3><p>How long you’ve been here, how often you take part, and where you feel involved give your story a starting point. Add what you hope to find, and a few words of your own.</p><p>For example, someone who attends regularly but wants to meet people might explore a group. Someone returning after time away might prefer to catch up on a message first.</p><button type="button" class="fp-begin">Add my part of the story</button><p class="fp-storage">For now, your story stays in this browser. It isn’t shared with GRACE or the church team.</p></header><div class="fp-connection-layout"><div class="fp-questions"></div><aside class="fp-profile"><h3>What My Church adds to your story</h3><p class="fp-preview-label">Taking shape</p><dl></dl><h3>Room to grow</h3><p>This chapter brings together your connection, your usual rhythm, and what you’re hoping for next. As we build the guided experience, later pages will add the interests and next steps you choose.</p><p>Take a moment to read it over. You can come back and add to it as life changes.</p></aside></div><label class="fp-consent"><input type="checkbox" name="remember"> Remember my answers in this browser.</label><div class="fp-actions"><button type="submit">Keep my story</button><button type="button" data-skip>Maybe later</button><button type="button" data-clear>Forget my answers</button></div><p role="status" aria-live="polite"></p>`;
    const fields=[
      ['connection','How long have you been connected to this church?','Membership is not assumed. This helps distinguish a first introduction from an established relationship.',['Just exploring','Less than a year','1–3 years','4–10 years','More than 10 years','Returning after time away']],
      ['attendance','How often do you usually attend services?','Your usual rhythm can help shape relevant service and reflection suggestions. This is not an attendance record.',['Most weeks','A few times a month','Occasionally','Mostly online','Not currently attending','My routine varies']],
      ['engagement','How would you describe your involvement right now?','This helps us understand whether you want to discover something new or build on existing connections.',['Finding my place','Mainly attending services','Connected through a group','Serving or volunteering','Involved in several ways','Taking a quieter season']],
      ['importance','What place do church services have in your life?','Understanding their importance helps keep suggestions aligned with what you value.',['A central part of my week','Important, though I cannot always attend','Meaningful when I can take part','Still discovering what they mean to me','I connect with church in other ways']],
      ['support','What would make this space useful to you?','Choose a starting point. You can change direction any time.',['Following the weekly message','Meeting people','Finding ways to serve','Building a reflection habit','Exploring at my own pace','Help me decide']],
      ['guidance','How much guidance would you like?','You control the pace, including choosing no prompts.',['Explore on my own','Guide me','Help me decide']]
    ];
    const participation=[form.querySelector('.fp-connection-layout'),form.querySelector('.fp-consent'),form.querySelector('.fp-actions')];
    // The introduction explains the page; personal questions belong below.
    const extraHeading=form.querySelector('.fp-intro > h3');
    if(extraHeading){const first=extraHeading.nextElementSibling,second=first?.nextElementSibling;extraHeading.remove();first?.remove();second?.remove();}
    form.querySelector('.fp-begin').remove();
    form.querySelector('.fp-storage').remove();
    const guide=form.querySelector('.fp-page-guide');
    const tour=document.createElement('section');tour.className='fp-tour';
    tour.innerHTML='<button type="button" data-tour-start>Show me around</button><div data-tour-panel hidden><p class="fp-tour-position" aria-live="polite"></p><h3 tabindex="-1"></h3><p data-tour-caption></p><div class="fp-actions"><button type="button" data-tour-listen>Listen to GRACE</button><button type="button" data-tour-stop>Stop audio</button><button type="button" data-tour-next>Next</button><button type="button" data-tour-exit>Finish tour</button></div><p data-tour-status role="status"></p><small>Optional AI narration. You can read every step without audio.</small></div>';
    guide.before(tour);
    const tourSteps=[
      ['Follow the message','Start with the service at the top of My Church. When you want to spend more time with a passage, Reflect gives you a place to read and write.','#home-live-pill, .dash-hero, .home-hero'],
      ['Find your people','The groups, events, and care links help you find a next step with your church. You can look around without joining or sending a request.','#home-leader-strip, .home-leader-strip'],
      ['Choose your next step','The five pathways bring together growth, resources, care, community, and engagement. Follow what matters to you today.','.dash-mod'],
      ['Begin your story','A little about your connection helps give this experience context. Add what feels useful, in your own words. You can review everything before keeping it.',null]
    ];
    let tourIndex=0,highlight=null,narrationVersion=0;
    const panel=tour.querySelector('[data-tour-panel]');
    const tourStatus=tour.querySelector('[data-tour-status]');
    function stopTourAudio(){narrationVersion++;window.GRACE_COMPANION?.stopNarration?.();tour.classList.remove('fp-speaking');tour.querySelector('[data-tour-listen]').disabled=false;}
    function showTour(){stopTourAudio();highlight?.classList.remove('fp-tour-highlight');const [title,caption,selector]=tourSteps[tourIndex];panel.hidden=false;tour.querySelector('[data-tour-start]').hidden=true;tour.querySelector('h3').textContent=title;tour.querySelector('[data-tour-caption]').textContent=caption;tour.querySelector('.fp-tour-position').textContent='Step '+(tourIndex+1)+' of '+tourSteps.length;tour.querySelector('[data-tour-next]').textContent=tourIndex===3?'Add my story':'Next';tourStatus.textContent='';highlight=selector?document.querySelector(selector):null;highlight?.classList.add('fp-tour-highlight');tour.querySelector('h3').focus();}
    function endTour(){stopTourAudio();highlight?.classList.remove('fp-tour-highlight');panel.hidden=true;tour.querySelector('[data-tour-start]').hidden=false;}
    tour.querySelector('[data-tour-start]').onclick=()=>{tourIndex=0;showTour();};
    tour.querySelector('[data-tour-next]').onclick=()=>{if(tourIndex<3){tourIndex++;showTour();}else{endTour();setStoryOpen(true);form.querySelector('legend').focus();}};
    tour.querySelector('[data-tour-exit]').onclick=()=>{endTour();tour.querySelector('[data-tour-start]').focus();};
    tour.querySelector('[data-tour-stop]').onclick=()=>{stopTourAudio();tourStatus.textContent='Audio stopped.';};
    tour.querySelector('[data-tour-listen]').onclick=()=>{
      stopTourAudio();const version=narrationVersion,listen=tour.querySelector('[data-tour-listen]');
      listen.disabled=true;tourStatus.textContent='Preparing audio…';
      const accepted=window.GRACE_COMPANION?.narratePage?.(tourSteps[tourIndex][1],()=>{
        if(version!==narrationVersion)return;
        tour.classList.add('fp-speaking');tourStatus.textContent='Speaking';
      },()=>{
        if(version!==narrationVersion)return;
        tour.classList.remove('fp-speaking');listen.disabled=false;tourStatus.textContent='Audio finished.';
      });
      if(!accepted){listen.disabled=false;tourStatus.textContent='Audio is unavailable right now. You can read this step and continue.';}
    };
    details.addEventListener('toggle',()=>{if(!details.open)endTour();});
    window.addEventListener('pagehide',endTour);
    participation.forEach(el=>el.hidden=true);
    const storyBar=document.createElement('div');storyBar.className='fp-story-bar';
    storyBar.innerHTML='<h3>Let us know</h3><div><button type="button" data-story-toggle aria-expanded="false" aria-controls="fp-story-fields">Open</button><button type="button" data-story-skip>Skip this part</button></div>';
    participation[0].id='fp-story-fields';participation[0].before(storyBar);
    const storyInvitation=document.createElement('p');
    storyInvitation.innerHTML='<em>Share some of your story here.</em>';
    storyBar.after(storyInvitation);
    const storyToggle=storyBar.querySelector('[data-story-toggle]');
    function setStoryOpen(open){participation.forEach(el=>el.hidden=!open);storyToggle.textContent=open?'Close':'Open';storyToggle.setAttribute('aria-expanded',String(open));}
    storyToggle.onclick=()=>setStoryOpen(storyToggle.getAttribute('aria-expanded')!=='true');
    storyBar.querySelector('[data-story-skip]').onclick=()=>{restore();setStoryOpen(false);status.textContent='Skipped. Previously saved answers are unchanged.';storyToggle.focus();};
    const inputs={};const questions=form.querySelector('.fp-questions');
    fields.splice(0,fields.length,
      ['connection','My connection to church','For example: part of this church for five years'],
      ['engagement','How I take part','For example: most Sundays, and a small group'],
      ['support','What I’m hoping to find','For example: a place to volunteer or meet people']);
    const invitation=document.createElement('p');invitation.textContent='A little about you, in your own words. What brings you here, and what would you like to explore? Share as much or as little as you like.';questions.append(invitation);
    const blocks=[];
    fields.forEach(([id,title,help,options],index)=>{
      const block=document.createElement('fieldset');block.className='fp-question';blocks.push(block);
      const label=document.createElement('legend');label.textContent=title;label.tabIndex=-1;
      const hint=document.createElement('p');hint.id='fp-help-'+id;hint.textContent=help;
      block.append(label);
      const input=document.createElement('textarea');input.name=id;input.rows=3;input.maxLength=400;input.placeholder=help;input.setAttribute('aria-label',title);input.oninput=()=>preview();
      block.append(input);questions.append(block);inputs[id]=input;
      const suggestions={connection:['New to the church','Less than a year','1–3 years','More than 3 years','Returning after time away'],engagement:['Services','A small group','Volunteering','Online community'],support:['Meet people','Explore Scripture','Find a way to serve','Help finding a starting point']}[id];
      if(id==='connection'){
        const select=document.createElement('select');select.setAttribute('aria-label','Choose a church connection');select.innerHTML='<option value="">Choose a starting point (optional)</option>';suggestions.forEach(value=>select.add(new Option(value,value)));select.onchange=()=>{if(select.value){const parts=input.value.split('; ').filter(part=>part&&!suggestions.includes(part));parts.unshift(select.value);const next=parts.join('; ');if(next.length<=400)input.value=next;else status.textContent='Please shorten your note before adding an option.';preview();}select.value='';};input.before(select);
      }else{
        const picks=document.createElement('div');picks.className='fp-choices';suggestions.forEach(value=>{const option=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.dataset.quickField=id;check.value=value;option.append(check,document.createTextNode(value));check.onchange=()=>{const parts=input.value.split('; ').filter(Boolean).filter(part=>part!==value);if(check.checked)parts.push(value);const next=parts.join('; ');if(next.length<=400)input.value=next;else status.textContent='Please shorten your note before adding an option.';preview();};picks.append(option);});input.before(picks);
      }
      input.rows=2;input.placeholder='Add or adjust in your own words (optional)';
    });
    const noteLabel=document.createElement('label');noteLabel.htmlFor='fp-home-thoughts';noteLabel.textContent='Anything else you’d like us to know?';
    const noteHint=document.createElement('p');noteHint.textContent='A hope, a question, something on your mind. A few words in your own voice are enough.';
    const thoughts=document.createElement('textarea');thoughts.id=noteLabel.htmlFor;thoughts.name='thoughts';thoughts.maxLength=1200;thoughts.rows=4;thoughts.placeholder='I’m here because… / I’d love to…';
    const note=document.createElement('div');note.className='fp-story-note';note.append(noteLabel,noteHint,thoughts);questions.append(note);
    thoughts.oninput=()=>preview();
    const status=form.querySelector('[role=status]');const saved=()=>answers.homeConnection||{};
    function preview(isSaved=false){
      form.querySelectorAll('[data-quick-field]').forEach(check=>check.checked=inputs[check.dataset.quickField].value.split('; ').includes(check.value));
      const dl=form.querySelector('dl');dl.replaceChildren();let count=0;
      const captions=fields.map(f=>f[1]);
      fields.forEach(([id],i)=>{if(!inputs[id].value)return;count++;const dt=document.createElement('dt');dt.textContent=captions[i];const dd=document.createElement('dd');dd.textContent=inputs[id].value;dl.append(dt,dd);});
      if(thoughts.value.trim()){count++;const dt=document.createElement('dt');dt.textContent='In my own words';const dd=document.createElement('dd');dd.textContent=thoughts.value.trim();dl.append(dt,dd);}
      if(!count){const p=document.createElement('p');p.textContent='Your story starts wherever you are. As you answer, the pieces will come together here.';dl.append(p);}
      form.querySelector('.fp-preview-label').textContent=isSaved?'Kept for next time':'Taking shape';
    }
    function restore(){fields.forEach(([id])=>{inputs[id].value=saved()[id]||(id==='guidance'?answers.home:'')||'';});thoughts.value=typeof saved().thoughts==='string'?saved().thoughts:'';form.elements.remember.checked=!!answers.homeConnection;form.querySelectorAll('[data-quick-field]').forEach(check=>check.checked=inputs[check.dataset.quickField].value.split('; ').includes(check.value));preview(!!answers.homeConnection);}
    restore();form.onchange=()=>preview();
    form.onsubmit=e=>{e.preventDefault();if(!identityValid()){status.textContent='Your account changed. Reload before saving.';return;}if(!form.elements.remember.checked){status.textContent='Choose browser storage above to save, or skip without saving.';return;}
      const profile=Object.fromEntries(fields.filter(([id])=>inputs[id].value.trim()).map(([id])=>[id,inputs[id].value.trim().slice(0,400)]));
      if(thoughts.value.trim())profile.thoughts=thoughts.value.trim().slice(0,1200);
      if(!Object.keys(profile).length){status.textContent='Choose an answer, or skip. Use Forget my answers to remove an earlier profile.';return;}
      const next={...answers,homeConnection:{...saved(),...profile}};fields.forEach(([id])=>{if(!profile[id])delete next.homeConnection[id];});if(!profile.thoughts)delete next.homeConnection.thoughts;
      try{localStorage.setItem(key,JSON.stringify(next));answers=next;preview(true);status.textContent='Your answers are saved here for next time. You can change them whenever you like.';}catch(_){status.textContent='Could not save. Your choices are still shown, but browser storage is unavailable.';}
    };
    form.querySelector('[data-skip]').onclick=()=>{restore();setStoryOpen(false);storyToggle.focus();};
    form.querySelector('[data-clear]').onclick=()=>{if(!identityValid()){status.textContent='Your account changed. Reload before clearing.';return;}const next={...answers};delete next.homeConnection;delete next.home;try{localStorage.setItem(key,JSON.stringify(next));answers=next;restore();status.textContent='Saved connection answers cleared from this browser.';}catch(_){status.textContent='Could not clear browser storage. Saved answers may remain.';}};
  }
  function enhanceConnect(details){
    details.classList.add('fp-connection');
    details.innerHTML='<summary>Explore ways to connect</summary><div class="fcg-intro"><h2>Find your place, at your pace.</h2><p>Catch up with your church community, find a group, or discover something to attend. Start with people you know or explore a new connection.</p><div class="fp-page-guide"><section><h3>Find your people</h3><p>Explore groups around shared interests and the stage of life you’re in.</p></section><section><h3>Make room for something new</h3><p>Browse events and see what fits your week before choosing to take part.</p></section><section><h3>Stay in the conversation</h3><p>Read community updates, share encouragement, or simply listen in.</p></section></div><div class="fp-story-bar"><h3>Let us know</h3><div><button type="button" data-connect-open aria-expanded="false" aria-controls="fp-connect-story">Open</button><button type="button" data-connect-skip>Skip this part</button></div></div><section id="fp-connect-story" hidden><p>A little about the connections you have and the ones you’d like to make.</p><label for="fp-connect-existing">Where are you already connected?</label><textarea id="fp-connect-existing" rows="2" maxlength="600" placeholder="A group, a team, familiar faces, or still finding your way…"></textarea><fieldset data-connect-interests><legend>What would you enjoy exploring?</legend><div class="fw-kyc-stack"></div></fieldset><fieldset data-connect-pace><legend>How would you like to begin?</legend><div class="fp-actions"></div></fieldset><label for="fp-connect-thoughts">Anything that would help you feel more at home?</label><textarea id="fp-connect-thoughts" rows="2" maxlength="800" placeholder="A smaller group, an easier time to meet, or a thought of your own…"></textarea><p><small>Optional notes for this open page. Nothing is posted, sent, or joined.</small></p></section></div>';
    const story=details.querySelector('#fp-connect-story'),toggle=details.querySelector('[data-connect-open]');
    const invitation=document.createElement('p');invitation.innerHTML='<em>Tell us how you’d like to connect.</em>';details.querySelector('.fp-story-bar').after(invitation);
    ['Groups & shared interests','Events & gatherings','Serving with others'].forEach(value=>{const label=document.createElement('label');label.className='fw-kyc-choice';const input=document.createElement('input');input.type='checkbox';input.value=value;input.name='connect-interest';const text=document.createElement('span');text.textContent=value;label.append(input,text);story.querySelector('[data-connect-interests] > div').append(label);});
    ['Explore on my own','Help me find a starting point','Build on connections I have'].forEach(value=>{const label=document.createElement('label');const input=document.createElement('input');input.type='radio';input.name='connect-pace';input.value=value;label.append(input,document.createTextNode(' '+value));story.querySelector('[data-connect-pace] > div').append(label);});
    function setOpen(open){story.hidden=!open;toggle.textContent=open?'Close':'Open';toggle.setAttribute('aria-expanded',String(open));}
    toggle.onclick=()=>setOpen(story.hidden);
    details.querySelector('[data-connect-skip]').onclick=()=>{story.querySelectorAll('textarea').forEach(input=>input.value='');story.querySelectorAll('input').forEach(input=>input.checked=false);setOpen(false);toggle.focus();};
  }
  function enhanceReflect(details){
    details.classList.add('fp-connection');details.dataset.reflectGuide='';
    details.innerHTML='<summary>Explore what reflection can bring to your week</summary><div class="fcg-intro"><h2>A little space to make it your own.</h2><p>Return to a message, spend time with a passage, or put a thought into words. You don’t have to have heard the sermon to begin.</p><div class="fp-page-guide"><section><h3>Return to the message</h3><p>Choose a weekly lesson and explore its Scripture and study questions.</p></section><section><h3>Make room for your thoughts</h3><p>Use Journal to reflect on the lesson, or choose a personal reflection.</p></section><section><h3>Choose one next step</h3><p>Set a goal that matters to you. Growth and Activity show the steps you choose and take, not a score for your faith.</p></section></div><div class="fp-story-bar"><h3>Let us know</h3><div><button type="button" data-reflect-open aria-expanded="false" aria-controls="fp-reflect-story">Open</button><button type="button" data-reflect-skip>Skip this part</button></div></div><section id="fp-reflect-story" hidden><p>What would help you make time for reflection?</p><fieldset><legend>I’d like to explore</legend><div class="fw-kyc-stack" data-reflect-interests></div></fieldset><label for="fp-reflect-rhythm">What might fit into your week?</label><textarea id="fp-reflect-rhythm" rows="2" maxlength="400" placeholder="A few minutes after the message, a quiet morning, or whenever I have time…"></textarea><label for="fp-reflect-help">What would make getting started easier?</label><textarea id="fp-reflect-help" rows="2" maxlength="600" placeholder="A question to begin with, help finding a passage, or space to write on my own…"></textarea><p><small>These optional preferences stay in this open page, separate from your journal. Nothing is sent to GRACE or the church. Demo journal entries also clear on reload.</small></p></section></div>';
    const story=details.querySelector('#fp-reflect-story'),toggle=details.querySelector('[data-reflect-open]');
    const invitation=document.createElement('p');invitation.innerHTML='<em>Share what helps you reflect and grow.</em>';details.querySelector('.fp-story-bar').after(invitation);
    ['Reflecting on the weekly message','Writing in my journal','Exploring Scripture','Choosing a personal goal'].forEach(value=>{const label=document.createElement('label');label.className='fw-kyc-choice';const input=document.createElement('input');input.type='checkbox';input.value=value;input.name='reflect-interest';label.append(input,document.createTextNode(value));story.querySelector('[data-reflect-interests]').append(label);});
    function setOpen(open){story.hidden=!open;toggle.textContent=open?'Close':'Open';toggle.setAttribute('aria-expanded',String(open));}
    toggle.onclick=()=>setOpen(story.hidden);
    details.querySelector('[data-reflect-skip]').onclick=()=>{story.querySelectorAll('textarea').forEach(input=>input.value='');story.querySelectorAll('input').forEach(input=>input.checked=false);setOpen(false);toggle.focus();};
  }
  sections.forEach(([id,selector,question,options])=>{
    const host=document.querySelector(selector);if(!host)return;
    const details=document.createElement('details');details.className='fp-preferences';
    details.innerHTML='<summary>Make this useful for you</summary><form><p>Demo preferences for Maya, saved only in this browser. These do not update church records.</p><label></label><select><option value="">Choose an option</option></select><div class="fp-actions"><button type="submit">Save preference</button><button type="button" data-skip>Skip</button><button type="button" data-clear>Clear preference</button></div><p role="status" aria-live="polite"></p></form>';
    details.querySelector('form > p').textContent=context;
    const field=details.querySelector('select');field.id='fp-'+id;
    const label=details.querySelector('label');label.htmlFor=field.id;label.textContent=question;
    options.forEach(value=>field.add(new Option(value,value)));
    field.value=options.includes(answers[id])?answers[id]:'';
    const status=details.querySelector('[role=status]');
    details.querySelector('form').onsubmit=event=>{event.preventDefault();if(!identityValid()){status.textContent='Your account changed. Reload before saving preferences.';return;}if(!field.value){status.textContent='Choose an option, or skip for now.';return;}const next={...answers,[id]:field.value};try{localStorage.setItem(key,JSON.stringify(next));answers=next;status.textContent=memberId?'Saved in this browser for your account.':'Saved in this browser for the Maya demo.';}catch(_){status.textContent='Could not save. Browser storage may be unavailable.';}};
    details.querySelector('[data-skip]').onclick=()=>{field.value=options.includes(answers[id])?answers[id]:'';details.open=false;details.querySelector('summary').focus();};
    details.querySelector('[data-clear]').onclick=()=>{if(!identityValid()){status.textContent='Your account changed. Reload before changing preferences.';return;}const next={...answers};delete next[id];try{localStorage.setItem(key,JSON.stringify(next));answers=next;field.value='';status.textContent='Preference cleared.';}catch(_){status.textContent='Could not clear saved preferences. Browser storage may be unavailable.';}};
    const footer=host.querySelector(':scope > .fd-footer');
    if(id==='home'){
      const pathways=host.querySelector(':scope > .dash-mod');
      host.insertBefore(details,pathways || footer);
      details.style.order='1';
    }else if(id==='connect'){
      const heading=host.querySelector(':scope > .fc-heading');
      if(heading)heading.after(details);else host.prepend(details);
    }else if(id==='journey'){
      const heading=host.querySelector('.wj-heading');
      if(heading)heading.after(details);else host.prepend(details);
    }
    else host.insertBefore(details,footer);
    mounted.push(details);
    if(id==='home')enhanceHome(details);
    if(id==='connect')enhanceConnect(details);
    if(id==='journey')enhanceReflect(details);
    details.querySelector('summary').textContent={home:'Your church, at a glance',connect:'Find your people',journey:'Bring the message into your week'}[id];
  });
  // Read-only snapshot for the later dialogue connection. No automatic AI transmission.
  window.FAITHFUL_PREVIEW_PREFERENCES={get:()=>identityValid()?({...answers}):{},identity,sections:mounted.length};
})();
