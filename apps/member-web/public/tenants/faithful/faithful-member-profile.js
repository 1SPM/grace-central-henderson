/* Shared profile view. Demo/session data only; no account or remote writes. */
(() => {
  const host=document.querySelector('[data-member-profile]');if(!host)return;
  const maya={kind:'maya-sample',preferredName:'Maya',story:{
    church:['I’ve been part of Faithful Church for about five years.','I usually attend on Sundays and catch up online when I’m away.','The message and the people help me feel connected throughout the week.'],
    leadership:['I know Pastor James through Sunday services.','I’d welcome encouragement, prayer, and help finding the right person when I have a question.'],
    wallet:['I’d like to understand how the card could support causes I care about.','Before applying, I’d want to understand the costs, identity checks, and provider requirements.'],
    connect:['I’m part of two groups and enjoy getting to know people in smaller gatherings.','I’d like to hear about occasional opportunities to serve with others.'],
    reflect:['I like returning to the weekly message and reading the passages again.','A short reflection prompt helps me get started.','I’d like to choose one practical step to try during the week.'],
    impact:['Food support and youth programs are causes I’d like to explore.','I shop for groceries regularly and sometimes buy fuel and meals out.','I’d like to see an illustration before deciding whether the program fits me.'],
    guidance:['Offer a little guidance when I ask.','Let me explore at my own pace and help me decide when I’m unsure.']
  }};
  let active=maya;
  const labels={church:'My Church',leadership:'My Leadership',wallet:'Wallet',connect:'Connect',reflect:'Reflect',impact:'Impact',guidance:'Guidance preferences'};
  function render(){
    const title=active.preferredName+'’s profile';
    const page=host.closest('.fd-destination');
    const tabbed=!!host.closest('[role="tabpanel"]');
    const heading=page?.querySelector('h1');if(heading&&!tabbed)heading.textContent=title;
    const mobileHeading=page?.querySelector('.fd-top>span');if(mobileHeading&&!tabbed)mobileHeading.textContent=title;
    if(!tabbed&&page?.classList.contains('active')){const top=document.getElementById('tb-title');if(top)top.textContent=title;}
    host.replaceChildren();
    if(tabbed){const titleNode=document.createElement('h2');titleNode.textContent=title;host.append(titleNode);}else{const back=document.createElement('button');back.type='button';back.className='fd-button fd-secondary';back.textContent='Back to Settings';back.onclick=()=>window.openMemberDestination('settings');host.append(back);}
    const note=document.createElement('p');note.textContent=active===maya?'Maya’s sample profile. Changes last only in this open page.':'Your demo profile. Changes last only in this open page; no account has been registered.';host.append(note);
    const form=document.createElement('form'),label=document.createElement('label'),name=document.createElement('input');label.textContent='Preferred name';name.value=active.preferredName;name.maxLength=80;name.required=true;label.append(name);form.append(label);
    const fields={};for(const [key,title]of Object.entries(labels)){const field=document.createElement('label'),input=document.createElement('textarea');field.textContent=title;input.rows=2;input.maxLength=1200;input.value=(active.story[key]||[]).join('\n');input.placeholder='Add when you’re ready';fields[key]=input;field.append(input);form.append(field);}
    const save=document.createElement('button');save.type='submit';save.className='fd-button';save.textContent='Save changes';const status=document.createElement('p');status.setAttribute('role','status');
    form.onsubmit=e=>{e.preventDefault();if(!name.value.trim()){status.textContent='Add a preferred name.';return;}active.preferredName=name.value.trim();for(const [key,input]of Object.entries(fields))active.story[key]=input.value.split('\n').map(s=>s.trim()).filter(Boolean);status.textContent='Changes kept for this open page.';};
    form.append(save,status);host.append(form);
    if(active===maya){
      const history=document.createElement('section');history.className='member-sample-history';
      const heading=document.createElement('h2');heading.textContent='How Maya’s story grew';
      const intro=document.createElement('p');intro.textContent='Illustrative history: these are staged examples, not recorded activity.';
      const timeline=document.createElement('ol');
      for(const [when,detail]of [
        ['When she joined the platform','Shared her preferred name and existing connection to Faithful Church.'],
        ['Getting connected','Added that she participates in two groups and prefers smaller gatherings.'],
        ['Finding her rhythm','Chose short reflection prompts and guidance when she asks for it.'],
        ['Exploring Impact','Noted interest in food support and youth programs. No card application or approval is represented.'],
        ['Returning to her profile','Reviewed her interests and left room to add more as her church life changes.']
      ]){const item=document.createElement('li'),label=document.createElement('strong'),text=document.createElement('p');label.textContent=when;text.textContent=detail;item.append(label,text);timeline.append(item);}
      history.append(heading,intro,timeline);host.append(history);
    }
    const boundary=document.createElement('p');boundary.textContent='These are self-described preferences, not verified church roles or financial approval. Journal entries and care records stay separate. Photo upload and cross-device saving are not connected yet.';host.append(boundary);
  }
  window.addEventListener('faithful-profile-open',render);
  window.openFaithfulMemberProfile=profile=>{if(profile?.kind==='visitor-demo')active=profile;window.openMemberDestination('my-profile');};
  render();
})();
