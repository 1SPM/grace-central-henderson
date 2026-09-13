import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
for(const mobile of [false,true]){
 const dom=new JSDOM(mobile?'<div id="screen-home"></div><section id="screen-profile"><div class="scroll" id="jy-scroll"><div class="wj"></div></div></section>':'<section id="sec-profile"><div class="wj"></div></section>',{url:'http://localhost',runScripts:'outside-only'});
 let requests=0;dom.window.fetch=()=>{requests++;};
 dom.window.eval(fs.readFileSync('apps/member-web/public/tenants/faithful/faithful-preferences.js','utf8'));
 const d=dom.window.document,guide=d.querySelector('[data-reflect-guide]'),story=d.querySelector('#fp-reflect-story'),toggle=d.querySelector('[data-reflect-open]');
 assert.equal(guide.parentElement.firstElementChild,guide);assert(story.hidden);toggle.click();
 assert.equal(story.querySelectorAll('input').length,4);const note=story.querySelector('textarea');note.value='A quiet morning';story.querySelector('input').click();
 toggle.click();toggle.click();assert.equal(note.value,'A quiet morning');assert(story.querySelector('input').checked);
 dom.window.eval(fs.readFileSync('apps/member-web/public/tenants/faithful/faithful-weekly-journey.js','utf8'));
 assert.equal(d.querySelector('.wj-heading').nextElementSibling,guide);
 d.querySelector('[data-tab="growth"]').click();
 assert.equal(d.querySelector('.wj-heading').nextElementSibling,guide);assert.equal(note.value,'A quiet morning');
 d.querySelector('[data-reflect-skip]').click();assert(story.hidden);assert.equal(note.value,'');assert(!story.querySelector('input').checked);assert.equal(d.activeElement,toggle);
 assert.equal(requests,0);assert.equal(dom.window.localStorage.length,0);dom.window.close();
}
console.log('PASS: Reflect desktop/mobile mounting, choices, close/skip, isolation from lesson container and no persistence/transmission. DOM tests only.');
