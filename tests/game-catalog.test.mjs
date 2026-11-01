import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/editor-games.js';
import { readGameInput, readGameQuery } from '../lib/game-catalog-input.js';
import { createEditorToken } from '../lib/editor-auth.js';
process.env.EDITOR_SECRET='catalog-test';
process.env.SUPABASE_URL='https://catalog.invalid';
process.env.SUPABASE_SECRET_KEY='test-server-key';
process.env.GAME_CATALOG_ENABLED='true';
const id='00000000-0000-0000-0000-000000000001';
const headers={cookie:`ilovegame_editor=${createEditorToken(process.env.EDITOR_SECRET)}`,host:'site.invalid',origin:'https://site.invalid'};
const game={id,title:' Test game ',original_title:' Original ',description:'Notes',source_url:'https://example.org/game#fragment',source_type:'official'};
const response=()=>({setHeader(name,value){(this.headers??={})[name]=value;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
async function withFetch(fn,run) { const original=globalThis.fetch;globalThis.fetch=fn;try{await run();}finally{globalThis.fetch=original;} }
const req=(method,body,query={})=>({method,headers,body,query});

test('catalog input strips fragments, rejects untrusted fields and unsafe URLs',()=>{
 assert.deepEqual(readGameInput(game),{...game,title:'Test game',original_title:'Original',source_url:'https://example.org/game'});
 for(const data of [null,[],{...game,id:'1'},{...game,title:' '},{...game,title:'x'.repeat(301)}, {...game,original_title:'x'.repeat(301)},{...game,description:'x'.repeat(5001)}, {...game,status:'published'},{...game,source_type:'random'},...['javascript:alert(1)','file:///tmp/a','https://user:password@example.org'].map(source_url=>({...game,source_url}))]) assert.equal(readGameInput(data),null);
});
test('catalog query validates bounded pagination and exact article identifiers',()=>{
 assert.deepEqual(readGameQuery({q:' title ',page:'2',article_id:'123'}),{q:'title',page:2,articleId:123});
 for(const q of [{page:'0'},{page:'1e3'},{page:'10002'},{q:['a']},{q:'x'.repeat(101)},{article_id:'1x'},{article_id:'9007199254740993'},{extra:'ignored?'}]) assert.equal(readGameQuery(q),null);
});
test('authorization, origin, feature flag and validation fail before any DB request',async()=>{
 await withFetch(()=>{throw new Error('unexpected database access');},async()=>{
  for(const [request,code] of [[{...req('GET'),headers:{}},401],[{...req('POST',{action:'create',game}),headers:{...headers,origin:'https://evil.invalid'}},403],[req('DELETE'),405],[req('GET',null,{q:['a']}),400],[req('POST',{action:'create',game:{...game,status:'published'}}),400],[req('POST',{action:'unlink',article_id:1,game_id:'eq.1'}),400],[req('POST',{action:'unlink',article_id:1,game_id:id,extra:true}),400]]) {
   const res=response();await handler(request,res);assert.equal(res.code,code);assert.equal(res.headers['Cache-Control'],'no-store');
  }
  process.env.GAME_CATALOG_ENABLED='false';
  try{const res=response();await handler(req('GET'),res);assert.equal(res.code,503);}finally{process.env.GAME_CATALOG_ENABLED='true';}
 });
});
test('creation is one transactional RPC with a stable ID and no publication fields',async()=>{
 let calls=0;
 await withFetch(async(url,options)=>{
  calls++;assert.equal(url,'https://catalog.invalid/rest/v1/rpc/create_editor_game');
  assert.equal(options.headers.apikey,'test-server-key');
  assert.deepEqual(JSON.parse(options.body),{p_id:id,p_title:'Test game',p_original_title:'Original',p_description:'Notes',p_source_url:'https://example.org/game',p_source_type:'official'});
  return Response.json({id,title:'Test game',status:'draft'});
 },async()=>{const res=response();await handler(req('POST',{action:'create',game}),res);assert.equal(res.code,200);assert.equal(res.body.game.status,'draft');});
 assert.equal(calls,1);
});
test('search and linked works use catalog reads, with no article-content queries',async()=>{
 const calls=[];
 await withFetch(async(url,options)=>{
  const u=new URL(url);calls.push(u);
  if(u.pathname.endsWith('/rpc/search_editor_games')) {
   assert.deepEqual(JSON.parse(options.body),{p_query:'%,(title)',p_offset:20});
   return Response.json(Array.from({length:21},(_,i)=>({id:`game-${i}`})));
  }
  assert.equal(u.pathname,'/rest/v1/article_games');assert.equal(u.searchParams.get('article_id'),'eq.42');
  return Response.json([{game:{id,title:'Linked game'}}]);
 },async()=>{
  const res=response();await handler(req('GET',null,{q:'%,(title)',page:'2',article_id:'42'}),res);
  assert.equal(res.code,200);assert.equal(res.body.games.length,20);assert.equal(res.body.hasMore,true);assert.equal(res.body.linkedGames[0].id,id);
 });assert.equal(calls.length,2);
});
test('link retries insert only the pair; unlink scopes deletion to the same pair',async()=>{
 const calls=[];
 await withFetch(async(url,options)=>{
  const u=new URL(url);calls.push(options.method);
  assert.equal(u.pathname,'/rest/v1/article_games');
  if(options.method==='POST') {
   assert.equal(options.headers.Prefer,'resolution=ignore-duplicates,return=minimal');
   assert.deepEqual(JSON.parse(options.body),{article_id:42,game_id:id});
  }else{assert.equal(u.searchParams.get('article_id'),'eq.42');assert.equal(u.searchParams.get('game_id'),`eq.${id}`);}
  return new Response(null,{status:204});
 },async()=>{
  for(const action of ['link','link','unlink']) {const res=response();await handler(req('POST',{action,article_id:42,game_id:id}),res);assert.equal(res.code,200);}
 });assert.deepEqual(calls,['POST','POST','DELETE']);
});
test('DB conflicts and outages are surfaced without leaking DB response details',async()=>{
 for(const [status,code] of [[409,409],[500,502]]) await withFetch(async()=>new Response('sensitive SQL diagnostics',{status}),async()=>{
  const res=response();await handler(req('POST',{action:'create',game}),res);assert.equal(res.code,code);assert.ok(!JSON.stringify(res.body).includes('sensitive'));
 });
});
