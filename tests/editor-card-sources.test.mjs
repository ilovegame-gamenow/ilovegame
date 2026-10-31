import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../editor-dashboard.html',import.meta.url),'utf8');
function renderer(){
 const context=vm.createContext({window:{},document:{createElement:()=>({}),head:{appendChild(){}}},GameImage:{getUrl:()=>''}});
 vm.runInContext(readFileSync(new URL('../date-utils.js',import.meta.url),'utf8'),context);
 vm.runInContext(readFileSync(new URL('../news-card.js',import.meta.url),'utf8'),context);
 return (sourceName,options)=>context.window.GameNewsCard.render({id:1,source_name:sourceName,title:'記事'},options);
}
test('manufacturer names become native filter links for any registered source',()=>{
 const render=renderer();
 for(const [name,id] of [['Nintendo','nintendo'],['PlayStation','playstation'],['Future Studio','future-studio']]){
  const output=render(name,{clickable:false,sourceLink:{id,href:`/editor-dashboard.html?source=${id}&status=published&page=1`}});
  assert.match(output,/^<article class="card">/);assert.ok(output.includes(`data-source="${id}"`));
  assert.ok(output.includes(`>${name}</a>`));assert.ok(output.includes(`${name}の記事に絞り込む`));
 }
});
test('ordinary public cards keep the article link and do not contain nested maker links',()=>{
 const render=renderer();
 const output=render('PlayStation',{sourceLink:{id:'playstation',href:'/editor-dashboard.html?source=playstation'}});
 assert.equal((output.match(/<a /g)||[]).length,1);assert.match(output,/href="\/article.html\?id=1"/);assert.ok(!output.includes('game-source-link'));
 assert.ok(!render('Nintendo',{clickable:false}).includes('game-source-link'));
});
test('source names and link attributes remain HTML-escaped',()=>{
 const output=renderer()('Studio <test>',{clickable:false,sourceLink:{id:'test"',href:'/editor-dashboard.html?source=test&status=all'}});
 assert.ok(output.includes('Studio &lt;test&gt;'));assert.ok(output.includes('data-source="test&quot;"'));assert.ok(output.includes('test&amp;status=all'));
});
test('card-source links preserve status, reset pagination and support future registry entries',()=>{
 const body=html.match(/    function articleSourceLink\(article\) \{[\s\S]*?\n    \}/)[0];
 const context=vm.createContext({URL,location:{href:'https://site.invalid/editor-dashboard.html?status=rejected&page=4'},currentFilter:'rejected',sourceOptions:[{id:'all',label:'すべて'},{id:'nintendo',label:'Nintendo'},{id:'playstation',label:'PlayStation'},{id:'future',label:'Future Studio'}]});
 vm.runInContext(body,context);
 for(const [name,id] of [['Nintendo','nintendo'],['PlayStation','playstation'],['Future Studio','future']]){
  const link=vm.runInContext(`articleSourceLink({source_name:${JSON.stringify(name)}})`,context);
  const url=new URL(link.href,'https://site.invalid');
  assert.equal(link.id,id);assert.equal(url.searchParams.get('source'),id);assert.equal(url.searchParams.get('status'),'rejected');assert.equal(url.searchParams.get('page'),'1');
 }
 assert.equal(vm.runInContext('articleSourceLink({source_name:null})',context),null);
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
