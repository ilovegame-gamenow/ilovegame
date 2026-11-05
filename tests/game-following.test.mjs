import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/editor-games.js';
import {createEditorToken} from '../lib/editor-auth.js';
const id='11000000-0000-4000-8000-000000000001';
process.env.EDITOR_SECRET='following-test';process.env.SUPABASE_URL='https://db.invalid';process.env.SUPABASE_SECRET_KEY='test';process.env.GAME_CATALOG_ENABLED='true';
const headers={cookie:`ilovegame_editor=${createEditorToken(process.env.EDITOR_SECRET)}`,host:'site.invalid',origin:'https://site.invalid'};
const response=()=>({setHeader(){},status(c){this.code=c;return this;},json(b){this.body=b;return this;}});
async function call(body,query={},method='POST',customHeaders=headers){const res=response();await handler({body,query,method,headers:customHeaders},res);return res;}
async function mocked(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{await run();}finally{globalThis.fetch=old;}}
test('following mutations require editor origin and accept only explicit reversible operations',async()=>{
 await mocked(()=>{throw Error('unexpected fetch');},async()=>{
  for(const b of [{action:'following',game_id:'bad',operation:'remove'},{action:'following',game_id:id,operation:'delete'},{action:'following',game_id:id,operation:'favorite_on',is_published:true}])assert.equal((await call(b)).code,400);
  assert.equal((await call({action:'following',game_id:id,operation:'remove'},{},'POST',{...headers,origin:'https://evil.invalid'})).code,403);
 });
 await mocked(async(url,o)=>{assert(url.endsWith('/rpc/set_game_following'));assert.deepEqual(JSON.parse(o.body),{p_game_id:id,p_action:'remove'});return Response.json({game_id:id,is_managed:false,is_favorite:false});},async()=>{const res=await call({action:'following',game_id:id,operation:'remove'});assert.equal(res.code,200);assert.equal(res.body.following.is_favorite,false);});
});
test('title finder keeps catalog search available when Steam fails; never fetches client URLs',async()=>{
 await mocked(async(url,o)=>{
  if(url.startsWith('https://db.invalid/')){assert.equal(JSON.parse(o.body).p_filter,'all');return Response.json([{id,title:'Title',is_favorite:true}]);}
  const u=new URL(url);assert.equal(u.origin,'https://store.steampowered.com');assert.equal(u.searchParams.get('term'),'Title & more');return new Response('',{status:503});
 },async()=>{const r=await call(null,{resource:'finder',q:'Title & more'},'GET');assert.equal(r.code,200);assert.equal(r.body.games.length,1);assert.equal(r.body.steamUnavailable,true);});
 assert.equal((await call(null,{resource:'finder',q:'x',url:'http://localhost/'},'GET')).code,400);
});
test('Steam registration refetches canonical data, rejects DLC and stores no client-authored facts',async()=>{
 let calls=0;
 await mocked(async(url,o)=>{calls++;if(url.startsWith('https://store.steampowered.com/'))return Response.json({123:{success:true,data:{type:'game',steam_appid:123,name:'Canonical title',short_description:'<b>Verified</b> description'}}});assert(url.endsWith('/rpc/create_followed_game'));const b=JSON.parse(o.body);assert.equal(b.p_title,'Canonical title');assert.equal(b.p_source_url,'https://store.steampowered.com/app/123/');assert(!b.p_description.includes('<b>'));return Response.json({id,title:b.p_title});},async()=>{assert.equal((await call({id,appid:123},{resource:'finder'})).code,200);});assert.equal(calls,2);
 await mocked(async()=>Response.json({123:{success:true,data:{type:'dlc',steam_appid:123,name:'DLC'}}}),async()=>{assert.equal((await call({id,appid:123},{resource:'finder'})).code,400);});
});
test('title-only registration is explicit, unpublished and idempotent through its own RPC',async()=>{
 await mocked(async(url,o)=>{assert(url.endsWith('/rpc/register_followed_title'));assert.deepEqual(JSON.parse(o.body),{p_id:id,p_title:'Switch title'});return Response.json({id,title:'Switch title',status:'draft'});},async()=>{const r=await call({id,title:' Switch title '},{resource:'finder'});assert.equal(r.code,200);assert.equal(r.body.game.status,'draft');});
});
