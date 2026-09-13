/* Educational care walkthrough. No requests, appointments, or personal data are saved. */
(() => {
  const mobile=!!document.getElementById('screen-home');
  const host=document.querySelector(mobile?'#screen-leaders > .scroll':'#sec-ai');
  if(!host)return;
  const guide=document.createElement('details');guide.className='fp-preferences';
  guide.innerHTML=`<summary>How your church can support you</summary><form>
    <p>Explore ways to find practical help, encouragement, or someone to listen. Support depends on the church’s available services; outcomes and response times vary.</p>
    <p><strong>Prayer & encouragement:</strong> request prayer or a pastoral conversation.<br><strong>Grief & life changes:</strong> ask about support through loss or a difficult transition.<br><strong>Practical needs:</strong> explore food support or a hospital visit.<br><strong>Relationships & family:</strong> ask about pastoral guidance or appropriate referrals.</p>
    <p>This walkthrough uses sample choices only. Please do not enter personal or medical details. Nothing here is sent or saved.</p>
    <label for="fcg-connection">Are you already connected with church support?</label><select id="fcg-connection"><option value="">Choose or skip</option><option>I already have someone at church I speak with</option><option>I would like help finding someone</option><option>I’m exploring for someone else</option><option>I’m just learning about the options</option><option>Prefer not to say</option></select>
    <label for="fcg-topic">Which example would you like to explore?</label><select id="fcg-topic"><option>Prayer & encouragement</option><option>Grief & life changes</option><option>Practical needs</option><option>Relationships & family</option><option>Help me decide</option></select>
    <label for="fcg-support">What kind of support would be useful?</label><select id="fcg-support"><option>Information about available support</option><option>An initial conversation</option><option>Ask about ongoing support</option><option>I’m not sure yet</option></select>
    <div class="fp-actions"><button type="submit">Preview a care request</button><button type="button" data-skip>Skip for now</button><button type="reset">Reset example</button></div>
    <section data-preview hidden aria-live="polite"><h3>Example only. No request has been sent.</h3><p data-summary></p><ol><li><strong>Review your request.</strong> In a connected service, you would choose what to share and confirm how the church may contact you.</li><li><strong>Care-team review.</strong> A person would review the request and identify an appropriate next step, subject to availability.</li><li><strong>Agree on a next step.</strong> This might be a conversation, practical resource, or referral. An appointment is not confirmed until agreed with the team.</li></ol><p>This demonstrates a proposed process, not a confirmed church workflow. A leader’s AI avatar is not a live pastor and does not appoint a care worker.</p></section>
    <p><strong>Need urgent help?</strong> This guide is not monitored and is not an emergency service.</p><div class="fp-actions"><button type="button" data-urgent>Open emergency resources</button></div>
    </form>`;
  const form=guide.querySelector('form');
  form.innerHTML='<p>See what a first step could look like. Nothing is sent.</p><fieldset><legend>Where would you like to begin?</legend><div class="fp-actions" data-care-choices></div></fieldset><section data-preview hidden aria-live="polite"><h3 data-example-title></h3><p data-summary></p><p>A church team member would review what you choose to share and discuss an available next step with you. This is an example, not a booked appointment.</p><button type="button" data-add-interest>Add this interest to my story</button><p data-added role="status"></p></section><div class="fp-actions"><button type="button" data-skip>Close example</button><button type="reset">Start again</button></div><p>This guide is not monitored. <button type="button" data-urgent>Emergency resources</button></p>';
  const preview=form.querySelector('[data-preview]');
  guide.querySelector('summary').textContent='How your church can help';
  const intro=document.createElement('section');intro.className='fcg-intro';
  intro.innerHTML='<h2>People to turn to</h2><p>Meet the leaders represented here, explore their teachings, and find a way to connect with the church team.</p><div class="fp-page-guide"><section><h3>Meet your leaders</h3><p>Open a profile to learn about their role and the material available to explore.</p></section><section><h3>Explore a teaching</h3><p>An AI avatar can help explore available teachings. It is not a live conversation with the pastor.</p></section><section><h3>Find human support</h3><p>Look at care options when you want encouragement, practical help, or a conversation with a person.</p></section></div><div class="fp-story-bar"><h3>Let us know</h3><div><button type="button" data-open aria-expanded="false" aria-controls="fcg-story">Open</button><button type="button" data-story-skip>Skip this part</button></div></div>';
  form.before(intro);
  const story=document.createElement('section');story.id='fcg-story';story.hidden=true;
  story.innerHTML='<p>You may already have someone to turn to, or simply want to know where to begin.</p><div class="fp-questions"></div><p><small>Optional. Your answers stay in this open page; no care request is sent. Please leave private care details out of this demo.</small></p>';
  [['Who do you turn to at church?','Someone you know, a team you’re connected with, or “still finding my way.”'],['Where could the church make a difference for you?','Prayer, encouragement, practical support, or knowing who to ask. Would you use this now, later, or just like to understand it?']].forEach(([title,placeholder],index)=>{const field=document.createElement('fieldset');field.className='fp-question';const legend=document.createElement('legend');legend.textContent=title;const input=document.createElement('textarea');input.rows=3;input.maxLength=600;input.placeholder=placeholder;input.dataset.storyAnswer=String(index);input.setAttribute('aria-label',title);field.append(legend,input);story.querySelector('.fp-questions').append(field);});
  story.querySelector('[data-story-answer="0"]').placeholder='A pastor you already know, a group leader, a church team, or “still finding my way.”';
  const connectionChoice=document.createElement('select');connectionChoice.setAttribute('aria-label','My existing church connection');connectionChoice.innerHTML='<option value="">Choose a starting point (optional)</option><option>I already know a pastor</option><option>I know a group or ministry leader</option><option>I would like help finding someone</option><option>I’m just exploring</option>';
  story.querySelector('[data-story-answer="0"]').before(connectionChoice);
  const choiceStatus=document.createElement('p');choiceStatus.setAttribute('role','status');story.append(choiceStatus);
  function addChoice(input,value){if(!value||input.value.split('\n').includes(value))return;const next=[input.value.trim(),value].filter(Boolean).join('\n');if(next.length<=600){input.value=next;choiceStatus.textContent='';}else choiceStatus.textContent='Please shorten your note before adding an option.';}
  connectionChoice.onchange=()=>{addChoice(story.querySelector('[data-story-answer="0"]'),connectionChoice.value);connectionChoice.value='';};
  const supportChoices=document.createElement('div');supportChoices.className='fp-actions';
  ['Prayer & encouragement','Someone to talk to','Practical support','Help me decide'].forEach(value=>{const button=document.createElement('button');button.type='button';button.textContent=value;button.onclick=()=>addChoice(story.querySelector('[data-story-answer="1"]'),value);supportChoices.append(button);});
  story.querySelector('[data-story-answer="1"]').before(supportChoices);
  intro.append(story);guide.classList.add('fp-connection');
  const open=intro.querySelector('[data-open]');function setOpen(value){story.hidden=!value;open.textContent=value?'Close':'Open';open.setAttribute('aria-expanded',String(value));}
  open.onclick=()=>setOpen(story.hidden);
  intro.querySelector('[data-story-skip]').onclick=()=>{story.querySelectorAll('textarea').forEach(f=>f.value='');setOpen(false);open.focus();};
  // Keep the existing care demonstration, separate from the page introduction.
  const example=document.createElement('section');example.className='fcg-example';example.setAttribute('aria-label','Care request example');story.append(example);example.append(form);
  const invitation=document.createElement('p');invitation.textContent='See how a care request could work';intro.querySelector('.fp-story-bar').after(invitation);
  let selectedInterest='';
  const suggestions=document.createElement('section');suggestions.setAttribute('data-leader-suggestion','');suggestions.hidden=true;preview.append(suggestions);
  function suggestLeader(topic){
    suggestions.replaceChildren();suggestions.hidden=false;
    const roster=mobile?(typeof leaders!=='undefined'?leaders:[]):(typeof aiLeaders!=='undefined'?aiLeaders:[]);
    const tags=({'Prayer & encouragement':['Prayer','Intercession'],'Someone to talk to':['Counselling','Guidance'],'Relationships & family':['Marriage','Parenting','Family'],'Grief & loss':['Grief'],'Practical support':[]})[topic]||[];
    const matches=roster.map((leader,index)=>({leader,index,tag:(leader.specialties||[]).find(tag=>tags.includes(tag))})).filter(item=>item.tag);
    const heading=document.createElement('h4');heading.textContent='A connection to explore';suggestions.append(heading);
    const explanation=document.createElement('p');
    if(!matches.length){explanation.textContent='The care team would be a starting point to ask about available help. This demo has no confirmed specialist match for this option.';suggestions.append(explanation);return;}
    const match=matches[0];explanation.textContent='Demo suggestion: '+match.leader.name+'. Their profile lists '+match.tag.toLowerCase()+'. This is a starting point, not an assignment or confirmation of availability.';suggestions.append(explanation);
    const areas=document.createElement('details');areas.setAttribute('data-support-areas','');
    const areaHeading=document.createElement('summary');areaHeading.textContent='See areas of support';areas.append(areaHeading);
    const areaList=document.createElement('ul');(match.leader.specialties||[]).forEach(specialty=>{const item=document.createElement('li');item.textContent=specialty;areaList.append(item);});areas.append(areaList);
    const areaNote=document.createElement('small');areaNote.textContent='From this demo profile. Confirm available support with the church.';areas.append(areaNote);suggestions.append(areas);
    const existing=story.querySelector('[data-story-answer="0"]').value.trim();
    const preference=document.createElement('p');preference.textContent=existing?'You’ve noted an existing connection above. You can stay with that person; this is simply another profile to explore.':'Already know someone on the team? You can name them in your story instead.';suggestions.append(preference);
    const button=document.createElement('button');button.type='button';button.textContent='Explore '+match.leader.name+'’s profile';button.onclick=()=>{if(typeof window.openLeaderProfile==='function')window.openLeaderProfile(match.index);else explanation.textContent='The profile is unavailable here. Your draft is unchanged.';};suggestions.append(button);
    const choose=document.createElement('button');choose.type='button';choose.setAttribute('data-note-leader','');choose.textContent='Note my interest in this leader';
    const choiceStatus=document.createElement('p');choiceStatus.setAttribute('role','status');
    choose.onclick=()=>{
      const input=story.querySelector('[data-story-answer="0"]');
      const addition='I’d like to explore connecting with '+match.leader.name+'.';
      if(!input.value.includes(addition)){
        const updated=[input.value.trim(),addition].filter(Boolean).join('\n');
        if(updated.length>input.maxLength){choiceStatus.textContent='Your note is full. Edit it above before adding more.';return;}
        input.value=updated;
      }
      setOpen(true);choiceStatus.textContent='Added to your draft above. No contact request has been sent.';
    };suggestions.append(choose,choiceStatus);
    const note=document.createElement('small');note.textContent='Opening a profile does not share your notes or request contact.';suggestions.append(note);
  }
  const examples=[['Prayer & encouragement','You could ask who to contact for prayer or an encouraging conversation.'],['Someone to talk to','You could ask about an initial pastoral conversation, without sharing your whole situation here.'],['Practical support','You could ask what practical support or local referrals the church offers.'],['Help finding a starting point','You could ask the team to explain the available options before deciding.']];
  examples.splice(2,0,['Relationships & family','You could explore who offers support for relationships, parenting, or a family transition.'],['Grief & loss','You could ask about someone to speak with after a loss, at your own pace.']);
  examples.forEach(([title,text])=>{const button=document.createElement('button');button.type='button';button.textContent=title;button.setAttribute('aria-pressed','false');button.onclick=()=>{selectedInterest=title;form.querySelectorAll('[data-care-choices] button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));form.querySelector('[data-example-title]').textContent=title;form.querySelector('[data-summary]').textContent=text;form.querySelector('[data-added]').textContent='';preview.hidden=false;suggestLeader(title);};form.querySelector('[data-care-choices]').append(button);});
  form.querySelector('[data-add-interest]').onclick=()=>{if(!selectedInterest)return;const input=story.querySelector('[data-story-answer="1"]');const addition='I’d like to understand the options for '+selectedInterest.toLowerCase()+'.';if(!input.value.includes(addition)){if((input.value+'\n'+addition).length>input.maxLength){form.querySelector('[data-added]').textContent='Your note is full. You can edit it above before adding more.';return;}input.value=[input.value.trim(),addition].filter(Boolean).join('\n');}setOpen(true);form.querySelector('[data-added]').textContent='Added to your draft above. Nothing has been sent.';};
  form.onsubmit=event=>event.preventDefault();
  form.onreset=()=>{selectedInterest='';preview.hidden=true;form.querySelectorAll('[data-care-choices] button').forEach(b=>b.setAttribute('aria-pressed','false'));form.querySelector('[data-summary]').textContent='';form.querySelector('[data-added]').textContent='';};
  guide.querySelector('[data-skip]').onclick=()=>{form.reset();setOpen(false);open.focus();};
  guide.querySelector('[data-urgent]').onclick=()=>openCrisisSupport();
  const heading=host.querySelector(':scope > .mobile-leadership-heading');
  if(heading)heading.after(guide);else host.prepend(guide);
})();
