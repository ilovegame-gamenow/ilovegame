import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('breaking and pickup share platform badges in public and editor preview rendering',()=>{
 const nodes=Object.fromEntries(['breaking','pickup','pickup-heading'].map(id=>[id,{innerHTML:'',childNodes:[],replaceChildren(){this.innerHTML='';},append(){}}]));
 const context=vm.createContext({window:{},document:{getElementById:id=>nodes[id],createElement:()=>({append(){}})},GameImage:{getUrl:()=>null},GameDate:{renderMeta:()=>'<time>日時</time>'}});
 for(const file of ['platform-display.js','featured-news.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 for(const clickable of [false,true]){
  context.window.GameFeatured.render({breaking:{id:1,title:'速報',platforms:['Nintendo Switch','PlayStation 5']},pickup:[{id:2,title:'注目',platforms:['Windows','Android']}]},{clickable});
  assert.match(nodes.breaking.innerHTML,/platform-badge--switch[^>]*>Switch/);
  assert.match(nodes.breaking.innerHTML,/platform-badge--playstation[^>]*>PS5/);
  assert.match(nodes.pickup.innerHTML,/platform-badge--pc[^>]*>PC/);
  assert.match(nodes.pickup.innerHTML,/platform-badge--mobile[^>]*>Android/);
 }
 context.window.GameFeatured.render({breaking:{title:'機種未記録'},pickup:[{title:'機種未記録',platforms:[]}]},{clickable:false});
 assert.ok(!nodes.breaking.innerHTML.includes('platform-badge'));assert.ok(!nodes.pickup.innerHTML.includes('platform-badge'));
});
