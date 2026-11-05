import test from 'node:test';
import assert from 'node:assert/strict';
import {findWikidataGames,getWikidataGame,findAppStoreGames,getAppStoreGame,safeSearchUrl} from '../lib/game-search-sources.js';
import {handleGameFinder} from '../lib/game-finder.js';
const id='11000000-0000-4000-8000-000000000009';
const claim=value=>({mainsnak:{datavalue:{value}}});
const entity=(qid,title,claims={})=>({id:qid,labels:{ja:{value:title}},descriptions:{ja:{value:'遊びの説明'}},claims:{P31:[claim({id:'Q7889'})],...claims}});
const app={wrapperType:'software',trackId:13579,trackName:'ゲーム',genreIds:['6014'],trackViewUrl:'https://apps.apple.com/jp/app/game/id13579',description:'<b>アプリの説明</b>',artistName:'開発元'};
async function mocked(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{await run();}finally{globalThis.fetch=old;}}
const response=()=>({status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('all-platform search identifies games, excludes manga/series and resolves multilingual platform names',async()=>{
 await mocked(async(input,options)=>{
  const u=new URL(input);assert.equal(u.origin,'https://www.wikidata.org');assert.match(options.headers['User-Agent'],/ILoveGame/);
  if(u.searchParams.get('action')==='wbsearchentities')return Response.json({search:[{id:'Q90001'},{id:'Q90002'},{id:'Q90003'},{id:'not-an-id'}]});
  if(u.searchParams.get('ids')==='Q90004')return Response.json({entities:{Q90004:{id:'Q90004',labels:{mul:{value:'Nintendo Switch'}}}}});
  return Response.json({entities:{Q90001:entity('Q90001','ゲーム',{P400:[claim({id:'Q90004'})],P856:[claim('javascript:alert(1)'),claim('https://official.example/game')]}),Q90002:entity('Q90002','漫画',{P31:[claim({id:'Q21198342'})]}),Q90003:entity('Q90003','シリーズ',{P31:[claim({id:'Q7058673'})]})}});
 },async()=>{
  const rows=await findWikidataGames('任天堂テスト検索');assert.equal(rows.length,1);assert.equal(rows[0].title,'ゲーム');assert.deepEqual(rows[0].platforms,['Nintendo Switch']);assert.equal(rows[0].officialUrl,'https://official.example/game');
 });
});
test('App Store search is Japanese, excludes non-games and refuses non-store links',async()=>{
 await mocked(async(input)=>{
  const u=new URL(input);assert.equal(u.searchParams.get('country'),'jp');assert.equal(u.searchParams.get('entity'),'software');
  return Response.json({results:[app,{...app,trackId:2,genreIds:['6007']},{...app,trackViewUrl:'https://evil.example/id13579'}]});
 },async()=>{const rows=await findAppStoreGames('スマホ検証');assert.equal(rows.length,1);assert.equal(rows[0].url,'https://apps.apple.com/jp/app/id13579');assert.equal(rows[0].description,'アプリの説明');});
});
test('invalid external identifiers never cause requests and unverified entity types cannot register',async()=>{
 await mocked(()=>{throw Error('No request expected');},async()=>{
  await assert.rejects(()=>getWikidataGame('https://localhost/'));
  await assert.rejects(()=>getAppStoreGame('1&country=us'));
  for(const u of ['http://a.invalid','https://user:pass@a.invalid','javascript:alert(1)'])assert.equal(safeSearchUrl(u),null);
 });
 await mocked(async()=>Response.json({entities:{Q90009:entity('Q90009','漫画',{P31:[]})}}),async()=>{await assert.rejects(()=>getWikidataGame('Q90009'),/Not a video game/);});
});
test('new store registration rechecks canonical identity and stores no caller-provided title or URL',async()=>{
 await mocked(async(input,options)=>{
  const u=new URL(input);
  if(u.origin==='https://itunes.apple.com')return Response.json({results:[{...app,trackId:24680,trackViewUrl:'https://apps.apple.com/jp/app/id24680'}]});
  if(u.pathname.endsWith('/game_sources'))return Response.json([]);
  assert.ok(u.pathname.endsWith('/rpc/create_followed_game'));
  const saved=JSON.parse(options.body);assert.equal(saved.p_title,'ゲーム');assert.equal(saved.p_source_url,'https://apps.apple.com/jp/app/id24680');assert.equal(saved.p_source_type,'store');
  return Response.json({id,title:saved.p_title,status:'draft'});
 },async()=>{const res=response();await handleGameFinder({method:'POST',body:{id,provider:'appstore',external_id:'24680'}},res,{url:'https://db.invalid',key:'private'});assert.equal(res.code,200);assert.equal(res.body.game.status,'draft');});
});
test('registering a known source reuses its game and changes only the favorite',async()=>{
 let created=false;
 await mocked(async(input,options)=>{
  const u=new URL(input);
  if(u.origin==='https://www.wikidata.org')return Response.json({entities:{Q90011:entity('Q90011','既存作品')}});
  if(u.pathname.endsWith('/game_sources'))return Response.json([{url:'https://www.wikidata.org/wiki/Q90011',game:{id,title:'既存作品'}}]);
  if(u.pathname.endsWith('/game_following'))return Response.json([{game_id:id,is_favorite:false}]);
  if(u.pathname.endsWith('/rpc/set_game_following')){assert.equal(JSON.parse(options.body).p_game_id,id);return Response.json({game_id:id,is_favorite:true});}
  created=true;throw Error('No creation allowed');
 },async()=>{const res=response();await handleGameFinder({method:'POST',body:{id:'22000000-0000-4000-8000-000000000009',provider:'wikidata',external_id:'Q90011'}},res,{url:'https://db.invalid',key:'private'});assert.equal(res.code,200);assert.equal(res.body.game.id,id);assert.equal(created,false);});
});
test('one unavailable provider does not discard results from the other sources',async()=>{
 await mocked(async(input)=>{
  const u=new URL(input);
  if(u.origin==='https://www.wikidata.org')return new Response('',{status:503});
  if(u.origin==='https://itunes.apple.com')return Response.json({results:[app]});
  if(u.origin==='https://store.steampowered.com')return Response.json({items:[]});
  if(u.pathname.endsWith('/rpc/search_managed_games')||u.pathname.endsWith('/game_sources'))return Response.json([]);
  throw Error('Unexpected request');
 },async()=>{const res=response();await handleGameFinder({method:'GET',query:{q:'部分失敗テスト'}},res,{url:'https://db.invalid',key:'private'});assert.equal(res.code,200);assert.equal(res.body.results.length,1);assert.equal(res.body.sources.find(s=>s.name==='全機種の作品データ').available,false);});
});
test('registration rejects mixed providers, arbitrary fields, and tampered metadata',async()=>{
 await mocked(()=>{throw Error('No requests expected');},async()=>{
  for(const body of [{id,provider:'other',external_id:'1'},{id,provider:'appstore',external_id:'123',title:'偽造'},{id,provider:'wikidata',external_id:'Q123',appid:42},{id,external_id:'123'},{id,provider:'appstore',external_id:'123',url:'http://localhost/'}]){
   const res=response();await handleGameFinder({method:'POST',body},res,{url:'https://db.invalid',key:'private'});assert.equal(res.code,400);
  }
 });
});
