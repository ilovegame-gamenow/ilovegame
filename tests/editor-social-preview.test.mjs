import test from 'node:test';import assert from 'node:assert/strict';
import handler from '../api/editor-games.js';import {createEditorToken} from '../lib/editor-auth.js';import {getInformationSources} from '../lib/information-sources.js';import {settingRules} from '../lib/site-settings.js';
const settings=Object.fromEntries(Object.entries(settingRules).map(([key,rule])=>[key,rule.defaultValue]));
const flags={GAME_CATALOG_ENABLED:'true',GAME_DISCOVERIES_ENABLED:'true',BLUESKY_PREVIEW_ENABLED:'true'};
Object.assign(process.env,flags,{EDITOR_SECRET:'social-preview-test',SUPABASE_URL:'https://db.invalid',SUPABASE_SECRET_KEY:'fake'});
const headers={cookie:`ilovegame_editor=${createEditorToken('social-preview-test')}`,host:'site.invalid',origin:'https://site.invalid'};
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
async function mock(fetch,run){const old=globalThis.fetch;globalThis.fetch=fetch;try{await run();}finally{globalThis.fetch=old;}}
test('social preview enforces auth, feature gate, GET-only and no caller-controlled sources',async()=>{
 await mock(()=>{throw Error('Unexpected fetch');},async()=>{
  for(const [req,code] of [[{method:'GET',headers:{},query:{resource:'bluesky-preview'}},401],[{method:'POST',headers,query:{resource:'bluesky-preview'}},405],[{method:'GET',headers,query:{resource:'bluesky-preview',actor:'evil.example'}},400]]){
   const res=response();await handler(req,res);assert.equal(res.code,code);
  }
  process.env.BLUESKY_PREVIEW_ENABLED='false';try{const res=response();await handler({method:'GET',headers,query:{resource:'bluesky-preview'}},res);assert.equal(res.code,503);}finally{process.env.BLUESKY_PREVIEW_ENABLED='true';}
 });
});
test('preview performs only a public read and does not write to the database',async()=>{
 let calls=0;
 await mock(async url=>{calls++;assert.equal(new URL(url).hostname,'public.api.bsky.app');return Response.json({feed:[]});},async()=>{
  const res=response();await handler({method:'GET',headers,query:{resource:'bluesky-preview'}},res);assert.equal(res.code,200);assert.deepEqual(res.body.posts,[]);assert.equal(res.body.returned,0);
 });assert.equal(calls,1);
});
test('the single source entry changes readiness only when all preview gates are enabled',()=>{
 const active=getInformationSources(settings,flags).filter(s=>s.id==='bluesky');assert.equal(active.length,1);assert.equal(active[0].group,'discovery');assert.equal(active[0].action.href,'/editor-social.html');assert.equal(active[0].settingKey,undefined);
 for(const key of Object.keys(flags)){const source=getInformationSources(settings,{...flags,[key]:'false'}).find(s=>s.id==='bluesky');assert.equal(source.group,'planned');assert.equal(source.action,null);}
});
