import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
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
// Central Henderson is the live client tenant. Two guards, and they protect
// different things.
//
// 1. CONTENT PIN. Previously this compared Central's files to RELEASE_BASE via
//    `git show`, which froze them at that commit forever: any deliberate
//    Central change made this test unpassable, and the only way out was to
//    delete the assertion. Pinning to a recorded hash keeps exactly the same
//    protection — unreviewed drift still fails — while making an intentional
//    change a visible one-line diff a reviewer must approve. Update these ONLY
//    in a PR whose subject is changing Central.
const CENTRAL_PAGE_SHA256={
 'member-portal.html':'1a0a373736ea588b1993c3ac087e1f980c039b49b8baeada100fe993a91c8bb9',
 'grace_central_henderson_members_card_ios_app.html':'9eecc89ba5ee9b6557ed9746baf6f6da5add93cbb63937cf5cac7f610dbbecaf',
};
for(const [page,expected] of Object.entries(CENTRAL_PAGE_SHA256)){
 const p='apps/member-web/public/tenants/central-henderson/'+page;
 const actual=createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 assert.equal(actual,expected,`Central Henderson's ${page} changed. If that was deliberate, update CENTRAL_PAGE_SHA256 in this file as part of a PR that is about changing the live client tenant — not as a side effect of a Faithful release.`);
}

// 2. THE DURABLE INVARIANT, which the content pin never actually stated: the
//    Faithful guided experience must not reach the live client tenant. A hash
//    pin cannot express this on its own — bump the hash and it would pass even
//    if the flag had been added. Assert the thing we actually care about.
for(const page of Object.keys(CENTRAL_PAGE_SHA256)){
 const html=fs.readFileSync('apps/member-web/public/tenants/central-henderson/'+page,'utf8');
 assert(!html.includes("GRACE_MEMBER_EXPERIENCE = 'faithful-v1'"),`${page} must not opt into the Faithful experience`);
 assert(!/src="faithful-[a-z-]+\.js"/.test(html),`${page} must not load Faithful-only modules`);
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
console.log('PASS: Central content pin + no-Faithful-leak invariant, routing, greeting, prompt, speech fallback, unchanged pages; Faithful-only opt-in and exact mobile framing exception.');
