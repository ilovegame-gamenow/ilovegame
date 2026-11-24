import test from 'node:test';
import assert from 'node:assert/strict';
import news from '../api/news.js';
import {getNewsFeed} from '../lib/news-feed.js';
import {getFeaturedNews} from '../lib/featured-news.js';
import {getPublicDisplaySettings,getSiteSettings,settingRules} from '../lib/site-settings.js';
import {createPublicReadCache} from '../lib/public-read-cache.js';

const settings={...Object.fromEntries(Object.entries(settingRules).map(([k,v])=>[k,v.defaultValue])),public_page_size:2,pickup_max_articles:2};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const env=()=>{process.env.SUPABASE_URL='https://performance.invalid';process.env.SUPABASE_SECRET_KEY='secret';process.env.SUPABASE_PUBLISHABLE_KEY='public';};
const withFetch=async(mock,run)=>{const previous=globalThis.fetch;globalThis.fetch=mock;try{await run();}finally{globalThis.fetch=previous;}};

test('ALL transfers one page and count rather than all metadata, with shared featured exclusion',async()=>{
  let calls=0;
  await withFetch(async(url,options)=>{
    calls++;const p=new URL(url).searchParams;
    assert.equal(p.get('limit'),'2');assert.equal(p.get('offset'),'2');
    assert.equal(p.get('id'),'not.in.(7,8)');assert.equal(options.headers.Prefer,'count=exact');
    assert.ok(p.get('select').includes('thumbnail_url'));assert.ok(!p.get('select').includes('article_body'));
    return Response.json([{id:3},{id:4}],{headers:{'content-range':'2-3/50000'}});
  },async()=>{
    const result=await getNewsFeed('https://large.invalid','public','secret',settings,{page:'2'},{breaking:{id:7},pickup:[{id:8}]});
    assert.equal(result.total,50000);assert.equal(result.page,2);assert.equal(result.articles.length,2);assert.equal(calls,1);
  });
});
test('out-of-range pages clamp from 416 counts; inclusion restores featured and MOVIE is case insensitive',async()=>{
  const offsets=[];
  await withFetch(async(url)=>{
    const p=new URL(url).searchParams;offsets.push(p.get('offset'));
    assert.equal(p.has('id'),false);assert.equal(p.get('category'),'ilike.MOVIE');
    return Response.json(offsets.length===1?{}:[{id:5}],{status:offsets.length===1?416:200,headers:{'content-range':'*/5'}});
  },async()=>{
    const result=await getNewsFeed('https://movie.invalid','public','secret',settings,{filter:'movie',page:'99',include_featured:'1'},{breaking:{id:5},pickup:[]});
    assert.deepEqual(offsets,['196','4']);assert.equal(result.page,3);assert.equal(result.total,5);assert.equal(result.articles[0].id,5);
  });
});
test('search indexes and links start together before settings/selections resolve; NFKC and literal matches survive',async()=>{
  let releaseSettings,releaseFeatures;const started=[];
  const display=new Promise(resolve=>{releaseSettings=resolve;}),featured=new Promise(resolve=>{releaseFeatures=resolve;});
  await withFetch(async url=>{
    const u=new URL(url);started.push(u.pathname);
    if(u.pathname.endsWith('/article_games'))return Response.json([{article_id:9,game:{title:'Ｇａｌａｘｙ',original_title:'Galaxy'}}]);
    if(u.searchParams.has('offset'))return Response.json([{id:9,title:'宇宙',game_title:''},{id:10,title:'100%遊べる'}]);
    assert.equal(u.searchParams.get('id'),'in.(9)');return Response.json([{id:9,title:'宇宙'}]);
  },async()=>{
    const task=getNewsFeed('https://search-parallel.invalid','public','secret',display,{q:'GALAXY',filter:'movie'},featured);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(started.length,2);releaseSettings(settings);releaseFeatures({breaking:{id:9},pickup:[]});
    const result=await task;assert.equal(result.total,1);assert.equal(result.articles[0].id,9);assert.equal(result.include_featured,true);assert.equal(result.filter,'all');
  });
});
test('public cache coalesces requests, expires, bounds entries and never caches failures',async()=>{
  let now=0,calls=0;const read=createPublicReadCache({ttl:10,maxEntries:2,now:()=>now});
  const load=async()=>++calls;
  assert.deepEqual(await Promise.all([read('a',load),read('a',load)]),[1,1]);
  now=10;assert.equal(await read('a',load),2);
  await read('b',load);await read('c',load);assert.equal(await read('a',load),5);
  await assert.rejects(read('bad',async()=>{throw Error('offline');}));
  assert.equal(await read('bad',load),6);
});
test('public settings transfer only display fields; publication-policy reads stay uncached and complete',async()=>{
  const selects=[];
  await withFetch(async url=>{selects.push(new URL(url).searchParams.get('select'));return Response.json([settings]);},async()=>{
    const display=await getPublicDisplaySettings('https://db.invalid','secret');
    assert.deepEqual(Object.keys(display),['public_page_size','pickup_max_articles','breaking_max_age_hours','pickup_max_age_days']);
    await getSiteSettings('https://db.invalid','secret');await getSiteSettings('https://db.invalid','secret');
    assert.equal(selects.length,3);assert.equal(selects[0],'public_page_size,pickup_max_articles,breaking_max_age_hours,pickup_max_age_days');assert.ok(selects[1].includes('publish_threshold'));assert.ok(selects[1].includes('evaluation_guidelines'));
  });
});
test('home overlaps settings and slots, publishes timings, caches only successful GETs',async()=>{
  env();let resolveSettings;const started=[];
  const pending=new Promise(resolve=>{resolveSettings=resolve;});
  await withFetch(async(url)=>{
    const u=new URL(url);started.push(u.pathname);
    if(u.pathname.endsWith('/site_settings')){await pending;return Response.json([settings]);}
    if(u.pathname.endsWith('/article_feature_slots'))return Response.json([]);
    return Response.json([{id:1}],{headers:{'content-range':'0-0/1'}});
  },async()=>{
    const r=response(),task=news({method:'GET',query:{view:'home'}},r);
    await new Promise(resolve=>setImmediate(resolve));assert.ok(started.some(p=>p.endsWith('/site_settings')));assert.ok(started.some(p=>p.endsWith('/article_feature_slots')));
    resolveSettings();await task;assert.equal(r.code,200);assert.equal(r.headers['Vercel-CDN-Cache-Control'],'public, s-maxage=15');assert.match(r.headers['Server-Timing'],/home;dur=/);
  });
  await withFetch(async url=>{
    const u=new URL(url);if(u.pathname.endsWith('/site_settings'))return Response.json([settings]);
    if(u.pathname.endsWith('/article_feature_slots'))return new Response('offline',{status:502});
    return Response.json([{id:1}],{headers:{'content-range':'0-0/1'}});
  },async()=>{const r=response();await news({method:'GET',query:{view:'home'}},r);assert.equal(r.body.featured,null);assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(r.headers['Vercel-CDN-Cache-Control'],undefined);});
});
test('featured expiry and breaking age cap cache lifetime; private slot fields never leave the selector',async()=>{
  env();const expires=new Date(Date.now()+500).toISOString();
  await withFetch(async url=>{
    const u=new URL(url);if(u.pathname.endsWith('/site_settings'))return Response.json([settings]);
    if(u.pathname.endsWith('/article_feature_slots'))return Response.json([{article_id:7,slot:'breaking',selected_at:new Date().toISOString(),expires_at:expires}]);
    if(u.searchParams.get('id')?.startsWith('in.'))return Response.json([{id:7,title:'速報'}]);
    return Response.json([],{headers:{'content-range':'*/0'}});
  },async()=>{
    const times=[];const selected=await getFeaturedNews(process.env.SUPABASE_URL,'public','secret',Promise.resolve(settings),{onExpiry:t=>times.push(t)});
    assert.equal(selected.breaking.id,7);assert.ok(times.includes(Date.parse(expires)));assert.equal(selected.breaking.expires_at,undefined);
    const r=response();await news({method:'GET',query:{view:'home'}},r);assert.equal(r.code,200);assert.equal(r.headers['Vercel-CDN-Cache-Control'],undefined);
  });
});

