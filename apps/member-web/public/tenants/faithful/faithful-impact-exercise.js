/* Pilot illustration, isolated from account history and card allocation. */
(function () {
  'use strict';
  const mobile = !!document.getElementById('screen-home');
  const host = document.getElementById(mobile ? 'gv-panel-impact' : 'wlt-impact');
  if (!host) return;
  const panel = document.createElement('section');
  panel.className = 'fi-exercise';
  panel.id = 'impact-exercise';
  panel.innerHTML = `<header><span class="fi-label">Interactive demo</span><h2 tabindex="-1">Everyday spending. A cause you care about.</h2><p>Explore how everyday purchases could support a cause you care about. Add a little about your routine when you’re ready.</p></header>
    <p class="fi-notice">Explore with a sample 1% contribution. These are estimates, not donations; actual rates and eligible purchases are not yet established.</p>
    <div class="fi-layout"><form novalidate><label for="fi-cause">A cause you care about</label><select id="fi-cause"><optgroup label="Care in our community"><option>Food pantry & meals</option><option>Family & community care</option><option>Housing & emergency relief</option><option>Seniors & home visits</option></optgroup><optgroup label="The next generation"><option>Children’s ministry</option><option>Youth & student ministry</option><option>Education & school supplies</option></optgroup><optgroup label="Church life & outreach"><option>Missions & local outreach</option><option>Church facilities & accessibility</option><option>Where help is needed most</option></optgroup></select><small>Sample causes to explore, not confirmed church funds.</small>
    <fieldset><legend>Estimated monthly spending ($)</legend><label for="fi-groceries">Groceries</label><input id="fi-groceries" type="number" min="0" max="100000" step="0.01" inputmode="decimal" placeholder="0"><label for="fi-fuel">Fuel & transport</label><input id="fi-fuel" type="number" min="0" max="100000" step="0.01" inputmode="decimal" placeholder="0"><label for="fi-other">Other everyday spending</label><input id="fi-other" type="number" min="0" max="100000" step="0.01" inputmode="decimal" placeholder="0"></fieldset>
    <p id="fi-error" role="alert" hidden>Use amounts from $0 to $100,000, with no more than two decimal places.</p><button type="reset">Start again</button><p class="fi-footnote">Just exploring: estimates stay on this page and clear when you reload. Nothing is sent or added to your profile.</p></form>
    <div class="fi-results"><h3>What that could add up to</h3><p id="fi-summary" role="status" aria-live="polite" aria-atomic="true"></p><div class="fi-chart" role="img" aria-label="Illustrative monthly impact by spending category"><div><span>Groceries</span><i><b data-fi-bar="0"></b></i><output data-fi-value="0"></output></div><div><span>Fuel & transport</span><i><b data-fi-bar="1"></b></i><output data-fi-value="1"></output></div><div><span>Other</span><i><b data-fi-bar="2"></b></i><output data-fi-value="2"></output></div></div><details class="fi-formula"><summary>How this estimate works</summary><p>Each spending category is multiplied by the sample 1% rate and rounded to the nearest cent. Those amounts are added together. Changing the cause doesn’t change the total.</p></details><p>Try a different amount to see how the estimate changes.</p></div></div>`;
  const disclosure = document.createElement('details');
  disclosure.className = 'fi-disclosure';
  const entry = document.createElement('summary');
  entry.textContent = 'See what your spending could support';
  disclosure.append(entry,panel);
  host.prepend(disclosure);
  const inputs = [...panel.querySelectorAll('input')];
  // Shopping examples are discovery choices, not a participating-merchant
  // registry. Never inherit demo routing state or call payment controls here.
  const draftSection=document.createElement('section');draftSection.className='fi-draft';
  draftSection.innerHTML='<h3>Where do you usually shop?</h3><p>Select any places or shopping categories you’ve used in the past year. A general picture is enough; no receipts or purchase details needed.</p><fieldset><legend>Places I have shopped at in the last year.</legend><div class="fi-merchant-choices"></div></fieldset><small>These selections describe your routine, not active card settings or confirmed merchant offers. The estimate above uses a sample 1%; selecting a place doesn’t change it.</small><div class="fi-draft-actions"><button type="button" data-review-impact>Review my Impact draft</button><button type="button" data-clear-impact>Clear draft</button></div><p data-draft-status role="status"></p><section data-impact-review hidden><h4>Your choices</h4><p data-impact-review-text></p><p>This review stays in this open page. Mobile transfer is not connected yet.</p></section>';
  panel.append(draftSection);
  draftSection.querySelector('h3').remove();
  draftSection.querySelector('small').textContent='These choices describe your routine, not active card settings or merchant offers. Selecting a place doesn’t change the sample 1% estimate.';
  draftSection.querySelector('[data-impact-review]').remove();
  draftSection.querySelector('[data-review-impact]').textContent='Keep these choices for now';
  const storyBar=document.createElement('div');storyBar.className='fp-story-bar';
  storyBar.innerHTML='<div class="fi-story-heading"><h3>Let us know</h3><p class="fi-story-hint"><em>Give us a general idea of your spending habits.</em></p></div><div class="fi-story-controls"><button type="button" data-impact-open aria-expanded="false" aria-controls="fi-story">Open</button><button type="button" data-impact-skip>Skip this part</button></div>';
  const story=document.createElement('section');story.id='fi-story';story.hidden=true;
  const layout=panel.querySelector('.fi-layout');layout.before(storyBar,story);story.append(draftSection,layout);
  const form=layout.querySelector('form'),cause=panel.querySelector('#fi-cause'),causeLabel=form.querySelector('label[for="fi-cause"]'),causeNote=cause.nextElementSibling;
  const unansweredCause=document.createElement('option');unansweredCause.value='';unansweredCause.textContent='Choose a cause when you’re ready';unansweredCause.defaultSelected=true;cause.prepend(unansweredCause);cause.value='';
  form.querySelector('[type="reset"]').textContent='Reset estimates and cause';
  inputs.forEach(input=>{input.placeholder='Optional';input.setAttribute('aria-describedby','fi-error');});
  form.querySelector('fieldset').after(causeLabel,cause,causeNote);
  const actions=draftSection.querySelector('.fi-draft-actions'),statusNode=draftSection.querySelector('[data-draft-status]');
  story.append(actions,statusNode);
  const storyToggle=storyBar.querySelector('[data-impact-open]');
  function setStoryOpen(open){story.hidden=!open;storyToggle.textContent=open?'Close':'Open';storyToggle.setAttribute('aria-expanded',String(open));}
  storyToggle.onclick=()=>setStoryOpen(story.hidden);
  const choices=draftSection.querySelector('.fi-merchant-choices');
  const leisure=document.createElement('input');leisure.id='fi-leisure';leisure.type='number';leisure.min='0';leisure.max='100000';leisure.step='0.01';leisure.placeholder='Optional';leisure.inputMode='decimal';leisure.setAttribute('aria-describedby','fi-error');
  const leisureLabel=document.createElement('label');leisureLabel.htmlFor=leisure.id;leisureLabel.textContent='Leisure';form.querySelector('fieldset').append(leisureLabel,leisure);inputs.push(leisure);
  const leisureRow=document.createElement('div');leisureRow.innerHTML='<span>Leisure</span><i><b data-fi-bar="3"></b></i><output data-fi-value="3"></output>';panel.querySelector('.fi-chart').append(leisureRow);
  const categoryGroup=document.createElement('div');choices.closest('fieldset').after(categoryGroup);
  choices.className='fi-shopping-groups';
  const shoppingGroups=[
    {title:'Groceries & household essentials',hint:'Walmart, Safeway, Sobeys and more',stores:['Walmart','Safeway','Sobeys','Costco','Save-On-Foods','Superstore'],max:2500},
    {title:'Fuel & transport',hint:'Shell, Chevron, Petro-Canada and more',stores:['Shell','Chevron','Petro-Canada','Esso','Mobil','Uber','Lyft'],max:1500},
    {title:'Other everyday spending',hint:'Online shopping, pharmacy and more',stores:['Amazon','Target','Shoppers Drug Mart','London Drugs'],max:3000},
    {title:'Leisure & dining',hint:'Restaurants, coffee and entertainment',stores:['McDonald’s','Tim Hortons','Starbucks','DoorDash'],max:1500}
  ];
  const sliderPairs=[];
  shoppingGroups.forEach((group,index)=>{
    const storeGroup=document.createElement('section');storeGroup.className='fi-store-family';
    const storeHeading=document.createElement('h4');storeHeading.textContent=group.title;storeGroup.append(storeHeading);
    const details=document.createElement('section');details.className='fi-spending-row';
    const summary=document.createElement('div');summary.className='fi-spending-title';summary.innerHTML='<span><strong></strong></span><span data-category-amount>Not estimated</span>';
    summary.querySelector('strong').textContent=group.title;details.append(summary);
    const content=document.createElement('div');content.className='fi-shopping-content';
    const stores=document.createElement('div');stores.className='fi-merchant-choices';
    group.stores.forEach(name=>{const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');check.type='checkbox';check.value=name;check.dataset.choice='merchant';text.textContent=name;label.append(check,text);stores.append(label);});storeGroup.append(stores);choices.append(storeGroup);
    const help=document.createElement('p');help.id='fi-month-help-'+index;help.textContent='Monthly total for this category.';content.append(help);
    const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max=String(group.max);slider.step='25';slider.value='0';slider.className='fi-spend-slider';slider.setAttribute('aria-label',group.title+' monthly spending');slider.setAttribute('aria-describedby',help.id);slider.setAttribute('aria-valuetext','Not estimated. Adjust to enter a monthly amount.');content.append(slider);
    slider.defaultValue='0';
    const endpoints=document.createElement('div');endpoints.className='fi-slider-scale';endpoints.textContent='$0–$'+group.max.toLocaleString('en-US')+' / month · Or type any amount below.';content.append(endpoints);
    const number=inputs[index],label=form.querySelector('label[for="'+number.id+'"]');label.textContent='Monthly amount ($, optional)';content.append(label,number);
    const clear=document.createElement('button');clear.type='button';clear.className='fi-clear-estimate';clear.textContent='Leave unanswered';content.append(clear);
    function sync(){const answered=number.value!=='';summary.querySelector('[data-category-amount]').textContent=answered&&number.validity.valid?'$'+Number(number.value).toLocaleString('en-US')+' / month':answered?'Check amount':'Not estimated';slider.value=answered?String(Math.min(group.max,Math.max(0,Number(number.value)))):'0';slider.setAttribute('aria-valuetext',answered?'Slider '+slider.value+' dollars per month; exact entered amount '+number.value+' dollars':'Not estimated. Adjust to enter a monthly amount.');}
    slider.oninput=()=>{number.value=slider.value;number.dispatchEvent(new Event('input',{bubbles:true}));};
    number.addEventListener('input',sync);
    clear.onclick=()=>{number.value='';number.dispatchEvent(new Event('input',{bubbles:true}));};
    sliderPairs.push({sync,number});details.append(content);form.querySelector('fieldset').append(details);
  });
  form.querySelector('fieldset').querySelector('legend').textContent='About how much do you spend each month?';
  const spendingHint=document.createElement('p');spendingHint.textContent='Rough estimates are fine. Count each purchase in one category only.';form.querySelector('fieldset').querySelector('legend').after(spendingHint);
  draftSection.querySelector('small').textContent='Store examples help describe your routine; they are not confirmed card partners. Estimates use the sample 1% rate, regardless of which stores you choose.';
  const optional=document.createElement('div');optional.className='fi-merchant-choices';optional.innerHTML='<label><input type="checkbox" data-other-place><span>Somewhere else</span></label><label><input type="checkbox" data-private-shopping><span>Prefer not to say</span></label>';categoryGroup.after(optional);
  optional.querySelector('[data-private-shopping]').onchange=event=>{if(event.target.checked)draftSection.querySelectorAll('[data-choice],[data-other-place]').forEach(input=>input.checked=false);};
  draftSection.addEventListener('change',event=>{if(event.target.matches('[data-choice],[data-other-place]')&&event.target.checked)optional.querySelector('[data-private-shopping]').checked=false;});
  let reviewedDraft=null;
  const draftStatus=statusNode;
  function invalidateDraft(){if(reviewedDraft){reviewedDraft=null;draftStatus.textContent='Your choices changed. Keep them again when you’re ready.';}}
  actions.querySelector('[data-review-impact]').onclick=()=>{
    if(!inputs.every(input=>input.validity.valid)){draftStatus.textContent='Check your spending amounts before keeping these choices.';inputs.find(input=>!input.validity.valid).focus();return;}
    const selected=Array.from(choices.querySelectorAll('[data-choice]:checked'),input=>input.value);
    const categories=Array.from(categoryGroup.querySelectorAll('input:checked'),input=>input.value),somewhereElse=optional.querySelector('[data-other-place]').checked,preferNotToSay=optional.querySelector('[data-private-shopping]').checked;
    if(!selected.length && !categories.length && !somewhereElse && !preferNotToSay && !cause.value && inputs.every(input=>input.value==='')){draftStatus.textContent='Choose an option or add a spending estimate first.';return;}
    const spending=inputs.map(input=>Math.round(Number(input.value||0)*100));
    reviewedDraft={version:1,tenant:'faithful',kind:'impact-demo-draft',cause:panel.querySelector('#fi-cause').value,merchants:selected,monthlySpendingCents:{groceries:spending[0],transport:spending[1],other:spending[2]},sampleRatePercent:1,projectedMonthlyCents:spending.reduce((sum,cents)=>sum+Math.round(cents/100),0)};
    Object.assign(reviewedDraft,{categories,somewhereElse,preferNotToSay});
    reviewedDraft.monthlySpendingCents.leisure=spending[3];
    reviewedDraft.cause=cause.value||null;
    ['groceries','transport','other','leisure'].forEach((key,index)=>{if(inputs[index].value==='')reviewedDraft.monthlySpendingCents[key]=null;});
    if(inputs.every(input=>input.value===''))reviewedDraft.projectedMonthlyCents=null;
    draftStatus.textContent='Choices kept for this open page. Nothing sent or activated; mobile transfer is not connected yet.';
  };
  actions.querySelector('[data-clear-impact]').onclick=()=>{reviewedDraft=null;draftSection.querySelectorAll('[type="checkbox"]').forEach(input=>input.checked=false);panel.querySelector('form').reset();draftStatus.textContent='Draft cleared.';};
  storyBar.querySelector('[data-impact-skip]').onclick=()=>{actions.querySelector('[data-clear-impact]').click();setStoryOpen(false);storyToggle.focus();};
  // Read-only, explicit-review boundary for the future handoff. No persistence,
  // network transmission, account activation or financial configuration here.
  window.FAITHFUL_IMPACT_DRAFT={getReviewed:()=>reviewedDraft?JSON.parse(JSON.stringify(reviewedDraft)):null};
  panel.addEventListener('input',invalidateDraft);
  panel.addEventListener('change',invalidateDraft);
  const money = cents => (cents / 100).toLocaleString('en-US', {style:'currency',currency:'USD'});
  function update() {
    const valid = inputs.every(input => input.validity.valid);
    panel.querySelector('#fi-error').hidden = valid;
    inputs.forEach(input => input.setAttribute('aria-invalid', !input.validity.valid ? 'true' : 'false'));
    panel.querySelector('.fi-results').hidden = !valid;
    if (!valid) return;
    const spend = inputs.map(input => Math.round(Number(input.value || 0) * 100));
    // Round each illustrative category to a cent so visible rows sum exactly.
    const impact = spend.map(cents => Math.round(cents / 100));
    const total = impact.reduce((a,b) => a+b,0);
    const maximum = Math.max(1,...impact);
    panel.querySelector('#fi-summary').textContent = inputs.every(input=>input.value==='') ? 'Add a spending estimate to see its potential. You can choose a cause now or later.' : `${money(total)} a month${cause.value?' toward '+cause.value:''} in this demo, from ${money(spend.reduce((a,b)=>a+b,0))} of entered monthly spending at the sample 1% rate.`;
    panel.querySelector('.fi-chart').setAttribute('aria-label','Illustrative monthly support: '+['Groceries','Fuel and transport','Other','Leisure'].map((label,index)=>label+': '+(inputs[index].value===''?'not entered':money(impact[index]))).join('; '));
    impact.forEach((cents,index) => {
      panel.querySelector(`[data-fi-bar="${index}"]`).style.width = (100*cents/maximum)+'%';
      panel.querySelector(`[data-fi-value="${index}"]`).textContent = inputs[index].value===''?'Not entered':money(cents);
    });
  }
  panel.addEventListener('input',update);
  panel.addEventListener('change',update);
  panel.querySelector('form').addEventListener('submit',event=>event.preventDefault());
  panel.querySelector('form').addEventListener('reset',()=>{invalidateDraft();inputs.forEach(input=>input.value='');sliderPairs.forEach(pair=>pair.sync());setTimeout(update,0);});
  update();
  window.openFaithfulImpactExercise = function () {
    if (mobile) { showScreen('give'); walletTabGive('impact'); }
    else openWalletTab('impact');
    disclosure.open = true;
    panel.querySelector('h2').focus({preventScroll:true});
  };
})();
