import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleCalendar} from '../release-calendar-sample.js';
import {weekRange} from '../release-calendar-model.js';

class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.textContent='';this.hidden=false;this.listeners={};}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 addEventListener(event,handler){this.listeners[event]=handler;}
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('home weekly failures and retries stay independent from news and calendar query parameters',async()=>{
 const originals={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch};
 const ids=Object.fromEntries(['weekRange','retryWeek','weekList','weekMessage','weeklyDemo','calendarLink','latest'].map(id=>[id,new Element()]));
 ids.latest.textContent='Existing news remains visible';
 globalThis.document={getElementById:id=>ids[id],createElement:tag=>new Element(tag)};
 globalThis.location={search:'?page=3&month=2027-04&platform=windows&region=WW'};
 let calls=0;
 globalThis.fetch=async input=>{
  calls++;const u=new URL(input,'https://site.invalid');
  assert.equal(u.searchParams.get('resource'),'calendar');assert.equal(u.searchParams.get('view'),'week');assert.equal(u.searchParams.get('region'),'JP');
  assert.equal(u.searchParams.has('month'),false);assert.equal(u.searchParams.has('platform'),false);
  if(calls===1)throw Error('Weekly connection failed');
  const releases=calls===2?Array.from({length:100},(_,id)=>({game:{id},precision:'day'})):[];
  return new Response(JSON.stringify({platforms:[],releases,...weekRange()}));
 };
 try{
  await import(`../weekly-releases.js?test=${Date.now()}`);await settle();
  assert.equal(ids.weekMessage.textContent,'発売情報を取得できませんでした。');assert.equal(ids.retryWeek.hidden,false);assert.equal(ids.latest.textContent,'Existing news remains visible');
  await ids.retryWeek.listeners.click();
  assert.equal(calls,2);assert.equal(ids.retryWeek.hidden,true);assert.equal(ids.weekList.children.length,0);assert.match(ids.weekMessage.textContent,/登録済み 100作品/);assert.equal(ids.latest.textContent,'Existing news remains visible');
  await ids.retryWeek.listeners.click();
  assert.equal(calls,3);assert.equal(ids.weekList.children.length,0);assert.match(ids.weekMessage.textContent,/確認できた作品から追加/);
 }finally{for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
test('sample week and sample month share the same dates, platforms and grouping',()=>{
 const weekly=sampleCalendar({view:'week'}),months=[...new Set([weekly.start.slice(0,7),weekly.last.slice(0,7)])];
 const expected=months.flatMap(month=>sampleCalendar({month}).releases).filter(r=>r.precision==='day'&&r.date>=weekly.start&&r.date<weekly.end);
 assert.deepEqual(weekly.releases,expected);
 assert.ok(weekly.releases.every(r=>r.game.title.startsWith('サンプル：')));
});
