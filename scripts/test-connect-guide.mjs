import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
for(const mobile of [false,true]){
 const dom=new JSDOM(mobile?'<div id="screen-home"></div><section id="screen-community"><div class="scroll"><div class="cn-hero"></div></div></section>':'<section id="sec-network"><header class="fc-heading"></header><div class="net-tabs"></div></section>',{url:'http://localhost',runScripts:'outside-only'});
 let requests=0;dom.window.fetch=()=>{requests++;};
 dom.window.eval(fs.readFileSync('apps/member-web/public/tenants/faithful/faithful-preferences.js','utf8'));
 const d=dom.window.document,guide=d.querySelector('.fp-preferences'),story=d.querySelector('#fp-connect-story'),toggle=d.querySelector('[data-connect-open]');
 assert.equal(guide.querySelector('summary').textContent,'Find your people');
 assert(mobile?guide.parentElement.firstElementChild===guide:guide.previousElementSibling.classList.contains('fc-heading'));
 assert(story.hidden);toggle.click();assert(!story.hidden);
 const note=story.querySelector('textarea');note.value='Demo group';story.querySelector('input[type="checkbox"]').click();
 toggle.click();toggle.click();assert.equal(note.value,'Demo group');assert(story.querySelector('input').checked);
 d.querySelector('[data-connect-skip]').click();assert(story.hidden);assert.equal(note.value,'');assert(!story.querySelector('input').checked);
 assert.equal(d.activeElement,toggle);assert.equal(requests,0);assert.equal(dom.window.localStorage.length,0);dom.window.close();
}
console.log('PASS: Connect desktop/mobile placement, optional choices, draft preservation, skip, focus and no storage/network writes. DOM tests only.');
