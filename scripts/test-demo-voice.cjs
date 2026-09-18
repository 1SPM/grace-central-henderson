const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync('apps/member-web/public/shared/grace-companion.js','utf8');
const phrases=JSON.parse(fs.readFileSync('apps/member-web/public/shared/grace-demo-voice.json','utf8'));
const requests=[],played=[];
let browserCalls=0;
const context={A:{publicDemoVoice:true},Memory:{data:{voiceOn:true}},setSpeaking(){},updateVoiceStatusLabel(){},console,Promise,
 speechSynthesis:{cancel(){},getVoices(){return [];},speak(){browserCalls++;}},
 fetch:async url=>{requests.push(url);return {ok:true,json:async()=>phrases};},
 Audio:class {constructor(src){this.src=src;}play(){played.push(this.src);return Promise.resolve();}pause(){}},
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('  const Voice = {'),source.indexOf('  if (Voice.browserSupported'))+'\nglobalThis.voice=Voice;',context);
async function main(){
 const v=context.voice;await v.detectProvider();
 v.speak(phrases[0]);await Promise.resolve();assert.equal(played.length,1);
 v.speak('Unrestricted text provided by a visitor');await Promise.resolve();assert.equal(played.length,1);
 v.speak(phrases[1]);v.stop();await Promise.resolve();assert.equal(played.length,1);
 context.Memory.data.voiceOn=false;v.speak(phrases[0]);await Promise.resolve();assert.equal(played.length,1);
 assert.deepEqual(requests,['/shared/grace-demo-voice.json']);assert.equal(browserCalls,0);
 for(let i=0;i<phrases.length;i++)assert.ok(fs.statSync(`apps/member-web/public/assets/grace-clara-demo/${i}.mp3`).size>1000);
 const api=fs.readFileSync('api/grace/_tts.ts','utf8');assert.ok(api.includes("return res.status(401).json({ error: 'auth_required' })"));
 for(const file of ['member-portal.html','grace_faithful_church_members_card_ios_app.html'])assert.ok(fs.readFileSync('apps/member-web/public/tenants/faithful/'+file,'utf8').includes('publicDemoVoice: true'));
 assert.ok(!fs.readFileSync('apps/member-web/public/tenants/central-henderson/member-portal.html','utf8').includes('publicDemoVoice: true'));
 const replies=[];
 Object.assign(context,{root:{},thinking:false,isOpen:true,api:{open(){}},appendUser(){},appendGrace:(...args)=>replies.push(args),RX:{crisis:/emergency/}});
 const askStart=source.indexOf('    ask(text) {');
 const askEnd=source.indexOf('      if (A.quietNavigator && resolvedMemberId',askStart);
 vm.runInContext('globalThis.ask=function(text){'+source.slice(askStart+'    ask(text) {'.length,askEnd)+'};',context);
 context.ask('groups');context.ask('events');context.ask('reflect');
 assert.equal(context.A.demoExchanges,3);assert.equal(replies.at(-1)[1],'demo-signup');
 context.ask('more');assert.equal(context.A.demoExchanges,3);assert.equal(replies.at(-1)[1],'demo-signup');
 context.ask('emergency');assert.equal(replies.at(-1)[1],'outreach');
 console.log('PASS: fixed clips, unknown text silent, stop/mute, no synthesis calls, no computer voice, complete assets, Faithful only, auth unchanged');
}main().catch(e=>{console.error(e);process.exitCode=1});
