/* Faithful weekly demo. Deliberately no storage, telemetry, or automatic AI calls. */
(() => {
  'use strict';
  const host = document.querySelector('#jy-scroll') || document.querySelector('#sec-profile');
  if (!host) return;
  const lessons = [
    {id:'watch-sermons-0', index:0, status:'demo', title:'Part 3: The Power of Forgiveness', date:'May 18', speaker:'Pastor James Wilson', ref:'Ephesians 4:32', chapter:'Ephesians 4', url:'https://ebible.org/engwebp/EPH04.htm',
      verse:'And be kind to one another, tender hearted, forgiving each other, just as God also in Christ forgave you.',
      context:'29 Let no corrupt speech proceed out of your mouth, but only what is good for building others up as the need may be, that it may give grace to those who hear. 30 Don’t grieve the Holy Spirit of God, in whom you were sealed for the day of redemption. 31 Let all bitterness, wrath, anger, outcry, and slander be put away from you, with all malice.',
      summary:'An invitation to consider kindness and forgiveness in everyday relationships. Forgiveness does not require abandoning boundaries or returning to an unsafe situation.',
      prompts:['What stayed with you from this passage or message?','Where might kindness change your next conversation?','What question would you like to carry into the week?'],
      questions:['What does Paul connect with forgiveness in verses 29–32?','How might words build someone up without avoiding a difficult truth?'],
      actions:['Offer one specific word of encouragement','Reflect on a boundary that supports a healthy relationship']},
    {id:'watch-sermons-1', index:1, status:'demo', title:'Part 2: Serving One Another', date:'May 11', speaker:'Pastor James Wilson', ref:'Galatians 5:13', chapter:'Galatians 5', url:'https://ebible.org/engwebp/GAL05.htm',
      verse:'For you, brothers, were called for freedom. Only don’t use your freedom as an opportunity for the flesh, but through love be servants to one another.',
      context:'14 For the whole law is fulfilled in one word, in this: “You shall love your neighbor as yourself.” 15 But if you bite and devour one another, be careful that you don’t consume one another.',
      summary:'Consider what serving through love could look like in the ordinary places you already spend time. Choose something realistic for your capacity this week.',
      prompts:['What does serving through love mean in your current season?','Where have you received care from someone else?','What small act could fit your capacity this week?'],
      questions:['How does verse 13 describe the purpose of freedom?','How do verses 14–15 connect love with the way people treat one another?'],
      actions:['Offer practical help to someone you know','Thank someone who has supported you']}
  ];
  // These are staged examples, not published records. Never infer approval from a date.
  const state = {lesson:lessons[0].id, tab:'journal', personal:false, drafts:{}, entries:[], goals:[], activity:[], serial:0};
  // Desktop Watch owns its source metadata. Mobile uses the same staged Watch snapshot.
  if(typeof WATCH_STATE!=='undefined')for(const l of lessons){
    const source=WATCH_STATE.sermons[l.index];
    if(source && source.scripture?.ref===l.ref){l.title=source.title;l.speaker=source.speaker;l.date=source.date;}
  }
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lesson = () => lessons.find(l => l.id === state.lesson);
  // Only public demo lesson material crosses into chat. Never expose drafts, entries or goals.
  window.FAITHFUL_PUBLIC_LESSON = () => {
    const l=lesson();
    return {id:l.id,title:l.title,status:l.status,ref:l.ref,verse:l.verse,translation:'World English Bible',prompts:[...l.prompts]};
  };
  const key = () => state.personal ? 'personal' : state.lesson;
  const draft = () => state.drafts[key()] ||= {title:'', mood:'', text:'', edit:null};
  const log = action => state.activity.unshift({action, lesson:state.lesson, at:new Date().toLocaleTimeString()});
  const old = document.createElement('details'); old.className='wj-legacy';
  old.innerHTML='<summary>Earlier sample Journey (separate demo history)</summary><p>These existing sample records are not your session reflections or weekly progress.</p>';
  while (host.firstChild) old.append(host.firstChild);
  const root = document.createElement('section'); root.className='wj'; root.setAttribute('aria-label','Weekly Journey');
  host.append(root, old);
  // Keep the page introduction outside lesson rendering and legacy content.
  const reflectGuide=old.querySelector('[data-reflect-guide]');
  if(reflectGuide)host.prepend(reflectGuide);
  let recognition=null, voiceToken=0, transcript='', shareText='';
  const cancelVoice = () => {voiceToken++; if(recognition) recognition.abort(); recognition=null; transcript='';};
  const tabs = [['journal','Journal'],['growth','Growth'],['study','Bible Study'],['activity','Activity'],['goals','Goals']];
  const tabArt={journal:['reflection','A little space for your soul','Write a few words. Leave room for what comes next.'],growth:['growth','Notice the steps you’re taking','Your reflections and chosen actions, brought together.'],study:['reflection','Let Scripture meet your everyday life','Read slowly. Notice a word. Bring your questions.'],activity:['dawn','Moments along your journey','Return to what you have explored and put into practice.'],goals:['community','Small steps, chosen by you','Choose something meaningful and make it your own.']};
  const icons={journal:'✎',growth:'△',study:'▤',activity:'◷',goals:'⚑'};
  function render() {
    cancelVoice(); shareText=''; const l=lesson();
    // Preserve the live guide and its draft when rebuilding lesson content.
    const pageGuide=host.querySelector('[data-reflect-guide]');
    if(pageGuide)pageGuide.remove();
    root.innerHTML=`<header class="wj-heading"><h1>Reflect</h1><p>Read this week’s message and write down what stays with you.</p></header>
      <p class="wj-notice">Demo: entries clear when this page reloads. Do not enter sensitive information.</p>
      <div class="wj-week-picker"><label for="wj-week">Your weekly message</label><select id="wj-week">${lessons.filter(x=>x.status==='demo').map(x=>`<option value="${x.id}" ${x.id===l.id?'selected':''}>${esc(x.date)} · ${esc(x.title)}</option>`).join('')}</select></div>
      <section class="wj-lesson"><figure class="wj-sermon-image"><img src="../../assets/watch/ondemand-${l.index===0?'forgiveness':'serving'}.jpg" alt="${esc(l.title)} sermon artwork"><figcaption>${esc(l.date)} · ${esc(l.ref)}</figcaption></figure><div class="wj-lesson-copy">
      <span class="wj-badge">Demo lesson</span><h2>${esc(l.title)}</h2><p class="wj-speaker">${esc(l.speaker)}</p><p>${esc(l.summary)}</p>
      <div class="wj-actions"><button data-tab-action="study">Read the passage</button><button data-tab-action="journal">Reflect on this message</button></div>
      <details class="wj-source"><summary>About this lesson &amp; recording</summary><button type="button" data-act="watch">Open Watch source</button><small>Individual recording unavailable. Watch contains a general preview video. Sample materials are not a sermon transcript or staff-approved teaching.</small></details>
      ${l.id!==lessons[0].id?'<p>A newer demo week is available. <button data-act="newest">Explore May 18</button> Your earlier work stays with this message.</p>':''}</div></section>
      <nav class="wj-tabs" aria-label="Weekly Journey sections">${tabs.map(([id,label])=>`<button type="button" data-tab="${id}" aria-pressed="${state.tab===id}"><span aria-hidden="true">${icons[id]}</span>${label}</button>`).join('')}</nav>
      <div class="wj-tab-hero"><img src="../../assets/faithful-${tabArt[state.tab][0]}.jpg" alt=""><div><h2>${tabArt[state.tab][1]}</h2><p>${tabArt[state.tab][2]}</p></div></div>
      <div id="wj-panel" class="wj-panel-${state.tab}" aria-label="${tabs.find(t=>t[0]===state.tab)[1]}">${panel()}</div><p id="wj-status" role="status" aria-live="polite"></p>`;
    if(pageGuide)root.querySelector('.wj-heading').after(pageGuide);
    root.querySelector('#wj-week').onchange=e=>{state.lesson=e.target.value; render();};
    root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render();root.querySelector(`[data-tab="${state.tab}"]`).focus();});
    if(state.tab==='study'){
      const quote=root.querySelector('blockquote'),book=document.createElement('div');book.className='wj-book';
      quote.before(book);book.append(quote);const citation=document.createElement('cite');citation.textContent=l.ref+' · World English Bible';book.append(citation);
      const chapter=document.createElement('details');
      chapter.innerHTML=`<summary>Read the complete ${esc(l.chapter)} here</summary>`;
      const verses=window.FAITHFUL_WEEKLY_SCRIPTURE?.[l.chapter];
      if(verses)for(const [ref,text] of verses){const p=document.createElement('p');p.className='wj-text';const label=document.createElement('strong');label.textContent=ref+' ';p.append(label,document.createTextNode(text));chapter.append(p);}
      else{const p=document.createElement('p');p.textContent='Chapter text unavailable. Use the attributed source link.';chapter.append(p);}
      root.querySelector('#wj-panel details').after(chapter);
    }
    if(state.tab==='growth'){
      const chosen=state.goals.filter(g=>g.lesson===l.id),saved=state.entries.filter(e=>e.lesson===l.id),reviewed=state.activity.some(a=>a.lesson===l.id&&a.action==='Marked study reviewed');
      const evidence=document.createElement('section');evidence.className='wj-evidence';evidence.setAttribute('aria-label','Evidence from this session');
      evidence.innerHTML=`<h3>What you’re building this week</h3><div class="wj-evidence-grid"><div><strong>${saved.length}</strong><span>reflections saved</span><button data-tab-action="journal">${saved.length?'Return to reflections':'Write your first reflection'}</button></div><div><strong>${reviewed?'Reviewed':'Not yet'}</strong><span>passage review</span><button data-tab-action="study">Open Bible Study</button></div><div><strong>${chosen.filter(g=>g.status==='complete').length} / ${chosen.length}</strong><span>chosen actions completed</span><button data-tab-action="goals">Review your actions</button></div></div><h3>Your milestones</h3>${chosen.length?`<ul class="wj-milestones">${chosen.map(g=>`<li><span aria-hidden="true">${g.status==='complete'?'✓':g.status==='paused'?'Ⅱ':'○'}</span><div><strong>${esc(g.text)}</strong><small>${g.status==='complete'?'You marked this complete':g.status==='paused'?'Paused. Return when you are ready.':'In progress. One step at a time.'}</small></div></li>`).join('')}</ul>`:'<p>Your trail begins with a step you choose. Adopt an action in Goals to place your first milestone.</p>'}<p class="wj-evidence-note">Based only on this session, not a measure of faith or spiritual worth.</p>`;
      root.querySelector('.wj-mountain').after(evidence);
    }
    bind();
  }
  function panel() {
    const l=lesson(), d=draft(), goals=state.goals.filter(g=>g.lesson===l.id);
    if(state.tab==='journal') return `<label class="wj-check"><input id="wj-personal" type="checkbox" ${state.personal?'checked':''}> Personal reflection (not linked to a lesson)</label>
      <h2>${state.personal?'A little space for your thoughts':'Reflect on this message'}</h2>
      ${state.personal?'':`<label for="wj-prompt">Choose a starting point</label><select id="wj-prompt">${l.prompts.map(p=>`<option>${esc(p)}</option>`).join('')}</select><p>You can respond to a prompt or write freely.</p>`}
      <label for="wj-title">Title (optional)</label><input id="wj-title" maxlength="120" value="${esc(d.title)}">
      <label for="wj-mood">How are you feeling? (optional)</label><select id="wj-mood">${['','Hopeful','Grateful','Thoughtful','Uncertain','Struggling','Prefer not to say'].map(m=>`<option ${m===d.mood?'selected':''}>${m}</option>`).join('')}</select>
      <label for="wj-text">Your reflection</label><textarea id="wj-text" rows="8" maxlength="10000" placeholder="Start wherever you are…">${esc(d.text)}</textarea><small>Kept only in this open page. Saving does not send your words to GRACE or church staff.</small>
      <div class="wj-actions"><button data-act="save">${d.edit?'Save changes':'Save reflection'}</button><button data-act="dictate">Use dictation</button><button data-act="share">Ask GRACE about selected text</button></div>
      <div id="wj-voice" hidden><p>Browser speech processing may use an external service. Only start if you agree. Review the transcript before adding it.</p><button data-act="voice-start">Start dictation</button><button data-act="voice-stop">Stop</button><button data-act="voice-cancel">Cancel dictation</button><p id="wj-voice-status" role="status"></p><label for="wj-transcript">Review transcript</label><textarea id="wj-transcript"></textarea><button data-act="voice-add">Add reviewed transcript</button></div>
      <div id="wj-share" hidden><h3>Review before sharing</h3><p>Only this text will be sent to GRACE, an AI navigator. The conversation may be processed and retained separately from this session journal.</p><pre id="wj-share-text"></pre><button data-act="share-confirm">Confirm and send to GRACE</button><button data-act="share-cancel">Cancel</button></div>
      <h3>Reflections in this session</h3>${state.entries.filter(e=>e.lesson===key()).map(e=>`<article class="wj-entry"><h4>${esc(e.title||'Untitled reflection')}</h4><p>${esc(e.mood)}</p><p class="wj-text">${esc(e.text)}</p><button data-edit="${e.id}">Edit</button><button data-delete="${e.id}">Delete</button></article>`).join('')||'<p>No saved reflections for this selection yet.</p>'}<button data-act="export">Export session reflections</button>`;
    if(state.tab==='study') return `<h2>Read, then reflect</h2><h3>${esc(l.ref)}</h3><blockquote>${esc(l.verse)}</blockquote><p>World English Bible (public domain). Pinned excerpt, September 11, 2026.</p><details><summary>Surrounding verses</summary><p>${esc(l.context)}</p></details><a href="${l.url}" target="_blank" rel="noopener">Read the complete ${esc(l.chapter)} chapter at eBible.org</a><h3>Demo study questions</h3><ul>${l.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul><p>These sample questions are separate from Scripture. Any GRACE response is AI guidance, not a Bible quotation or staff-approved interpretation.</p><button data-act="studied">Mark this study reviewed</button><button data-tab-action="journal">Write a reflection</button>`;
    if(state.tab==='goals') return `<h2>One step you choose</h2><p>Suggestions are invitations. Nothing is added until you choose it.</p>${l.actions.map((a,i)=>`<p>${esc(a)} <button data-adopt="${i}" ${goals.some(g=>g.source===i)?'disabled':''}>Adopt suggestion</button></p>`).join('')}<h3>Your actions for this message</h3>${goals.map(g=>`<article class="wj-entry"><label for="goal-${g.id}">Your action</label><input id="goal-${g.id}" value="${esc(g.text)}" maxlength="240"><button data-goal-edit="${g.id}">Save action text</button><p>Status: ${g.status}</p><button data-goal-pause="${g.id}">${g.status==='paused'?'Resume':'Pause'}</button><button data-goal-complete="${g.id}">${g.status==='complete'?'Reopen':'Mark complete'}</button></article>`).join('')||'<p>No actions selected. Take your time.</p>'}`;
    if(state.tab==='activity') return `<h2>This session</h2><p>Only actions you explicitly take appear here. Opening a page does not complete a lesson.</p><ul>${state.activity.filter(a=>a.lesson===l.id).map(a=>`<li>${esc(a.action)} <small>${esc(a.at)}</small></li>`).join('')||'<li>No actions recorded for this message yet.</li>'}</ul>`;
    const done=goals.filter(g=>g.status==='complete').length, ratio=goals.length?done/goals.length:0;
    // Match the quadratic trail exactly, so the figure stays on the path.
    const t=ratio<0.5?ratio*2:(ratio-0.5)*2;
    const points=ratio<0.5?[[65,205],[180,205],[220,137]]:[[220,137],[260,69],[355,65]];
    const at=axis=>(1-t)*(1-t)*points[0][axis]+2*(1-t)*t*points[1][axis]+t*t*points[2][axis];
    const x=at(0),y=at(1)-19;
    return `<h2>Your chosen path</h2><p>Small, meaningful steps at your pace.</p><svg class="wj-mountain" viewBox="0 0 420 260" role="img" aria-labelledby="wj-mountain-title"><title id="wj-mountain-title">${done} of ${goals.length} chosen actions complete for this message</title><path d="M0 245L135 65L220 170L310 30L420 245Z" fill="#d5e4ed"/><path d="M135 65L160 100L140 95L123 103Z M310 30L340 86L312 73L288 79Z" fill="white"/><path d="M65 205Q180 205 220 137T355 65" fill="none" stroke="#597b91" stroke-width="3" stroke-dasharray="5 7"/><g transform="translate(${x} ${y})" stroke="#173755" stroke-width="4" stroke-linecap="round"><circle cy="-14" r="5" fill="#173755"/><path d="M0-6V8M-9 0L0-4L9 1M0 8L-7 19M0 8L8 19"/></g></svg><p><strong>${done} of ${goals.length} chosen actions complete.</strong> ${goals.filter(g=>g.status==='paused').length} paused.</p><p>This trail reflects your selected actions, not spiritual worth, attendance, or giving.</p><button data-tab-action="goals">Choose or update your actions</button>`;
  }
  function status(text){root.querySelector('#wj-status').textContent=text;}
  function bind(){
    const q=s=>root.querySelector(s);
    ['title','mood','text'].forEach(k=>{if(q('#wj-'+k))q('#wj-'+k).oninput=e=>{draft()[k]=e.target.value;};});
    if(q('#wj-personal'))q('#wj-personal').onchange=e=>{state.personal=e.target.checked;render();};
    root.querySelectorAll('[data-tab-action]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tabAction;render();});
    root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const e=state.entries.find(e=>e.id===+b.dataset.edit);state.drafts[key()]={...e,edit:e.id};render();});
    root.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(!confirm('Delete this session reflection?'))return;state.entries=state.entries.filter(e=>e.id!==+b.dataset.delete);if(draft().edit===+b.dataset.delete)delete state.drafts[key()];log('Deleted a reflection');render();});
    root.querySelectorAll('[data-adopt]').forEach(b=>b.onclick=()=>{const source=+b.dataset.adopt;state.goals.push({id:++state.serial,lesson:state.lesson,source,text:lesson().actions[source],status:'active'});log('Adopted an action');render();});
    ['edit','pause','complete'].forEach(action=>root.querySelectorAll(`[data-goal-${action}]`).forEach(b=>b.onclick=()=>{const g=state.goals.find(g=>g.id===+b.getAttribute('data-goal-'+action));if(action==='edit'){const text=q('#goal-'+g.id).value.trim();if(!text)return status('Enter an action before saving.');g.text=text;}else if(action==='pause')g.status=g.status==='paused'?'active':'paused';else g.status=g.status==='complete'?'active':'complete';log('Updated an action');render();}));
    root.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>act(b.dataset.act));
  }
  function act(a){
    const q=s=>root.querySelector(s), d=draft();
    if(a==='newest'){state.lesson=lessons[0].id;render();}
    if(a==='watch'){if(typeof goSection==='function'){goSection('watch');if(typeof playWatchSermon==='function')playWatchSermon(lesson().index);}else if(typeof openPush==='function')openPush('watch');}
    if(a==='save'){if(!d.text.trim())return status('Write a reflection before saving.');const entry={id:d.edit||++state.serial,lesson:key(),title:d.title,mood:d.mood,text:d.text};state.entries=state.entries.filter(e=>e.id!==entry.id);state.entries.push(entry);if(!state.personal)log('Saved a reflection');delete state.drafts[key()];render();status('Saved in this page session only.');}
    if(a==='studied'){log('Marked study reviewed');status('Study review recorded for this session.');}
    if(a==='export'){const blob=new Blob([JSON.stringify({notice:'Session demo export. This downloaded file is not encrypted. Keep it somewhere appropriate.',entries:state.entries},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='faithful-session-reflections.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Export requested. The downloaded file is not encrypted.');}
    if(a==='share'){const t=q('#wj-text');shareText=t.value.slice(t.selectionStart,t.selectionEnd).trim();if(!shareText)return status('Select the specific words in your reflection that you want to share.');q('#wj-share-text').textContent=shareText;q('#wj-share').hidden=false;}
    if(a==='share-cancel'){shareText='';q('#wj-share').hidden=true;}
    // ask() returns false when GRACE is unmounted or still answering. Keep the
    // draft and the panel until it confirms acceptance: never report a send
    // that did not happen.
    if(a==='share-confirm'){if(!shareText)return;if(!window.GRACE_COMPANION?.ask)return status('GRACE is unavailable. Your text has not been sent.');const text=shareText;window.GRACE_COMPANION.open();if(!window.GRACE_COMPANION.ask('Please help me reflect on this text I chose to share:\n'+text))return status('GRACE is still answering. Your text has not been sent. Try again in a moment.');shareText='';q('#wj-share').hidden=true;status('Selected text sent to GRACE.');}
    if(a==='dictate'){
      q('#wj-voice').hidden=false;
      const supported=window.SpeechRecognition||window.webkitSpeechRecognition;
      const localFile=location.protocol==='file:';
      q('#wj-voice-status').textContent=localFile?'This is a file preview. Open the portal at http://127.0.0.1:3021 in Chrome to try dictation. Keep this tab open if it contains unsaved reflections.':supported?'Start dictation, then allow microphone access when your browser asks.':'This browser does not provide speech recognition. Try the served portal in Chrome, or continue typing.';
      q('[data-act="voice-start"]').disabled=!supported||localFile;
      q('[data-act="voice-stop"]').disabled=true;
      q('[data-act="voice-add"]').disabled=false;
      q('#wj-voice').scrollIntoView?.({block:'nearest'});
    }
    if(a==='voice-start'){
      if(location.protocol==='file:')return;
      cancelVoice();const C=window.SpeechRecognition||window.webkitSpeechRecognition;if(!C)return;const token=voiceToken;recognition=new C();recognition.continuous=true;recognition.interimResults=false;recognition.lang=document.documentElement.lang||'en-US';
      let failed=false;
      const controls=running=>{q('[data-act="voice-start"]').disabled=running;q('[data-act="voice-stop"]').disabled=!running;q('[data-act="voice-add"]').disabled=running;};
      q('#wj-transcript').value='';
      recognition.onresult=e=>{if(token!==voiceToken)return;for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)transcript+=e.results[i][0].transcript+' ';q('#wj-transcript').value=transcript;};
      recognition.onstart=()=>{if(token===voiceToken)q('#wj-voice-status').textContent='Listening. Speak naturally, then select Stop.';};
      recognition.onerror=event=>{if(token!==voiceToken)return;failed=true;controls(false);const messages={'not-allowed':'Microphone permission denied. Allow microphone access in browser site settings and macOS Privacy & Security, then retry.','service-not-allowed':'Speech recognition is blocked by this browser. Try the served portal in Chrome.','audio-capture':'No microphone is available. Check your microphone connection and system input settings.','network':'The speech service could not connect. Check your connection, then retry or type.','no-speech':'No speech was detected. Try again and speak after the Listening message.','aborted':'Dictation stopped. Your reflection has not changed.'};q('#wj-voice-status').textContent=messages[event?.error]||'Dictation failed. Try again or continue typing.';};
      recognition.onend=()=>{if(token!==voiceToken)return;controls(false);if(!failed)q('#wj-voice-status').textContent=transcript.trim()?'Stopped. Review the transcript, then choose Add reviewed transcript.':'Stopped without a transcript. Try again or continue typing.';};
      try{controls(true);q('#wj-voice-status').textContent='Requesting microphone access…';recognition.start();}catch(e){failed=true;controls(false);q('#wj-voice-status').textContent='Could not start dictation. Check browser microphone permissions or continue typing.';}
    }
    if(a==='voice-stop')recognition?.stop();
    if(a==='voice-cancel'){cancelVoice();q('#wj-transcript').value='';q('#wj-voice').hidden=true;status('Dictation cancelled. Nothing added.');}
    if(a==='voice-add'){const text=q('#wj-transcript').value.trim();if(!text)return status('There is no transcript to add.');d.text+=(d.text?'\n':'')+text;render();status('Reviewed transcript added. Save when ready.');}
  }
  window.addEventListener('pagehide',cancelVoice);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelVoice();});
  // Account transitions discard this in-memory demo rather than exposing a prior user's work.
  const initialIdentity=window.Clerk?.user?.id || null;
  let identity=initialIdentity;
  if(window.Clerk?.addListener)window.Clerk.addListener(({user})=>{
    const next=user?.id||null;if(next===identity)return;identity=next;
    cancelVoice();state.drafts={};state.entries=[];state.goals=[];state.activity=[];render();
    status('Account changed. Previous session reflections and goals have been cleared.');
  });
  const screen=host.closest('.screen,.sec');
  if(screen)new MutationObserver(()=>{
    if(!screen.classList.contains('active')&&!screen.classList.contains('on'))cancelVoice();
  }).observe(screen,{attributes:true,attributeFilter:['class']});
  function selectTab(id){
    const tab=String(id).replace(/^jy-/,'');if(!tabs.some(t=>t[0]===tab))return;
    state.tab=tab;render();host.scrollTop=0;
  }
  // Keep existing portal links pointing into this shared experience.
  if(document.querySelector('#sec-profile')){
    window.journeyTab=selectTab;
    window.startStudyFromSermon=index=>{
      const selected=lessons.find(l=>l.index===index);
      if(!selected){if(typeof pfToast==='function')pfToast('No weekly demo lesson is staged for this sermon.');return;}
      state.lesson=selected.id;state.tab='study';render();if(typeof goSection==='function')goSection('profile');
    };
  }else window.scrollJourney=selectTab;
  // No persistence or previous member history is imported into this session.
  render();
})();
