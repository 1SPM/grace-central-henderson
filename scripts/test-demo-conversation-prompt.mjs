import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('apps/member-web/public/shared/grace-companion.js','utf8');
const start=source.indexOf('  function buildMemberPersonaPrompt(question) {');
const end=source.indexOf('\n  function askAi(question)',start);
assert(start>=0&&end>start);
const context={faithfulExperience:true,know:()=>({serviceTimes:'Demo Sunday 9:45'}),M:{churchName:'Faithful Church'},name:()=> 'Demo member',threadHistory:[]};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
context.threadHistory=[{role:'user',text:'I want to meet people, but large gatherings overwhelm me.'},{role:'model',text:'Would a smaller gathering feel easier?'},{role:'user',text:'Actually, I would rather volunteer. Do not sign me up yet.'}];
const prompt=context.buildMemberPersonaPrompt(context.threadHistory.at(-1).text);
assert(prompt.includes('large gatherings overwhelm me'));
assert(prompt.includes('DEMO LISTINGS'));
assert(!prompt.includes('CHURCH FACTS'));
assert(!prompt.includes('friendly in-app companion'));
assert.equal(prompt.split('Actually, I would rather volunteer.').length-1,1);
context.threadHistory=Array.from({length:12},(_,i)=>({role:'user',text:`turn-${i}`}));
const bounded=context.buildMemberPersonaPrompt('current');
assert(!bounded.includes('turn-0'));assert(bounded.includes('turn-10'));assert(!bounded.includes('turn-11'));
console.log('PASS: actual prompt includes bounded recent dialogue, labels demo sources, and avoids duplicating the current message.');
if(process.argv.includes('--live')){
 const response=await fetch('http://127.0.0.1:3021/api/ai/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,maxTokens:250}),signal:AbortSignal.timeout(20000)});
 assert(response.ok,`HTTP ${response.status}`);
 const body=await response.json();assert(body.success&&body.text);
 console.log('LIVE PROVIDER REPLY (prompt-level test, not browser interaction):\n'+body.text);
}
