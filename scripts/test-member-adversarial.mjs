import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
let now=1000000;const c={Date:{now:()=>now}};vm.createContext(c);vm.runInContext(fs.readFileSync('apps/member-web/public/shared/grace-member-intents.js','utf8'),c);
const session=()=>c.GRACE_MEMBER_INTENTS.createSession();let s;
for(const refusal of ["Yes, but don't open anything",'Do not send my journal','Do not delete my notes']){
 s=session();s.reply('Guide me through this','a');const r=s.reply(refusal,'a');assert(!r.nav);assert(r.text.includes('won’t'));assert.equal(s.reply('Sure','a'),null);
}
s=session();s.reply('I am new to the platform','a');assert.equal(s.reply('I do not attend church','a').nav,'first-step');assert(s.reply('Yes please','a').navigateNow);
s=session();s.reply('I missed church last week','a');const refusal=s.reply('No, not the demo','a');assert(!refusal.nav);assert(refusal.text.includes('won’t substitute'));
s=session();s.reply('I am new to the platform','a');assert.equal(s.reply('Change my notification preferences','a').nav,'settings');assert.equal(s.reply('Sure','a').nav,'settings');
s=session();s.reply('Guide me through this','a');const mixed=s.reply('Open Journal and show groups','a');assert(!mixed.nav);assert(mixed.text.includes('one thing at a time'));
s=session();s.reply('Guide me through this','a');now+=300001;assert.equal(s.reply('Sure','a'),null);
s=session();s.reply('Help me reflect','a');assert(s.reply("I don't know where to start",'a').text.includes('kindness'));
console.log('PASS: qualified refusal, negative membership, declined demo, explicit topic change, mixed requests, expired offers, uncertain reflection');
c.FAITHFUL_PUBLIC_LESSON=()=>({id:'fixture',status:'demo',ref:'Fixture 1:1',verse:'Exact fixture words.',translation:'Fixture edition',prompts:['Fixture prompt?']});
s=session();assert(s.reply('What is the main passage?','a').text.includes('Fixture 1:1'));
c.FAITHFUL_PUBLIC_LESSON=()=>({id:'new-week',status:'demo',ref:'Fixture 2:1',verse:'Different fixture.',translation:'Fixture edition',prompts:['New prompt?']});
assert(s.reply('Read it to me','a').text.includes('Exact fixture words.'));
assert(s.reply('Read it again','a').text.includes('Exact fixture words.'));
assert(s.reply('Help me reflect','a').text.includes('New prompt?'));
console.log('PASS: exact public-source quotation, source retained across week switch, current lesson prompt');
