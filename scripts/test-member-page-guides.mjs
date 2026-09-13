import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
for(const mobile of [false,true]){
 for(const kind of ['care','wallet']){
  const html=kind==='care'?(mobile?'<div id="screen-home"></div><section id="screen-leaders"><div class="scroll"></div></section>':'<section id="sec-ai"></section>'):(mobile?'<section id="gv-panel-assets"></section>':'<section id="wlt-give"></section>');
  const dom=new JSDOM(html,{url:'http://localhost',runScripts:'outside-only'});
  let requests=0;dom.window.fetch=()=>{requests++;throw Error('Unexpected transmission');};
  let openedProfile=null;
  dom.window.openLeaderProfile=index=>{openedProfile=index;};
  dom.window[mobile?'leaders':'aiLeaders']=[{name:'Demo Prayer Leader',specialties:['Prayer']},{name:'Demo Family Leader',specialties:['Marriage']}];
  dom.window.eval(fs.readFileSync(`apps/member-web/public/tenants/faithful/faithful-${kind}-guide.js`,'utf8'));
  const d=dom.window.document;const open=d.querySelector('[data-open]');assert(open);
  const target=d.getElementById(open.getAttribute('aria-controls'));assert(target.hidden);
  if(kind==='wallet'){
   assert(d.querySelector('summary').textContent.includes('Get to know your card'));
   assert(d.body.textContent.includes('verifying your details'));
   assert(d.body.textContent.includes('provider’s approval'));
   assert(d.body.textContent.includes('does not open a credit account'));
   assert.equal(d.querySelectorAll('input[type="file"]').length,0);
  }
  open.click();assert(!target.hidden);assert.equal(target.querySelectorAll('textarea').length,kind==='care'?2:1);
  if(kind==='wallet'){
   assert.equal(d.querySelector('.fw-application-prep'),null);
   const checks=target.querySelectorAll('input[type="checkbox"]');assert.equal(checks.length,3);
   checks[0].click();open.click();open.click();assert(checks[0].checked);
   d.querySelector('[data-skip]').click();assert(!checks[0].checked);open.click();
  }
  const note=target.querySelector('textarea');note.value='Fictional walkthrough note';
  open.click();assert(target.hidden);open.click();assert.equal(note.value,'Fictional walkthrough note');
  d.querySelector(kind==='care'?'[data-story-skip]':'[data-skip]').click();assert(target.hidden);assert.equal(note.value,'');
  if(kind==='care'){
   const guide=d.querySelector('.fp-preferences'),example=d.querySelector('.fcg-example');
   guide.open=true;open.click();note.value='Keep my story draft';
   assert.equal(example.tagName,'SECTION');assert(target.contains(example));assert.equal(example.querySelector('summary'),null);
   d.querySelector('form [data-skip]').click();
   assert(guide.open,'Skipping the care example must not close the page guide');
   assert(target.hidden);assert.equal(note.value,'Keep my story draft');
   assert.equal(d.activeElement,open);open.click();
   assert.equal(d.querySelectorAll('select').length,1);
   const picker=target.querySelector('select');picker.value='I already know a pastor';picker.dispatchEvent(new dom.window.Event('change'));assert(note.value.includes('Keep my story draft'));assert(note.value.includes('I already know a pastor'));note.value='Keep my story draft';
   assert(target.querySelector('[data-story-answer="0"]').placeholder.includes('pastor'));
   d.querySelector('[data-care-choices] button').click();
   assert(!d.querySelector('[data-preview]').hidden);
   assert(d.querySelector('[data-leader-suggestion]').textContent.includes('Demo Prayer Leader'));
   assert.equal(d.querySelector('[data-support-areas] summary').textContent,'See areas of support');
   assert.equal(d.querySelector('[data-support-areas] li').textContent,'Prayer');
   assert(!d.querySelector('[data-support-areas]').open);
   assert.equal(openedProfile,null,'Suggestion must not navigate without a click');
   d.querySelector('[data-leader-suggestion] button').click();assert.equal(openedProfile,0);
   assert.equal(note.value,'Keep my story draft','Opening a profile must not record a preference');
   d.querySelector('[data-note-leader]').click();
   assert(note.value.startsWith('Keep my story draft'));
   assert(note.value.includes('Demo Prayer Leader'));
   const noted=note.value;d.querySelector('[data-note-leader]').click();assert.equal(note.value,noted);
   d.querySelector('[data-add-interest]').click();
   assert(target.querySelector('[data-story-answer="1"]').value.includes('prayer'));
   assert.equal(d.querySelector('[data-review]'),null);
   assert.equal(note.value,noted);
   const choices=Array.from(d.querySelectorAll('[data-care-choices] button'));
   choices.find(b=>b.textContent==='Relationships & family').click();
   assert(d.querySelector('[data-leader-suggestion]').textContent.includes('Demo Family Leader'));
   assert(d.querySelector('[data-leader-suggestion]').textContent.includes('existing connection'));
   choices.find(b=>b.textContent==='Practical support').click();
   assert(d.querySelector('[data-leader-suggestion]').textContent.includes('no confirmed specialist match'));
   assert.equal(d.querySelector('[data-leader-suggestion] button'),null);
  }
  assert.equal(requests,0);assert.equal(dom.window.localStorage.length,0);
  dom.window.close();
 }
}
console.log('PASS: Leadership and Wallet desktop/mobile: draft controls, simplified care choices, existing pastor prompt, explicit interest addition, review takeaway, no network or localStorage writes. DOM tests only.');
