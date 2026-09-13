import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync('apps/member-web/public/shared/grace-member-intents.js','utf8'),c);
for(const [text,nav] of [['Open Groups','groups'],['Show me the Journal page','journal'],['Can you open Settings?','settings'],['Take me to My Journey','profile'],['Open the Impact Card','impact-example']]){
 const r=c.GRACE_MEMBER_INTENTS.createSession().reply(text,'demo');assert.equal(r.nav,nav);assert(r.navigateNow);
}
const s=c.GRACE_MEMBER_INTENTS.createSession();
assert(!s.reply('so me the team page','demo').navigateNow);
assert.equal(s.reply('yes','demo').nav,'groups');
assert.equal(s.reply('yes','demo'),null);
assert(!s.reply("Don't open Groups",'demo').navigateNow);
assert(!s.reply('Open https://example.com','demo')?.navigateNow);
console.log('PASS: explicit page commands, team clarification and confirmation, consumed consent, refusal, arbitrary URL rejection.');

for(const [label,nav] of Object.entries({Reflect:'profile','My Journey':'profile',Journey:'profile',Home:'home',Leadership:'ai',Connect:'groups',Events:'events',Volunteering:'volunteer',Growth:'growth',Goals:'goals','Bible Study':'study',Care:'outreach',Watch:'watch',Giving:'give',Wallet:'wallet','First Step':'first-step'})){
 const session=c.GRACE_MEMBER_INTENTS.createSession();
 const result=session.reply('Open '+label,'maya');
 assert.equal(result.nav,nav,label);assert(result.navigateNow,label);
 assert.equal(session.reply('yes','maya'),null,'Direct navigation leaves no pending offer');
}
for(const refusal of ['No thanks','Cancel','Not now',"Don't open Groups"]){
 const session=c.GRACE_MEMBER_INTENTS.createSession();session.reply('Show me the team page','maya');
 assert(!session.reply(refusal,'maya')?.navigateNow);
 assert.equal(session.reply('yes','maya'),null,'Refusal consumes offer');
}
{
 const session=c.GRACE_MEMBER_INTENTS.createSession();session.reply('Show me the team page','maya');
 assert.equal(session.reply('yes','john'),null,'Another identity cannot accept');
 session.reply('Show me the team page','john');
 assert.equal(session.reply('Open Reflect','john').nav,'profile');
 assert.equal(session.reply('yes','john'),null,'New destination replaces team offer');
}
for(const input of ['Open Groups and show Journal','Open javascript:alert(1)','Open the admin dashboard','Open another member journal']){
 assert(!c.GRACE_MEMBER_INTENTS.createSession().reply(input,'maya')?.navigateNow,input);
}
console.log('PASS: Reflect and legacy aliases, supported destinations, cancelled and cross-member offers, topic replacement, compound and unsupported navigation requests.');
