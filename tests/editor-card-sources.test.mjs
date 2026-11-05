import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../editor-dashboard.html',import.meta.url),'utf8');
function renderer(){
 const context=vm.createContext({window:{},document:{createElement:()=>({}),head:{appendChild(){}}},GameImage:{getUrl:()=>''}});
 vm.runInContext(readFileSync(new URL('../date-utils.js',import.meta.url),'utf8'),context);
 vm.runInContext(readFileSync(new URL('../platform-display.js',import.meta.url),'utf8'),context);
 vm.runInContext(readFileSync(new URL('../news-card.js',import.meta.url),'utf8'),context);
 return (sourceName,options)=>context.window.GameNewsCard.render({id:1,source_name:sourceName,title:'記事'},options);
}
test('public and editor cards show dates without source names or source links',()=>{
 const render=renderer();
 for(const clickable of [true,false]){
  for(const name of ['Nintendo','PlayStation','Studio <test>']){
   const output=render(name,{clickable,sourceLink:{id:'studio',href:'/editor-dashboard.html?source=studio'}});
   assert.ok(!output.includes(name));
   assert.ok(!output.includes('Studio &lt;test&gt;'));
   assert.ok(!output.includes('game-source-link'));
   assert.ok(!output.includes('data-source='));
   assert.ok(output.includes('meta'));
  }
 }
});
test('interactive maker text does not trigger the parent card click or Enter navigation',()=>{
 const callbacks={};let cardClicks=0;const stored=[];
 const context=vm.createContext({cardElement:{addEventListener:(name,fn)=>{callbacks[name]=fn;},click:()=>cardClicks++},sessionStorage:{setItem:(...args)=>stored.push(args)},window:{scrollY:10},location:{href:'unchanged',pathname:'/editor-dashboard.html',search:'?source=nintendo'},URLSearchParams,article:{id:1}});
 vm.runInContext(readFileSync(new URL('../editor-navigation.js',import.meta.url),'utf8'),context);
 context.GameEditorNavigation=context.window.GameEditorNavigation;
 for(const eventName of ['click','keydown']){
  const registration=html.match(new RegExp(`cardElement\\.addEventListener\\("${eventName}", event => \\{[\\s\\S]*?\\n\\}\\);`))[0];
  vm.runInContext(registration,context);
 }
 const linkTarget={closest:()=>({tagName:'A'})};
 callbacks.click({target:linkTarget});callbacks.keydown({target:linkTarget,key:'Enter',preventDefault(){throw Error('Link default must remain available');}});
 assert.equal(context.location.href,'unchanged');assert.equal(cardClicks,0);assert.equal(stored.length,0);
 callbacks.click({target:{closest:()=>null}});assert.match(context.location.href,/^\/editor-article.html\?id=1&return=/);assert.equal(stored.length,1);
});
