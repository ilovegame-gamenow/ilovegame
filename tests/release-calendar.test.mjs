import test from 'node:test';
import assert from 'node:assert/strict';
import {readCalendarQuery,loadCalendar} from '../lib/release-calendar.js';
import {monthRange,shiftMonth,tokyoMonth,weekRange,formatReleaseDate,calendarGroups} from '../release-calendar-model.js';
import news from '../api/news.js';
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const good={id:'release',release_date:'2026-11-12',date_precision:'day',release_kind:'full',region_code:'JP',status:'announced',verified_at:'2026-11-01',game:{id:'game',title:'A',status:'published'},platform:{code:'ps5',name:'PlayStation 5'},source:{url:'https://official.invalid/game',source_type:'official',review_status:'verified',verified_at:'2026-11-01',notes:'private'}};
async function mockFetch(fn,run){const original=globalThis.fetch;globalThis.fetch=fn;try{await run();}finally{globalThis.fetch=original;}}
test('calendar validates date-only month boundaries, leap years and Tokyo month',()=>{
 assert.deepEqual(monthRange('2026-12'),{start:'2026-12-01',end:'2027-01-01'});
 assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2024-03',-1),'2024-02');
 assert.equal(tokyoMonth(new Date('2026-10-31T16:00:00Z')),'2026-11');
 for(const query of [{month:'2026-13'},{month:['2026-11']},{month:'1800-01'},{month:'9999-01'},{month:'2026-11',platform:'ps5,foo'},{month:'2026-11',region:'US'},{extra:'x'}])assert.equal(readCalendarQuery(query),null);
});
test('public calendar excludes private, unverified, delayed and unsupported rows and exposes only allowed fields',async()=>{
 const hidden=[{game:{...good.game,status:'draft'}},{source:{...good.source,review_status:'rejected'}},{source:{...good.source,verified_at:null}},{source:{...good.source,source_type:'community'}},{source:{...good.source,url:'javascript:alert(1)'}},{verified_at:null},{status:'delayed'},{status:'cancelled'},{region_code:'WW'},{date_precision:'year'},{release_date:'2026-12-01'}].map(patch=>({...good,...patch}));
 await mockFetch(async(url,options)=>{
  assert.equal(options.method,undefined);assert.equal(options.headers.apikey,'server-only');
  const u=new URL(url);
  if(u.pathname.endsWith('/game_platforms'))return new Response(JSON.stringify([good.platform]));
  assert.equal(u.searchParams.get('game.status'),'eq.published');assert.equal(u.searchParams.get('source.review_status'),'eq.verified');assert.match(u.searchParams.get('select'),/games!inner/);assert.match(u.searchParams.get('select'),/game_sources!inner/);
  return new Response(JSON.stringify([good,...hidden]));
 },async()=>{
  const result=await loadCalendar('https://db.invalid','server-only',readCalendarQuery({month:'2026-11'}));
  assert.equal(result.releases.length,1);assert.equal(result.releases[0].game.title,'A');
  assert.equal(JSON.stringify(result).includes('private'),false);assert.equal(JSON.stringify(result).includes('server-only'),false);
 });
});
test('multi-platform releases combine while different dates, regions, monthly dates and early access stay separate',()=>{
 const r={game:{id:'a',title:'A'},date:'2026-11-12',precision:'day',kind:'full',region:'JP',platform:{code:'ps5',name:'PS5'},source:{url:'https://official.invalid'}};
 const result=calendarGroups([r,r,{...r,platform:{code:'windows',name:'Windows'}},{...r,date:'2026-11-20'},{...r,kind:'early_access'},{...r,region:'WW'},{...r,precision:'month',date:'2026-11-01'}]);
 assert.equal(result.length,5);const shared=result.find(x=>x.date===r.date&&x.kind==='full'&&x.region==='JP');assert.equal(shared.platforms.length,2);assert.equal(shared.sources.length,1);
});
test('calendar reports bounded results instead of silently omitting overflow',async()=>{
 let pages=0;
 await mockFetch(async url=>{
  if(url.includes('game_platforms?'))return new Response('[]');
  pages++;return new Response(JSON.stringify(Array.from({length:500},(_,i)=>({...good,id:String(i)}))));
 },async()=>{const result=await loadCalendar('https://db.invalid','key',readCalendarQuery({month:'2026-11'}));assert.equal(result.truncated,true);assert.equal(pages,5);});
});
test('public API dispatch rejects unsupported methods, query fields and disabled catalog without database access',async()=>{
 const original=process.env.GAME_CATALOG_ENABLED;process.env.GAME_CATALOG_ENABLED='false';
 try{await mockFetch(()=>{throw Error('unexpected fetch');},async()=>{
  for(const [req,code] of [[{method:'POST',query:{resource:'calendar'}},405],[{method:'GET',query:{resource:'calendar',id:'1'}},400],[{method:'GET',query:{resource:'calendar',month:'2026-11'}},503],[{method:'GET',query:{resource:'unexpected'}},400]]){
   const res=response();await news(req,res);assert.equal(res.code,code);
  }
 });}finally{if(original===undefined)delete process.env.GAME_CATALOG_ENABLED;else process.env.GAME_CATALOG_ENABLED=original;}
});
test('enabled public calendar responds with empty data without writing or calling AI',async()=>{
 const old={...process.env};process.env.GAME_CATALOG_ENABLED='true';process.env.SUPABASE_URL='https://db.invalid';process.env.SUPABASE_SECRET_KEY='server-only';
 try{await mockFetch(async(url,options)=>{assert.ok(url.startsWith('https://db.invalid/rest/v1/game_'));assert.equal(options.method,undefined);return new Response('[]');},async()=>{
  const res=response();await news({method:'GET',query:{resource:'calendar',month:'2026-11'}},res);assert.equal(res.code,200);assert.deepEqual(res.body.releases,[]);assert.equal(res.body.truncated,false);
 });}finally{for(const key of ['GAME_CATALOG_ENABLED','SUPABASE_URL','SUPABASE_SECRET_KEY']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});

test('current week uses Tokyo Monday to Sunday across months, leap day and year boundaries',()=>{
 assert.deepEqual(weekRange(new Date('2026-11-01T16:00:00Z')),{start:'2026-11-02',end:'2026-11-09',last:'2026-11-08'});
 assert.deepEqual(weekRange(new Date('2026-11-01T14:00:00Z')),{start:'2026-10-26',end:'2026-11-02',last:'2026-11-01'});
 assert.deepEqual(weekRange(new Date('2027-01-01T00:00:00Z')),{start:'2026-12-28',end:'2027-01-04',last:'2027-01-03'});
 assert.equal(weekRange(new Date('2024-02-29T00:00:00Z')).end,'2024-03-04');
 assert.equal(formatReleaseDate('2026-11-03'),'11月3日');
 assert.equal(formatReleaseDate('2027-01-01'),'1月1日');
 assert.equal(readCalendarQuery({view:'week',month:'2026-11'}),null);
 assert.equal(readCalendarQuery({view:'arbitrary'}),null);
});
test('weekly data spans month boundaries, excludes monthly precision and the following Monday',async()=>{
 const query=readCalendarQuery({view:'week'},new Date('2026-11-01T00:00:00Z'));
 assert.equal(query.start,'2026-10-26');assert.equal(query.end,'2026-11-02');
 const records=[{...good,release_date:'2026-10-31'},{...good,release_date:'2026-11-01'}, {...good,release_date:'2026-11-02'}, {...good,release_date:'2026-11-01',date_precision:'month'}];
 await mockFetch(async url=>{
  const u=new URL(url);if(u.pathname.endsWith('game_platforms'))return new Response('[]');
  assert.equal(u.searchParams.get('date_precision'),'eq.day');
  assert.equal(u.searchParams.get('and'),'(release_date.gte.2026-10-26,release_date.lt.2026-11-02)');
  return new Response(JSON.stringify(records));
 },async()=>{
  const result=await loadCalendar('https://db.invalid','key',query);
  assert.deepEqual(result.releases.map(r=>r.date),['2026-10-31','2026-11-01']);
  assert.equal(result.last,'2026-11-01');assert.equal(result.view,'week');
 });
});
