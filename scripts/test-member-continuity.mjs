import {readFileSync} from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c={};vm.createContext(c);vm.runInContext(readFileSync('apps/member-web/public/shared/grace-member-intents.js','utf8'),c);
const s=c.GRACE_MEMBER_INTENTS.createSession();
s.reply('I need someone to talk to','a');assert.equal(s.reply('Yes, please','a').nav,'outreach');assert.equal(s.reply('Yes, please','a'),null);
s.reply('Guide me through this','a');s.reply('Never mind','a');assert.equal(s.reply('Yes, please','a'),null);
s.reply('Guide me through this','a');assert.equal(s.reply('Yes, please','b'),null);
s.reply('Guide me through this','b');s.reply('What is the weather?','b');assert.equal(s.reply('Yes, please','b'),null);
s.reply('Save what I wrote','b');assert(s.reply('Did you save it?','b').text.startsWith('No.'));
s.reply('Help me reflect','b');assert(s.reply('Give me a question to start with','b').text.includes('kindness'));
console.log('PASS: acceptance, consumed offer, cancellation, identity change, topic change, truthful save status, reflection follow-up');
for(const phrase of ['Sure','Yep','Okay','Sounds good',"Let's do that"]){s.reply('Guide me through this','b');assert.equal(s.reply(phrase,'b').navigateNow,true);}
for(const phrase of ['No','Not now','Maybe later']){s.reply('Guide me through this','b');assert(!s.reply(phrase,'b').navigateNow);assert.equal(s.reply('Yes','b'),null);}
s.reply('Guide me through this','b');assert.equal(s.reply('Yes, but do not open anything','b').navigateNow,undefined);
assert.equal(s.reply('I missed the church last week','b').scenario,'11');
console.log('PASS: broader affirmations, refusal, qualified yes, spoken church phrasing');
