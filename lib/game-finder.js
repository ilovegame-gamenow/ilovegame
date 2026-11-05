import {readPublicJson} from './public-source-client.js';
import {cleanArticleHtml} from './html-text-cleaner.js';
import {catalogRequest} from './catalog-database.js';
import {searchGames,createGame} from './game-catalog-repository.js';
import {findWikidataGames,findAppStoreGames,getWikidataGame,getAppStoreGame,safeSearchUrl} from './game-search-sources.js';
import {isGameId} from './game-catalog-input.js';

export async function findSteamGames(query){
 const data=await readPublicJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=japanese&cc=JP`);
 if(!Array.isArray(data?.items))throw Error('Invalid search response');
 return data.items.filter(x=>Number.isSafeInteger(x.id)&&x.id>0&&typeof x.name==='string'&&x.name.length<=300).slice(0,12).map(x=>({appid:x.id,title:x.name,image:safeSearchUrl(x.tiny_image),url:`https://store.steampowered.com/app/${x.id}/`}));
}
export async function handleGameFinder(req,res,{url,key}){
 try{
  if(req.method==='GET'){
   const q=req.query?.q;
   if(Object.keys(req.query||{}).some(k=>k!=='q')||typeof q!=='string'||!q.trim()||q.length>100)return res.status(400).json({error:'ゲームのタイトルを入力してください。'});
   const [local,...sources]=await Promise.allSettled([
    searchGames(url,key,{q:q.trim(),page:1,filter:'all'}),findSteamGames(q.trim()),findWikidataGames(q.trim()),findAppStoreGames(q.trim())
   ]);
   if(local.status==='rejected')throw local.reason;
   const steam=sources[0].status==='fulfilled'?sources[0].value:[];
   const results=[...steam.map(app=>({provider:'steam',externalId:String(app.appid),title:app.title,description:'Steamの作品ページで詳しい内容を確認できます。',url:app.url,sourceLabel:'Steam',image:app.image,platforms:['PC（Steam）']})),
    ...sources.slice(1).flatMap(s=>s.status==='fulfilled'?s.value:[])];
   await attachRegisteredGames(url,key,results);
   return res.status(200).json({games:local.value.games,steam,steamUnavailable:sources[0].status==='rejected',results,
    sources:['Steam','全機種の作品データ','App Store（日本）'].map((name,i)=>({name,available:sources[i].status==='fulfilled',count:sources[i].status==='fulfilled'?sources[i].value.length:0}))});
  }
  const b=req.body;
  if(!b||!isGameId(b.id)||Object.keys(b).some(k=>!['id','appid','title','provider','external_id'].includes(k)))return res.status(400).json({error:'登録する作品を選び直してください。'});
  let game;
  if(b.provider!==undefined){
   if(b.appid!==undefined||b.title!==undefined||typeof b.external_id!=='string'||!['wikidata','appstore'].includes(b.provider)||(b.provider==='wikidata'?!/^Q[1-9]\d{0,11}$/.test(b.external_id):!/^\d{1,10}$/.test(b.external_id)))return res.status(400).json({error:'登録する検索結果を選び直してください。'});
   const result=await (b.provider==='wikidata'?getWikidataGame(b.external_id):getAppStoreGame(b.external_id));
   await attachRegisteredGames(url,key,[result]);
   if(result.game){
    await catalogRequest(url,key,'rpc/set_game_following',{method:'POST',body:JSON.stringify({p_game_id:result.game.id,p_action:'favorite_on'})});
    game=result.game;
   }else game=await createGame(url,key,{id:b.id,title:result.title,original_title:result.originalTitle,description:`${result.sourceLabel}：${result.description}`.slice(0,4000),source_url:result.url,source_type:b.provider==='appstore'?'store':'media'});
  }else if(b.external_id!==undefined){return res.status(400).json({error:'検索元を確認してください。'});
  }else if(b.appid!==undefined){
   if(!Number.isSafeInteger(b.appid)||b.appid<=0||b.appid>9999999999||b.title!==undefined)return res.status(400).json({error:'Invalid Steam ID'});
   // Fixed Steam origin; client-provided URLs/titles are never fetched or trusted.
   const data=await readPublicJson(`https://store.steampowered.com/api/appdetails?appids=${b.appid}&l=japanese&cc=jp&filters=basic`),app=data?.[b.appid]?.data;
   if(!data?.[b.appid]?.success||app?.type!=='game'||app.steam_appid!==b.appid||typeof app.name!=='string'||!app.name.trim()||app.name.length>300) return res.status(400).json({error:'ゲーム本体の情報を確認できませんでした。DLCなどは作品として登録できません。'});
   game=await createGame(url,key,{id:b.id,title:app.name.trim(),original_title:'',description:cleanArticleHtml(String(app.short_description||'')).slice(0,4000),source_url:`https://store.steampowered.com/app/${b.appid}/`,source_type:'store'});
  }else{
   if(typeof b.title!=='string'||!b.title.trim()||b.title.length>100)return res.status(400).json({error:'作品名を確認してください。'});
   game=await catalogRequest(url,key,'rpc/register_followed_title',{method:'POST',body:JSON.stringify({p_id:b.id,p_title:b.title.trim()})});
  }
  return res.status(200).json({game});
 }catch{return res.status(502).json({error:'作品の検索・登録を確認できませんでした。時間をおいて再度確認してください。'});}
}

async function attachRegisteredGames(url,key,results){
 const urls=[...new Set(results.flatMap(r=>[r.url,...(r.identityUrls||[])]))];
 const matches=[];
 for(let i=0;i<urls.length;i+=40){
  const batch=urls.slice(i,i+40);
  const params=new URLSearchParams({select:'url,game:games(id,title,original_title,description,status)',url:`in.(${batch.map(u=>JSON.stringify(u)).join(',')})`,limit:'200'});
  const rows=await catalogRequest(url,key,`game_sources?${params}`);
  if(!Array.isArray(rows))throw Error('Invalid registered sources');matches.push(...rows.filter(r=>batch.includes(r.url)&&isGameId(r.game?.id)));
 }
 for(const result of results){
  const ids=new Set([result.url,...(result.identityUrls||[])]);
  const games=new Map(matches.filter(r=>ids.has(r.url)).map(r=>[r.game.id,r.game]));
  if(games.size===1)result.game=[...games.values()][0];
 }
 const ids=[...new Set(results.map(r=>r.game?.id).filter(Boolean))];
 if(ids.length){
  const rows=await catalogRequest(url,key,`game_following?${new URLSearchParams({select:'game_id,is_favorite',game_id:`in.(${ids.join(',')})`})}`);
  for(const result of results)if(result.game)result.game={...result.game,is_favorite:rows.some(f=>f.game_id===result.game.id&&f.is_favorite)};
 }
}
