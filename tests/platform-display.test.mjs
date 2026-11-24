import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../platform-display.js',import.meta.url),'utf8'),context);
const display=context.GamePlatforms;
test('platform aliases, calendar objects and finder names use one ordered set of labels without changing input',()=>{
 const values=['Android',{name:'PlayStation 5',code:'ps5'},'Nintendo Switch','windows','iOS','Switch','PC（Steam）','macOS'];
 const original=JSON.stringify(values);
 assert.deepEqual(Array.from(display.list(values),p=>p.label),['Switch1','PS5','Steam','Mac','iOS','Android']);assert.equal(JSON.stringify(values),original);
 assert.equal(display.describe('Xbox Series X/S').label,'Xbox Series X|S');
 assert.equal(display.describe('iOS（App Store）').label,'iOS');
});
test('HTML and DOM badge rendering agree, retain unknown labels and safely display external text',()=>{
 const values=['PS5','<img src=x onerror=alert(1)>','Android'];
 const createElement=tag=>({tag,children:[],append(item){this.children.push(item);}});
 const dom=display.element(values,{createElement});
 const html=display.render(values);
 for(const badge of dom.children){assert.ok(html.includes(`class="${badge.className}"`));}
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.equal(dom.children[2].textContent,values[1]);
 assert.equal(display.render(null),'');assert.deepEqual(Array.from(display.list([])),[]);
});
test('all pages using classic badge consumers load the shared script and stylesheet',()=>{
 for(const file of ['index.html','editor-dashboard.html','editor-preview.html','article.html','editor-article.html','editor-games.html']){
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');assert.ok(html.includes('/platform-display.css'),file);assert.ok(html.indexOf('/platform-display.js')<Math.max(html.indexOf('/news-card.js'),html.indexOf('/article-renderer.js'),html.indexOf('/editor-game-finder.js')),file);
 }
 for(const file of ['calendar.html','weekly-roundup.html'])assert.ok(readFileSync(new URL('../'+file,import.meta.url),'utf8').includes('/platform-display.css'));
});

test('compact card categories match filters, deduplicate hardware and support movies',()=>{
 const a={platforms:['Switch','Switch 2','PS5','PS4','Xbox Series X|S','Xbox One','Steam','PC','Android']};
 const html=display.renderCategories(a);
 assert.deepEqual(Array.from(html.matchAll(/class="news-category-badge platform-badge--[^"]+">([^<]+)/g),m=>m[1]),['Switch','PS','Xbox','PC','Mobile']);
 assert.equal(display.renderCategories({category:'MOVIE',platforms:[]}),'<div class="news-category-badges"><span class="news-category-badge platform-badge--movie">MOVIE</span></div>');
 assert.equal(display.renderCategories({platforms:[]}), '');
 assert.equal(display.matchesFeedCategory({platforms:['Wii U']},'switch'),false);
 for(const name of ['Switch','Switch1','Nintendo Switch','Nintendo Switch 1']) {assert.equal(display.describe(name).label,'Switch1');assert.equal(display.matchesFeedCategory({platforms:[name]},'switch'),true);}
});
