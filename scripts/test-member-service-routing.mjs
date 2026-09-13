import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context={};vm.createContext(context);
vm.runInContext(fs.readFileSync('apps/member-web/public/shared/grace-member-intents.js','utf8'),context);
const router=context.GRACE_MEMBER_INTENTS;
for(const text of ['Find a group for me','What events are available?','Change my notification preferences','Where can I find my receipt?']){
  const reply=router.resolve(text);
  assert(reply, text);
  assert(router.useService(reply,'member-a'), text);
  assert(!router.useService(reply,null), 'Demo keeps local guidance');
}
const session=router.createSession();
session.reply('Guide me through this','member-a');
const confirmation=session.reply('Yes please','member-a');
assert(confirmation.navigateNow);
assert(!router.useService(confirmation,'member-a'));
assert(!router.useService(session.reply('Do not send my journal','member-a'),'member-a'));
assert(!router.useService(router.resolve('immediate danger'),'member-a'));
assert(!router.useService(null,'member-a'));
console.log('PASS: authenticated broad questions prefer service; demo, navigation confirmation, refusal and crisis remain local. Routing policy only, not a live provider test.');
