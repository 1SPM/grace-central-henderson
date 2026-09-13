import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const base = process.env.RELEASE_BASE || '190d4689d8bf9bca238f1cadd95bbfb4720177be';
const shared='apps/member-web/public/shared/';
const baseline = name=>execFileSync('git',['show',base+':'+shared+name],{encoding:'utf8'});
const current = name=>fs.readFileSync(shared+name,'utf8');
function setup(version, enabled=false){
  const storage=new Map(),toasts=[];
  const c={console:{info(){}},Date,Math,setTimeout:fn=>{fn();return 1;},clearTimeout(){},
    GRACE_PORTAL_CHURCH:'Central Henderson',GRACE_PORTAL_IS_DEMO:false,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    document:{getElementById(){return null},querySelector(){return null},querySelectorAll(){return []}},
    location:{pathname:'/tenants/central-henderson/member-portal.html'}, navigator:{},
  };
  if(enabled)c.GRACE_MEMBER_EXPERIENCE='faithful-v1';
  vm.createContext(c);
  vm.runInContext(version('grace-messaging.js'),c);
  let source=version('grace-companion.js');
  source=source.replace('  global.GRACE_COMPANION = api;',`  global.testHooks={think,buildGreeting,buildMemberPersonaPrompt,Listen,Memory,configure(adapter){A=adapter;M=adapter.messaging;Memory.load();}};\n  global.GRACE_COMPANION = api;`);
  vm.runInContext(source,c);
  c.testHooks.configure({messaging:c.GRACE_MESSAGING.getMessaging(),memberName:'Example',getState:()=>({}),toast:m=>toasts.push(m),currentPage:()=> 'home'});
  return {c,toasts};
}
const before=setup(baseline),after=setup(current);
const plain=v=>JSON.parse(JSON.stringify(v));
assert.deepEqual(plain(after.c.GRACE_MESSAGING.getMessaging()),plain(before.c.GRACE_MESSAGING.getMessaging()),'Central messaging must match baseline');
for(const role of ['Senior Pastor · AI Companion','Senior Pastor · AI avatar']){
  assert.equal(after.c.GRACE_MESSAGING.leaderFollowUpLine({role}),before.c.GRACE_MESSAGING.leaderFollowUpLine({role}));
}
assert.equal(after.c.GRACE_MESSAGING.avatarBio('Pastor Example','Central Henderson'),before.c.GRACE_MESSAGING.avatarBio('Pastor Example','Central Henderson'));
for(const question of ['Who are you?','Hello','Open groups','What is my balance?','Can I volunteer?','What are my notifications?','Read my journal','An unusual question about astronomy','immediate danger','Help me find a leader']){
  assert.deepEqual(plain(after.c.testHooks.think(question)),plain(before.c.testHooks.think(question)),question);
}
assert.equal(after.c.testHooks.buildGreeting('home'),before.c.testHooks.buildGreeting('home'));
assert.equal(after.c.testHooks.buildMemberPersonaPrompt('What is on this week?'),before.c.testHooks.buildMemberPersonaPrompt('What is on this week?'));
for(const app of [before,after]){app.states=[];app.c.testHooks.Listen.start(()=>{},value=>app.states.push(value),()=>{throw Error('Legacy should not use new error callback')});}
assert.deepEqual(after.states,before.states);assert.deepEqual(after.toasts,before.toasts);
const enabled=setup(current,true);
assert.notEqual(plain(enabled.c.GRACE_MESSAGING.getMessaging()).system.tutorial.badge,plain(before.c.GRACE_MESSAGING.getMessaging()).system.tutorial.badge);
assert(enabled.c.testHooks.buildMemberPersonaPrompt('Hello').includes('DEMO LISTINGS'));
for(const page of ['member-portal.html','grace_faithful_church_members_card_ios_app.html'])assert(fs.readFileSync('apps/member-web/public/tenants/faithful/'+page,'utf8').includes("GRACE_MEMBER_EXPERIENCE = 'faithful-v1'"));
for(const page of ['member-portal.html','grace_central_henderson_members_card_ios_app.html']){
 const p='apps/member-web/public/tenants/central-henderson/'+page;
 assert.equal(fs.readFileSync(p,'utf8'),execFileSync('git',['show',base+':'+p],{encoding:'utf8'}));
}
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
function headers(path){return Object.fromEntries(config.headers.filter(r=>new RegExp('^'+r.source+'$').test(path)).flatMap(r=>r.headers.map(h=>[h.key,h.value])));}
const mobile='/tenants/faithful/grace_faithful_church_members_card_ios_app.html';
assert.equal(headers(mobile)['X-Frame-Options'],'SAMEORIGIN');
assert(headers(mobile)['Content-Security-Policy'].includes("frame-ancestors 'self'"));
for(const path of ['/tenants/central-henderson/member-portal.html','/tenants/central-henderson/grace_central_henderson_members_card_ios_app.html',mobile+'/other','/index.html']){
 assert.equal(headers(path)['X-Frame-Options'],'DENY');
 assert(headers(path)['Content-Security-Policy'].includes("frame-ancestors 'none'"));
}
console.log('PASS: Central baseline copy, routing, greeting, prompt, speech fallback, unchanged pages; Faithful-only opt-in and exact mobile framing exception.');
