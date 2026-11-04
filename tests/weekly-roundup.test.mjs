import test from 'node:test';
import assert from 'node:assert/strict';
import {addWeeklyEditorial} from '../lib/weekly-roundup.js';
import {readCalendarQuery,handleCalendar} from '../lib/release-calendar.js';
import {renderWeeklyRoundup} from '../weekly-roundup-view.js';

const id='8eaad6af-b378-4e1d-b73e-de226b46d2cc';
const release={game:{id,title:'<ゲーム>'},date:'2026-11-06',precision:'day',kind:'full',region:'JP',platforms:[{code:'windows',name:'Steam'}],sources:[{url:'https://official.invalid'}]};
test('roundup uses the same Tokyo week across year boundaries and rejects a month override',()=>{
 const now=new Date('2026-12-31T16:00:00Z');
 assert.equal(readCalendarQuery({view:'roundup'},now).start,readCalendarQuery({view:'week'},now).start);
 assert.equal(readCalendarQuery({view:'roundup',month:'2026-12'},now),null);
});
test('weekly copy/media come only from explicit links and the public articles view',async()=>{
 const old=globalThis.fetch,calls=[];
 globalThis.fetch=async input=>{
  const url=new URL(input);calls.push(url.pathname);
  if(url.pathname.endsWith('/article_games'))return new Response(JSON.stringify([{game_id:id,article_id:1},{game_id:id,article_id:2},{game_id:id,article_id:3},{game_id:'unrelated',article_id:99}]));
  assert.ok(url.pathname.endsWith('/published_articles'));
  assert.equal(url.searchParams.get('id'),'in.(1,2,3)');
  // Linked article 3 is not publicly visible, so the view excludes it.
  return new Response(JSON.stringify([
   {id:1,summary:'以前の紹介',site_published_at:'2026-11-01'},
   {id:2,summary:'公開中の紹介',ilovegame_point:'注目点♪',thumbnail_url:'https://image.invalid/public.jpg',article_body:'説明\n公式動画：https://youtu.be/Tb7mUhUhNlA\n公式動画：https://youtu.be/19xi1Td52T0',site_published_at:'2026-11-02'}
  ]));
 };
 try{
  const result=await addWeeklyEditorial('https://db.invalid','server-only',{releases:[release,{...release,date:'2026-11-07'},{...release,game:{id:'b0da9ffc-273a-4c04-99ea-2521423724d6',title:'別作品'}}]});
  assert.equal(result.releases[0].editorial.articleId,2);
  assert.equal(result.releases[0].editorial.videos.length,2);
  assert.equal(result.releases[1].editorial.articleId,2);
  assert.equal(result.releases[2].editorial,undefined);
  assert.equal(JSON.stringify(result).includes('server-only'),false);
  assert.equal(result.releases[0].editorial.article_body,undefined);
  assert.equal(calls.length,2);
 }finally{globalThis.fetch=old;}
});
test('empty weeks make no editorial requests and unsafe images are not returned',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=()=>{throw Error('Unexpected database request');};
 try{assert.deepEqual(await addWeeklyEditorial('https://db.invalid','key',{releases:[]}),{releases:[]});}
 finally{globalThis.fetch=old;}
 globalThis.fetch=async url=>new Response(JSON.stringify(url.includes('article_games?')?[{game_id:id,article_id:1}]:[{id:1,thumbnail_url:'javascript:alert(1)'}]));
 try{assert.equal((await addWeeklyEditorial('https://db.invalid','key',{releases:[release]})).releases[0].image,null);}
 finally{globalThis.fetch=old;}
});

class Element{
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.className='';this.classList={add:name=>{this.className+=' '+name;}};}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;}
 insertBefore(item,before){const i=this.children.indexOf(before);if(i<0)this.children.push(item);else this.children.splice(i,0,item);}
 get firstChild(){return this.children[0];}
 querySelector(selector){return this.children.find(c=>c.className.split(' ').includes(selector.slice(1)))??null;}
 addEventListener(event,handler){this.listeners[event]=handler;}
}
test('roundup renders safe text, platform-specific dates, immediate videos, empty and partial entries',()=>{
 const old=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 const entries=new Element('div'),toc=new Element('nav');
 try{
  renderWeeklyRoundup({releases:[{...release,date:'2026-11-07',kind:'early_access'},{...release,image:'https://image.invalid/a.jpg',editorial:{articleId:2,summary:'<script>テキスト</script>',point:'注目♪',videos:['https://youtu.be/Tb7mUhUhNlA']}}]},entries,toc);
  assert.equal(entries.children.length,2);assert.equal(toc.children.length,2);assert.equal(toc.hidden,false);
  const card=entries.children[0].children[1];
  assert.equal(card.children.find(c=>c.tag==='h3').textContent,'<ゲーム>');
  const detail=card.children.find(c=>c.className==='roundup-detail');
  assert.equal(detail.children[0].textContent,'<script>テキスト</script>');
  const video=detail.children.find(c=>c.className==='official-video');assert.equal(video.children[0].children[0].tag,'iframe');
  assert.equal(detail.children.at(-1).href,'/article.html?id=2');
  const figure=card.children[0];figure.children[0].listeners.error();assert.equal(figure.hidden,true);
  assert.match(entries.children[1].children[0].textContent,/早期アクセス/);
  renderWeeklyRoundup({releases:[]},entries,toc);assert.equal(toc.hidden,true);assert.match(entries.children[0].textContent,/まだ登録されていません/);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('an editorial outage still returns verified release information with an explicit partial flag',async()=>{
 const oldFetch=globalThis.fetch,old={...process.env};
 process.env.GAME_CATALOG_ENABLED='true';process.env.SUPABASE_URL='https://db.invalid';process.env.SUPABASE_SECRET_KEY='key';
 const now=readCalendarQuery({view:'roundup'});
 globalThis.fetch=async url=>{
  if(url.includes('article_games?'))throw Error('Article link service unavailable');
  if(url.includes('game_platforms?'))return new Response('[]');
  return new Response(JSON.stringify([{release_date:now.start,date_precision:'day',release_kind:'full',region_code:'JP',status:'announced',verified_at:'2026-11-01',game:{id,title:'Game',status:'published'},platform:{code:'windows',name:'Steam'},source:{url:'https://official.invalid',source_type:'official',review_status:'verified',verified_at:'2026-11-01'}}]));
 };
 const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 try{await handleCalendar({method:'GET',query:{resource:'calendar',view:'roundup'}},res);assert.equal(res.code,200);assert.equal(res.body.detailsUnavailable,true);assert.equal(res.body.releases.length,1);}
 finally{globalThis.fetch=oldFetch;for(const k of ['GAME_CATALOG_ENABLED','SUPABASE_URL','SUPABASE_SECRET_KEY']){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
