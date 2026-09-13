import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
for(const mobile of [false,true]){
 const dom=new JSDOM(`<section id="${mobile?'screen':'sec'}-destination-my-profile"><div data-member-profile></div></section>`,{url:'http://localhost',runScripts:'outside-only'});
 const w=dom.window,d=w.document;let writes=0;w.fetch=()=>{writes++;};
 w.openMemberDestination=key=>{assert.equal(key,'my-profile');w.dispatchEvent(new w.Event('faithful-profile-open'));};
 w.eval(fs.readFileSync('apps/member-web/public/tenants/faithful/faithful-member-profile.js','utf8'));
 assert.equal(d.querySelector('input').value,'Maya');
 const visitor={kind:'visitor-demo',preferredName:'Sean',story:{church:['New visitor answer']}};
 w.openFaithfulMemberProfile(visitor);assert.equal(d.querySelector('input').value,'Sean');assert(!d.body.textContent.includes('Maya’s sample'));
 assert.equal(d.querySelector('textarea').value,'New visitor answer');d.querySelector('input').value='Sam';d.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(visitor.preferredName,'Sam');
 w.openMemberDestination('my-profile');assert.equal(d.querySelector('input').value,'Sam');assert.equal(w.localStorage.length,0);assert.equal(writes,0);dom.window.close();
}
console.log('PASS: shared desktop/mobile profile view, Maya/visitor separation, edits survive navigation, no storage or network. Visual check unavailable.');
