import test from 'node:test';import assert from 'node:assert/strict';
import { steamAppId,steamImageUrl } from '../game-source-utils.js';
import { parseShowcaseApps,parseSteamMedia,collectShowcasePreview } from '../lib/game-source-previews.js';
import { readPublicText } from '../lib/public-source-client.js';
import handler from '../api/editor-games.js';
import { createEditorToken } from '../lib/editor-auth.js';
const image=(id,host='shared.akamai.steamstatic.com')=>`https://${host}/store_item_assets/steam/apps/${id}/ss_test.jpg`;
const media=(id)=>({[id]:{success:true,data:{type:'game',steam_appid:id,screenshots:[{path_thumbnail:image(id),path_full:image(id)}]}}});
async function withFetch(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{await run();}finally{globalThis.fetch=old;}}
test('Steam identities and image hosts reject credentials, foreign apps and unsafe schemes',()=>{
 assert.equal(steamAppId('https://store.steampowered.com/app/123/title/'),123);
 for(const url of ['https://store.steampowered.com.evil/app/123/','https://user@store.steampowered.com/app/123/','http://127.0.0.1/app/123/','https://store.steampowered.com/app/0/','https://store.steampowered.com/app/123456789012/'])assert.equal(steamAppId(url),null);
 assert.equal(steamImageUrl(image(123),123),image(123));
 for(const url of [image(124),image(123,'evil.example'),image(123).replace('https:','http:'),image(123).replace('.jpg','.svg'),image(123).replace('https://','https://user@')])assert.equal(steamImageUrl(url,123),null);
});
test('screenshots require matching app metadata, are deduplicated and bounded',()=>{
 const data=media(123);data[123].data.screenshots.push(...Array.from({length:10},(_,i)=>({path_thumbnail:image(123).replace('test',String(i)),path_full:image(123).replace('test',String(i))})),{path_thumbnail:image(999),path_full:image(999)});
 assert.equal(parseSteamMedia(data,123).length,3);
 data[123].data.steam_appid=999;assert.deepEqual(parseSteamMedia(data,123),[]);
 assert.deepEqual(parseSteamMedia({},123),[]);
});
test('showcase extracts only explicit Steam app links and excludes duplicate or unrelated URLs',()=>{
 const html='<a href="https://store.steampowered.com/app/123/title/">A</a><a href="https://store.steampowered.com/app/123/">again</a><a href="https://evil.example/app/456/">bad</a><a href="https://store.steampowered.com/app/456/">B</a>';
 assert.deepEqual(parseShowcaseApps(html),[123,456]);
 assert.deepEqual(parseShowcaseApps('https://store.steampowered.com/app/999/'),[]);
});
test('event preview skips known apps before fetching fixed Steam endpoints and never calls AI',async()=>{
 const calls=[];
 await withFetch(async(url,options)=>{
  calls.push(url);assert.equal(options.redirect,'error');
  if(url==='https://wholesomegames.com/')return new Response('<a href="https://store.steampowered.com/app/123/">A</a><a href="https://store.steampowered.com/app/456/">B</a>');
  assert.equal(new URL(url).hostname,'store.steampowered.com');assert.ok(url.includes('appids=456&'));
  return Response.json({456:{success:true,data:{type:'game',steam_appid:456,name:'Upcoming Game',about_the_game:'A new cooperative game where players change the terrain and solve challenging puzzles together.',release_date:{coming_soon:true}}}});
 },async()=>{
  const result=await collectShowcasePreview(async ids=>{assert.deepEqual(ids,[123,456]);return [123];});
  assert.equal(result.games.length,1);assert.equal(result.games[0].title,'Upcoming Game');assert.equal(result.source.name,'Wholesome Games');
 });assert.equal(calls.length,2);
});
test('source reads reject over-size responses, HTTP failures and changed event markup',async()=>{
 await withFetch(async()=>new Response('x'.repeat(20)),async()=>{await assert.rejects(()=>readPublicText('https://source.invalid',10));});
 await withFetch(async()=>new Response('',{status:403}),async()=>{await assert.rejects(()=>collectShowcasePreview());});
 await withFetch(async()=>new Response('<p>no links</p>'),async()=>{await assert.rejects(()=>collectShowcasePreview());});
});
test('preview routes share editor authorization and validate input before external fetches',async()=>{
 process.env.EDITOR_SECRET='preview-test';process.env.SUPABASE_URL='https://db.invalid';process.env.SUPABASE_SECRET_KEY='fake';process.env.GAME_CATALOG_ENABLED='true';process.env.GAME_DISCOVERIES_ENABLED='true';
 const headers={cookie:`ilovegame_editor=${createEditorToken('preview-test')}`,host:'site.invalid',origin:'https://site.invalid'};
 const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 await withFetch(()=>{throw Error('Unexpected fetch');},async()=>{
  for(const [req,code] of [[{method:'GET',query:{resource:'steam-media',appid:'123'},headers:{}},401],[{method:'GET',query:{resource:'steam-media',appid:'https://evil/'},headers},400],[{method:'POST',query:{resource:'steam-media',appid:'123'},headers},405],[{method:'GET',query:{resource:'showcase',url:'https://evil/'},headers},400]]){
   const res=response();await handler(req,res);assert.equal(res.code,code);
  }
 });
 await withFetch(async()=>Response.json(media(123)),async()=>{const res=response();await handler({method:'GET',query:{resource:'steam-media',appid:'123'},headers},res);assert.equal(res.code,200);assert.equal(res.body.images.length,1);});
});
