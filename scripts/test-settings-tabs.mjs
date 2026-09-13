import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
for(const mobile of [false,true]){
 const prefix=mobile?'screen':'sec';const dom=new JSDOM(`${mobile?'<div id="screen-home"></div>':''}<section class="fd-destination" id="${prefix}-destination-settings"><h1>Settings</h1><div class="fd-grid">${['profile','reading','guidance','privacy','account'].map(s=>`<article>${s}</article>`).join('')}</div></section><section class="fd-destination"><h1>My profile</h1><div data-member-profile></div></section>`,{url:'http://localhost',runScripts:'outside-only'});
 const w=dom.window,d=w.document;let destination;w.openMemberDestination=key=>destination=key;
 for(const file of ['faithful-member-profile.js','faithful-settings-tabs.js'])w.eval(fs.readFileSync('apps/member-web/public/tenants/faithful/'+file,'utf8'));
 const tabs=d.querySelectorAll('[role=tab]');assert.equal(tabs.length,4);assert.equal(d.querySelectorAll('[role=tabpanel]:not([hidden])').length,1);
 tabs[1].click();assert.equal(tabs[1].getAttribute('aria-selected'),'true');assert(d.querySelector('#settings-panel-guidance').textContent.includes('guidance'));
 tabs[1].dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal(d.activeElement,tabs[3]);
 const visitor={kind:'visitor-demo',preferredName:'Test visitor',story:{connect:['A small group']}};w.openFaithfulMemberProfile(visitor);assert.equal(destination,'settings');assert.equal(tabs[0].getAttribute('aria-selected'),'true');assert.equal(d.querySelector('[data-member-profile] input').value,'Test visitor');
 tabs[2].click();tabs[0].click();assert.equal(d.querySelector('[data-member-profile] textarea').value,'');assert.equal(d.querySelectorAll('[data-member-profile]').length,1);
 assert.equal(d.querySelector('#'+prefix+'-destination-settings h1').textContent,'Settings');dom.window.close();
}
console.log('PASS: desktop/mobile Settings tabs, keyboard navigation, signup destination, one profile and stable Settings heading.');
