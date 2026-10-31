import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSettings } from '../lib/site-settings.js';
import editorSettings from '../api/editor-settings.js';
import editorNews from '../api/editor-news.js';
import news from '../api/news.js';
import collect from '../api/collect-game-news.js';
import { newsSources } from '../lib/news-sources.js';
import { createEditorToken } from '../lib/editor-auth.js';
const settings = { editor_page_size: 7, public_page_size: 10, nintendo_limit: 20, playstation_limit: 0 };
process.env.EDITOR_SECRET = 'settings-test';
process.env.SUPABASE_URL = 'https://db.invalid';
process.env.SUPABASE_SECRET_KEY = 'secret-test';
process.env.SUPABASE_PUBLISHABLE_KEY = 'public-test';
process.env.CRON_SECRET = 'cron-test';
const headers = { cookie: `ilovegame_editor=${createEditorToken(process.env.EDITOR_SECRET)}`, origin: 'https://site.invalid', host: 'site.invalid' };
const response = () => ({ setHeader() {}, status(code) {this.code=code;return this;}, json(body) {this.body=body;return this;} });
async function mockFetch(fn, run) { const original=globalThis.fetch;globalThis.fetch=fn;try {await run();}finally{globalThis.fetch=original;} }
test('settings enforce independent integer bounds and reject unknown keys', () => {
 assert.deepEqual(validateSettings(settings),settings);
 for (const data of [{...settings,public_page_size:0},{...settings,editor_page_size:0},{...settings,editor_page_size:101},{...settings,nintendo_limit:101},{...settings,playstation_limit:1.5},{...settings,public_page_size:'20'},{...settings,extra:1}]) assert.equal(validateSettings(data),null);
 assert.ok(validateSettings({...settings,public_page_size:100,nintendo_limit:0}));
});
test('unauthenticated and cross-origin saves do not touch database', async () => {
 await mockFetch(()=>{throw Error('unexpected fetch');},async()=>{
  for(const [req,code] of [[{method:'GET',headers:{}},401],[{method:'POST',headers:{...headers,origin:'https://evil.invalid'},body:settings},403],[{method:'POST',headers,body:{...settings,nintendo_limit:-1}},400]]){
   const res=response();await editorSettings(req,res);assert.equal(res.code,code);
  }
 });
});
test('settings save updates only the singleton settings record', async () => {
 await mockFetch(async(url,options)=>{
  assert.ok(url.includes('/site_settings?id=eq.1'));
  assert.equal(options.method,'PATCH');
  assert.equal(JSON.parse(options.body).playstation_limit,0);
  return new Response(JSON.stringify([settings]));
 },async()=>{const res=response();await editorSettings({method:'POST',headers,body:settings},res);assert.equal(res.code,200);});
});
test('public pagination uses configured size and corrects a page beyond the new last page', async () => {
 const calls=[];
 await mockFetch(async(url,options)=>{
  const u=new URL(url);calls.push(u);
  if(u.pathname.endsWith('/site_settings'))return new Response(JSON.stringify([settings]));
  assert.equal(options.headers.apikey,'public-test');
  return new Response(JSON.stringify(u.searchParams.get('offset')==='20'?[{id:1}]:[]),{status:u.searchParams.get('offset')==='20'?200:416,headers:{'content-range':'*/25'}});
 },async()=>{
  const res=response();await news({query:{page:'100'}},res);
  assert.equal(res.code,200);assert.equal(res.body.page,3);assert.equal(res.body.limit,10);assert.equal(res.body.total,25);assert.equal(res.body.articles.length,1);
  assert.equal(calls[2].searchParams.get('offset'),'20');
 });
});
test('article detail does not depend on the settings table', async () => {
 await mockFetch(async url=>{assert.ok(!url.includes('/site_settings'));return new Response(JSON.stringify([{id:1}]));},async()=>{
  const res=response();await news({query:{id:'1'}},res);assert.equal(res.body.id,1);
 });
});
test('collector receives configured limit and skips zero-limit sources', async () => {
 const nintendo=newsSources.nintendo.collect,ps=newsSources.playstation.collect;
 newsSources.nintendo.collect=async limit=>{assert.equal(limit,7);return [];};
 newsSources.playstation.collect=async()=>{throw Error('disabled collector called');};
 try{
  await mockFetch(async()=>new Response(JSON.stringify([{...settings,nintendo_limit:7}])),async()=>{
   const res=response();await collect({method:'GET',headers:{authorization:'Bearer cron-test'},query:{}},res);
   assert.equal(res.code,200);assert.equal(res.body.sources[0].maxArticles,7);assert.equal(res.body.sources[1].skipped,true);
  });
 }finally{newsSources.nintendo.collect=nintendo;newsSources.playstation.collect=ps;}
});

test('editor pagination is independent and clamps pages while preserving filters', async () => {
 const calls=[];
 await mockFetch(async url=>{
  const u=new URL(url);calls.push(u);
  if(u.pathname.endsWith('/site_settings')) return new Response(JSON.stringify([settings]));
  if(u.searchParams.get('limit')==='0') return new Response('[]',{headers:{'content-range':'*/15'}});
  assert.equal(u.searchParams.get('limit'),'7');
  assert.equal(u.searchParams.get('status'),'eq.pending');
  if(u.searchParams.get('offset')==='14') return new Response('[{"id":1}]');
  return new Response('{}',{status:416,headers:{'content-range':'*/15'}});
 },async()=>{
  const res=response();await editorNews({method:'GET',headers,query:{page:'100',status:'pending'}},res);
  assert.equal(res.code,200);assert.equal(res.body.limit,7);assert.equal(res.body.page,3);
  assert.equal(res.body.total,15);assert.equal(res.body.articles[0].id,1);
 });
});
test('editor session check does not require settings or database', async () => {
 await mockFetch(()=>{throw Error('unexpected database access');},async()=>{
  const res=response();await editorNews({method:'GET',headers,query:{auth:'check'}},res);
  assert.equal(res.code,200);assert.equal(res.body.authenticated,true);
 });
});