test('daily pickup ranks take priority over newer unranked discoveries',async()=>{
 const now=Date.now(),expires=new Date(now+86400000).toISOString();
 const slots=[{article_id:9,slot:'discovery',selected_at:new Date(now-100).toISOString(),expires_at:expires,pickup_rank:null},{article_id:2,slot:'discovery',selected_at:new Date(now-1000).toISOString(),expires_at:expires,pickup_rank:2},{article_id:1,slot:'discovery',selected_at:new Date(now-2000).toISOString(),expires_at:expires,pickup_rank:1}];
 await withFetch(async url=>new URL(url).pathname.endsWith('/article_feature_slots')?Response.json(slots):Response.json([{id:9},{id:2},{id:1}]),async()=>{
  const result=await getFeaturedNews('https://example.invalid','public','secret',settings);assert.deepEqual(result.pickup.map(a=>a.id),[1,2]);
 });
});
test('pickup hides expired candidates and prioritizes fresh high-score discoveries',async()=>{
 const now=Date.now(),day=86400000,expires=new Date(now+day).toISOString();
 const slots=[{article_id:1,slot:'discovery',selected_at:new Date(now-4*day).toISOString(),expires_at:expires,pickup_rank:1},{article_id:2,slot:'discovery',selected_at:new Date(now-day).toISOString(),expires_at:expires,pickup_rank:2},{article_id:3,slot:'discovery',selected_at:new Date(now).toISOString(),expires_at:expires,pickup_rank:null}];
 await withFetch(async url=>new URL(url).pathname.endsWith('/article_feature_slots')?Response.json(slots):Response.json([{id:1},{id:2},{id:3,importance:95}]),async()=>{
  const result=await getFeaturedNews('https://example.invalid','public','secret',settings);assert.deepEqual(result.pickup.map(a=>a.id),[3,2]);assert.equal(result.pickup[0].importance,undefined);
 });
});
