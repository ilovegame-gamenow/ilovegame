import {readPublicJson} from './public-source-client.js';
import {cleanArticleHtml} from './html-text-cleaner.js';
import {catalogRequest} from './catalog-database.js';
import {searchGames,createGame} from './game-catalog-repository.js';
import {isGameId} from './game-catalog-input.js';

export async function findSteamGames(query){
 const data=await readPublicJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=japanese&cc=JP`);
 if(!Array.isArray(data?.items))throw Error('Invalid search response');
 return data.items.filter(x=>Number.isSafeInteger(x.id)&&x.id>0&&typeof x.name==='string'&&x.name.length<=300).slice(0,12).map(x=>({appid:x.id,title:x.name,url:`https://store.steampowered.com/app/${x.id}/`}));
}
export async function handleGameFinder(req,res,{url,key}){
 try{
  if(req.method==='GET'){
   const q=req.query?.q;
   if(Object.keys(req.query||{}).some(k=>k!=='q')||typeof q!=='string'||!q.trim()||q.length>100)return res.status(400).json({error:'ゲームのタイトルを入力してください。'});
   const [local,steam]=await Promise.allSettled([searchGames(url,key,{q:q.trim(),page:1,filter:'all'}),findSteamGames(q.trim())]);
   if(local.status==='rejected')throw local.reason;
   return res.status(200).json({games:local.value.games,steam:steam.status==='fulfilled'?steam.value:[],steamUnavailable:steam.status==='rejected'});
  }
  const b=req.body;
  if(!b||!isGameId(b.id)||Object.keys(b).some(k=>!['id','appid','title'].includes(k)))return res.status(400).json({error:'登録する作品を選び直してください。'});
  let game;
  if(b.appid!==undefined){
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
