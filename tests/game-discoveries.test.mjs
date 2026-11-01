import test from 'node:test';import assert from 'node:assert/strict';
import handler from '../api/editor-games.js';
import {readDiscovery,readDiscoveryReview,readDiscoveryQuery} from '../lib/game-discovery-input.js';
import {createEditorToken} from '../lib/editor-auth.js';
process.env.EDITOR_SECRET='discovery-test';process.env.SUPABASE_URL='https://db.invalid';process.env.SUPABASE_SECRET_KEY='server-test';
process.env.GAME_CATALOG_ENABLED='true';process.env.GAME_DISCOVERIES_ENABLED='true';
const id='10000000-0000-0000-0000-000000000001';
const candidate={id,title:'Candidate',original_title:'',description:'Summary',reason:'Interesting feature',source_url:'https://example.org/game',source_type:'official'};
const headers={cookie:`ilovegame_editor=${createEditorToken(process.env.EDITOR_SECRET)}`,host:'site.invalid',origin:'https://site.invalid'};
const res=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
async function mock(fn,run){const old=fetch;globalThis.fetch=fn;try{await run();}finally{globalThis.fetch=old;}}
const request=(method,body,query={})=>({method,body,headers,query:{resource:'discoveries',...query}});
test('discovery validation reuses catalog rules and forbids adoption/provenance injection',()=>{
 assert.ok(readDiscovery(candidate));
 for(const input of [{...candidate,reason:''},{...candidate,reason:'x'.repeat(2001)},{...candidate,discovered_by:'ai'},{...candidate,status:'adopted'},{...candidate,source_url:'javascript:alert(1)'}])assert.equal(readDiscovery(input),null);
 assert.ok(readDiscoveryReview({id,action:'adopt_new'}));assert.ok(readDiscoveryReview({id,action:'adopt_existing',game_id:id}));
 assert.equal(readDiscoveryReview({id,action:'hold',game_id:id}),null);assert.equal(readDiscoveryReview({id,action:'adopt_existing'}),null);
 assert.equal(readDiscoveryQuery({status:'all'}),null);assert.equal(readDiscoveryQuery({page:'10002'}),null);
});
test('discovery routes preserve auth/origin checks and remain off without their flag',async()=>{
 await mock(()=>{throw Error('Unexpected DB request');},async()=>{
  for(const [req,expected] of [[{...request('GET'),headers:{}},401],[{...request('POST',{action:'register',candidate}),headers:{...headers,origin:'https://evil.invalid'}},403],[request('GET',null,{status:'unknown'}),400],[request('POST',{action:'adopt_existing',id}),400],[request('POST',{action:'register',candidate:{...candidate,status:'adopted'}}),400]]){const r=res();await handler(req,r);assert.equal(r.code,expected);}
  delete process.env.GAME_DISCOVERIES_ENABLED;
  try{const r=res();await handler(request('GET'),r);assert.equal(r.code,503);}finally{process.env.GAME_DISCOVERIES_ENABLED='true';}
 });
});
test('candidate list uses one parameterized RPC and bounded pages',async()=>{
 await mock(async(url,options)=>{assert.ok(url.endsWith('/rpc/list_game_discoveries'));assert.deepEqual(JSON.parse(options.body),{p_status:'held',p_offset:20});return Response.json(Array.from({length:21},()=>candidate));},async()=>{const r=res();await handler(request('GET',null,{status:'held',page:'2'}),r);assert.equal(r.code,200);assert.equal(r.body.candidates.length,20);assert.equal(r.body.hasMore,true);});
});
test('registration and adoption call dedicated atomic RPCs without article writes',async()=>{
 const paths=[];
 await mock(async(url,options)=>{paths.push(new URL(url).pathname);const body=JSON.parse(options.body);if(url.endsWith('/review_game_discovery'))assert.deepEqual(body,{p_id:id,p_action:'adopt_existing',p_game_id:id});else assert.equal(body.p_reason,candidate.reason);return Response.json({...candidate,status:'pending'});},async()=>{
  let r=res();await handler(request('POST',{action:'register',candidate}),r);assert.equal(r.code,200);
  r=res();await handler(request('POST',{action:'adopt_existing',id,game_id:id}),r);assert.equal(r.code,200);
 });assert.deepEqual(paths,['/rest/v1/rpc/register_game_discovery','/rest/v1/rpc/review_game_discovery']);
});
test('stale review conflicts are surfaced without leaking database internals',async()=>{
 await mock(async()=>new Response('SQL secrets',{status:409}),async()=>{const r=res();await handler(request('POST',{id,action:'adopt_new'}),r);assert.equal(r.code,409);assert.ok(!JSON.stringify(r.body).includes('SQL secrets'));});
});
