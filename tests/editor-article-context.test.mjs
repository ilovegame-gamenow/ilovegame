import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/editor-games.js';
import {createEditorToken} from '../lib/editor-auth.js';
const id='00000000-0000-0000-0000-000000000001';
process.env.EDITOR_SECRET='context-test';process.env.SUPABASE_URL='https://db.invalid';process.env.SUPABASE_SECRET_KEY='server-secret';process.env.GAME_CATALOG_ENABLED='true';
const headers={cookie:`ilovegame_editor=${createEditorToken('context-test')}`};
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
async function run(query,fetcher,extra={}){const old=globalThis.fetch;globalThis.fetch=fetcher;try{const res=response();await handler({method:'GET',headers,query:{resource:'context',...query},...extra},res);return res;}finally{globalThis.fetch=old;}}
test('context is editor-only and rejects injection and ambiguous targets before querying',async()=>{
 const unexpected=()=>{throw Error('unexpected query');};
 for(const query of [{article_id:'1x'},{article_id:'9007199254740993'},{game_id:'eq.anything'},{game_id:id,article_id:'1'},{article_id:'1',extra:'x'}])assert.equal((await run(query,unexpected)).code,400);
 assert.equal((await run({article_id:'1'},unexpected,{headers:{}})).code,401);
});
test('article context returns stored reasons and favorite state without content writes',async()=>{
 const res=await run({article_id:'42'},async(url,options)=>{
  assert.ok(!options.method||options.method==='GET');const u=new URL(url);
  if(u.pathname.endsWith('/article_games')){assert.equal(u.searchParams.get('article_id'),'eq.42');return Response.json([{game:{id,title:'Game'}}]);}
  if(u.pathname.endsWith('/game_following')){assert.equal(u.searchParams.get('game_id'),`in.(${id})`);return Response.json([{game_id:id,is_favorite:true}]);}
  assert.equal(u.pathname,'/rest/v1/article_discovery_context');assert.equal(u.searchParams.get('article_id'),'eq.42');return Response.json([{selection_reason:'具体的な遊びが面白い'}]);
 });
 assert.equal(res.code,200);assert.equal(res.body.games[0].is_favorite,true);assert.equal(res.body.contexts[0].selection_reason,'具体的な遊びが面白い');
});
test('missing provenance stays absent and does not manufacture reasons or query all favorites',async()=>{
 const res=await run({article_id:'42'},async(url)=>{assert.ok(!url.includes('game_following'));return Response.json([]);});
 assert.deepEqual(res.body,{games:[],contexts:[]});
});
test('game reasons are scoped to linked articles and adopted discoveries with bounded history',async()=>{
 const res=await run({game_id:id},async(url)=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/article_games')){assert.equal(u.searchParams.get('game_id'),`eq.${id}`);assert.equal(u.searchParams.get('limit'),'20');return Response.json([{article_id:42}]);}
  if(u.pathname.endsWith('/game_discoveries')){assert.equal(u.searchParams.get('adopted_game_id'),`eq.${id}`);return Response.json([{reason:'以前の発見理由'}]);}
  assert.equal(u.searchParams.get('article_id'),'in.(42)');return Response.json([{article_id:42,selection_reason:'採点理由'}]);
 });
 assert.equal(res.code,200);assert.equal(res.body.contexts.length,1);assert.equal(res.body.discoveries[0].reason,'以前の発見理由');
});
test('context outage is reported separately without leaking database details',async()=>{
 const res=await run({article_id:'42'},async()=>new Response('SQL secret',{status:500}));assert.equal(res.code,502);assert.ok(!JSON.stringify(res.body).includes('SQL secret'));
});
