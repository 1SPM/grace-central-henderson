import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const base='apps/member-web/public/tenants/faithful/';
for(const mobile of [false,true]){
 const html=fs.readFileSync(base+(mobile?'grace_faithful_church_members_card_ios_app.html':'member-portal.html'),'utf8');
 const fn=html.match(/navigate: (\(key\) => \{[\s\S]*?\n\s*\}),\n\s*onCrisis:/)[1];
 const calls=[];const c={document:{getElementById:()=>({textContent:''})}};
 for(const name of ['showScreen','scrollJourney','communityTab','goSection','_origGoSection','openPush','openMemberDestination','openProfileGrowth'])c[name]=v=>calls.push([name,v]);
 const navigate=vm.runInNewContext('('+fn+')',c);
 for(const key of ['journal','study','goals']){calls.length=0;assert.equal(navigate(key),true);assert(calls.some(([f,v])=>f===(mobile?'scrollJourney':'goSection')&&v===(mobile?'jy-'+key:key)));}
 calls.length=0;navigate('outreach');assert(calls.some(([f,v])=>f===(mobile?'showScreen':'_origGoSection')&&v===(mobile?'care':'outreach')));
 calls.length=0;navigate('groups');assert(calls.some(([f,v])=>f===(mobile?'communityTab':'goSection')&&v===(mobile?'groups-events':'groups')));
 assert.equal(navigate('invalid'),false);console.log((mobile?'Mobile':'Desktop')+': adapter destinations passed (not browser rendering)');
 for(const key of ['settings','volunteer','first-step']){calls.length=0;assert(navigate(key));assert(calls.some(([f,v])=>f==='openMemberDestination'&&v===key));}
 calls.length=0;assert(navigate('growth'));assert(calls.some(([f])=>f===(mobile?'scrollJourney':'openProfileGrowth')));
}
