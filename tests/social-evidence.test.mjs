import test from 'node:test';import assert from 'node:assert/strict';
import handler from '../api/editor-games.js';
import {createEditorToken} from '../lib/editor-auth.js';
import {signSocialPreview,readSocialEvidence} from '../lib/social-evidence.js';
const secret='evidence-test',id='00000000-0000-0000-0000-000000000001';
const result={platform:'bluesky',actor:'amongusstory.bsky.social',verified_by:'https://www.innersloth.com/among-us-story-on-guard-demo-available-now/',observed_at:'2026-11-01T12:00:00Z',posts:[{url:'https://bsky.app/profile/amongusstory.bsky.social/post/abc',published_at:'2026-10-30T12:00:00Z',metrics:{likes:0,reposts:4,replies:null,quotes:1}}]};
const body=()=>({game_id:id,post_url:result.posts[0].url,preview_token:signSocialPreview(result,secret)});
const headers={cookie:`ilovegame_editor=${createEditorToken(secret)}`,host:'site.invalid',origin:'https://site.invalid'};
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
Object.assign(process.env,{EDITOR_SECRET:secret,GAME_CATALOG_ENABLED:'true',SOCIAL_EVIDENCE_ENABLED:'true',SUPABASE_URL:'https://db.invalid',SUPABASE_SECRET_KEY:'test'});
test('signed previews reject tampering, wrong posts, expiry and caller-provided metrics',()=>{
 const valid=body();assert.equal(readSocialEvidence(valid,secret).likes,0);assert.equal(readSocialEvidence(valid,secret).replies,null);
 assert.equal(readSocialEvidence({...valid,likes:999},secret),null);
 assert.equal(readSocialEvidence({...valid,post_url:'https://evil.invalid'},secret),null);
 assert.equal(readSocialEvidence(valid,'other-secret'),null);
 assert.equal(readSocialEvidence({...valid,preview_token:valid.preview_token+'x'},secret),null);
 assert.equal(readSocialEvidence({...valid,preview_token:'abc.'+'あ'.repeat(43)},secret),null);
 assert.equal(readSocialEvidence({...valid,preview_token:signSocialPreview(result,secret,Date.now()-3600001)},secret),null);
});
test('evidence requires authentication, same origin, gate and valid signed selection before database access',async()=>{
 const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected fetch');};
 try{
  for(const [req,code] of [[{method:'POST',headers:{},body:body()},401],[{method:'POST',headers:{...headers,origin:'https://evil.invalid'},body:body()},403],[{method:'POST',headers,body:{...body(),preview_token:'bad'}},400],[{method:'GET',headers,query:{game_id:'bad'}},400]]){
   const res=response();await handler({...req,query:{resource:'social-evidence',...req.query}},res);assert.equal(res.code,code);
  }
  process.env.SOCIAL_EVIDENCE_ENABLED='false';const res=response();await handler({method:'POST',headers,query:{resource:'social-evidence'},body:body()},res);assert.equal(res.code,503);
 }finally{globalThis.fetch=old;process.env.SOCIAL_EVIDENCE_ENABLED='true';}
});
test('saving uses only the signed observation and a single atomic RPC, no public or paid calls',async()=>{
 const old=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json(id);};
 try{
  const res=response();await handler({method:'POST',headers,query:{resource:'social-evidence'},body:body()},res);assert.equal(res.code,200);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://db.invalid/rest/v1/rpc/save_game_social_evidence');
  const input=JSON.parse(calls[0].options.body).p_input;assert.equal(input.observed_at,result.observed_at);assert.equal(input.replies,null);assert.equal(input.likes,0);assert.equal(input.game_id,id);
 }finally{globalThis.fetch=old;}
});
test('saved evidence is scoped to the selected work and bounded',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async(url)=>{const q=new URL(url).searchParams;assert.equal(q.get('game_id'),`eq.${id}`);assert.equal(q.get('limit'),'100');assert.equal(q.get('game_social_observations.limit'),'20');return Response.json([]);};
 try{const res=response();await handler({method:'GET',headers,query:{resource:'social-evidence',game_id:id}},res);assert.equal(res.code,200);assert.deepEqual(res.body.sources,[]);}finally{globalThis.fetch=old;}
});
