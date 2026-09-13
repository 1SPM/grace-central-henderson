import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const ctx={};vm.createContext(ctx);vm.runInContext(readFileSync('apps/member-web/public/shared/grace-member-intents.js','utf8'),ctx);
const resolve=ctx.GRACE_MEMBER_INTENTS.resolve;
const samples={ '01':'What can I do here?', '02':'I am new to the platform','03':'I already attend','04':'Help me decide','05':'Just looking','06':'Guide me through this','07':'What time is Sunday service?', '11':'I missed church last week','12':'Who preached Sunday?','13':'Play the latest sermon','14':'Summarize that message','15':'What was the main passage?','21':'Help me reflect','22':'Start a personal reflection','23':'Save what I wrote','24':'Continue my earlier reflection','25':'Delete this reflection','27':'Can you read my private notes?','28':'Ask GRACE about these words','29':'Dictate my thoughts','30':'Cancel that recording','52':'Is this really the pastor?','53':'I need someone to talk to','54':'How do care requests work?','97':'The microphone goes red then stops'};
for(const [id,text] of Object.entries(samples)){const r=resolve(text);assert.equal(r?.scenario,id,text);assert(r.text);assert(!/recorded it for|staff received|appointment confirmed/i.test(r.text));}
assert.equal(resolve('Never mind').scenario,'05');assert.equal(resolve('the week before').scenario,'14');assert.equal(resolve('unrelated pineapple'),null);
assert.equal(ctx.GRACE_MEMBER_INTENTS.ids.length,25);
console.log('PASS: 25 priority intent examples; cancellation, date correction fallback, unknown fallthrough. Not an end-to-end voice or account test.');
