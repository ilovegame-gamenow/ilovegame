import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
class Element{
 constructor(tag,text='',className=''){this.tag=tag;this.textContent=text;this.className=className;this.children=[];this.events={};this.value='';}
 append(...items){for(const item of items){this.children.push(item);item.parent=this;}}
 replaceChildren(...items){this.children=[];this.append(...items);}
 replaceWith(item){const i=this.parent.children.indexOf(this);this.parent.children.splice(i,1,item);item.parent=this.parent;}
 addEventListener(name,fn){this.events[name]=fn;}
 querySelectorAll(selector){const tags=selector.split(',');return this.children.flatMap(c=>[...(tags.includes(c.tag)?[c]:[]),...c.querySelectorAll(selector)]);}
 reportValidity(){return true;}
}
async function setup(data){
 const nodes=Object.fromEntries(['titleFinder','findTitle','finderResults','finderMessage'].map(id=>[id,new Element(id==='findTitle'?'input':'div')]));
 nodes.findTitle.value='テスト作品';nodes.titleFinder.append(nodes.findTitle,new Element('button'));
 const calls=[],events=[];
 const ctx={URL,console,location:{replace(){}},Event:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},confirm:()=>true,
 document:{createElement:tag=>new Element(tag),getElementById:id=>nodes[id],dispatchEvent:event=>events.push(event.type)},
 GameCatalogClient:{node:(...args)=>new Element(...args),createId:()=> '11000000-0000-4000-8000-000000000001',request:async(path,options)=>{calls.push({path,options});return options?.method?{game:{id:'saved'}}:data;}}};
 vm.runInNewContext(readFileSync(new URL('../platform-display.js',import.meta.url),'utf8'),ctx);
 vm.runInNewContext(readFileSync(new URL('../editor-game-finder.js',import.meta.url),'utf8'),ctx);
 await nodes.titleFinder.events.submit({preventDefault(){}});return {nodes,calls,events};
}
test('finder shows source, platform and plain text and registers the selected external identity',async()=>{
 const {nodes,calls,events}=await setup({games:[],results:[{provider:'wikidata',externalId:'Q123',title:'<script>作品</script>',description:'<b>説明</b>',platforms:['Nintendo Switch'],url:'https://www.wikidata.org/wiki/Q123',sourceLabel:'Wikidata',officialUrl:'javascript:alert(1)'}],sources:[{name:'全機種の作品データ',available:true,count:1}]});
 const cards=nodes.finderResults.children.filter(c=>c.className==='finder-result');assert.equal(cards.length,1);
 const card=cards[0];assert.equal(card.children.find(c=>c.tag==='h3').textContent,'<script>作品</script>');assert.equal(card.children.find(c=>c.className==='platform-badges').children[0].textContent,'Switch');
 assert.equal(card.children.some(c=>c.href?.startsWith('javascript:')),false);
 await card.children.find(c=>c.tag==='button').events.click();
 assert.deepEqual(JSON.parse(calls[1].options.body),{id:'11000000-0000-4000-8000-000000000001',provider:'wikidata',external_id:'Q123'});
 assert.ok(events.includes('game-following-changed'));assert.match(nodes.finderMessage.textContent,/登録しました/);
});
test('known favorites appear once and provider failures remain distinct from an empty search',async()=>{
 const game={id:'existing',title:'同じ作品',is_favorite:true};
 const {nodes}=await setup({games:[game],results:[{provider:'wikidata',title:game.title,game}],sources:[{name:'全機種の作品データ',available:false,count:0}]});
 assert.equal(nodes.finderResults.children.filter(c=>c.className==='finder-result').length,1);
 assert.match(nodes.finderMessage.textContent,/取得できませんでした/);
 assert.equal(nodes.finderResults.children.find(c=>c.className==='finder-result').children.some(c=>c.tag==='button'),false);
 assert.equal(nodes.finderResults.children.at(-1).tag,'details');
});
