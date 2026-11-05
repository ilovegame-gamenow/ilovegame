import {readPublicJson} from './public-source-client.js';
import {cleanArticleHtml} from './html-text-cleaner.js';

const userAgent='ILoveGame/1.0 (https://ilovegame.vercel.app; editor game catalog)';
const cache=new Map();
const qid=/^Q[1-9]\d{0,11}$/;
const numeric=id=>Number.isSafeInteger(id)&&id>0&&id<=9999999999;
const values=(entity,property)=>(entity.claims?.[property]||[]).filter(c=>c.rank!=='deprecated').map(c=>c.mainsnak?.datavalue?.value);
export function safeSearchUrl(value,host){
 try{if(typeof value!=='string'||value.length>2000)return null;const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!host||u.hostname===host)?u.href:null;}catch{return null;}
}
async function cached(url,options){
 const existing=cache.get(url);if(existing&&existing.until>Date.now())return existing.promise;
 if(cache.size>=64)cache.delete(cache.keys().next().value);
 const promise=readPublicJson(url,options);const entry={promise,until:Date.now()+300000};cache.set(url,entry);
 try{return await promise;}catch(error){if(cache.get(url)===entry)cache.delete(url);throw error;}
}
async function wikidata(params){
 const result=await cached(`https://www.wikidata.org/w/api.php?${new URLSearchParams({...params,format:'json'})}`,{maxBytes:2000000,headers:{'User-Agent':userAgent}});
 if(result.error)throw Error('Wikidata unavailable');return result;
}
async function entities(ids){
 if(!ids.length)return {};
 const data=await wikidata({action:'wbgetentities',ids:ids.join('|'),props:'labels|descriptions|claims',languages:'ja|en|mul'});
 if(!data.entities||typeof data.entities!=='object')throw Error('Invalid entity data');return data.entities;
}
function gameEntity(entity){return entity&&!entity.missing&&values(entity,'P31').some(v=>v?.id==='Q7889');}
function entityResult(entity,platforms){
 if(!gameEntity(entity)||!qid.test(entity.id))return null;
 const title=entity.labels?.ja?.value||entity.labels?.en?.value||entity.labels?.mul?.value;
 if(typeof title!=='string'||!title.trim()||title.length>300)return null;
 const description=entity.descriptions?.ja?.value||entity.descriptions?.en?.value||'';
 const officialUrls=values(entity,'P856').map(u=>safeSearchUrl(u)).filter(Boolean).slice(0,4);
 officialUrls.sort((a,b)=>Number(/\.jp\//.test(b))-Number(/\.jp\//.test(a)));
 return {provider:'wikidata',externalId:entity.id,title,originalTitle:entity.labels?.en?.value||entity.labels?.mul?.value||'',description:String(description).slice(0,2000),
  platforms:values(entity,'P400').map(v=>platforms[v?.id]?.labels?.ja?.value||platforms[v?.id]?.labels?.en?.value||platforms[v?.id]?.labels?.mul?.value).filter(Boolean),
  identityUrls:values(entity,'P1733').filter(id=>/^[1-9]\d{0,9}$/.test(String(id))).map(id=>`https://store.steampowered.com/app/${id}/`).slice(0,10),
  url:`https://www.wikidata.org/wiki/${entity.id}`,officialUrl:officialUrls[0]||null,sourceLabel:'Wikidata（参考情報）'};
}
export async function findWikidataGames(query){
 const searches=await Promise.allSettled(['ja','en'].map(language=>wikidata({action:'wbsearchentities',search:query,language,uselang:'ja',type:'item',limit:'12'})));
 if(searches.every(s=>s.status==='rejected'))throw Error('Wikidata unavailable');
 for(const s of searches)if(s.status==='fulfilled'&&!Array.isArray(s.value.search))throw Error('Invalid entity search');
 const ids=[...new Set(searches.flatMap(s=>s.status==='fulfilled'?s.value.search.map(r=>r.id):[]))].filter(id=>qid.test(id)).slice(0,24);
 const found=Object.values(await entities(ids)).filter(gameEntity);
 const platformIds=[...new Set(found.flatMap(e=>values(e,'P400').map(v=>v?.id)))].filter(id=>qid.test(id)).slice(0,50);
 const platforms=await entities(platformIds);
 return found.map(e=>entityResult(e,platforms)).filter(Boolean).slice(0,16);
}
export async function getWikidataGame(id){
 if(!qid.test(id))throw Error('Invalid entity ID');
 const data=await entities([id]),result=entityResult(data[id],{});
 if(!result)throw Error('Not a video game');return result;
}
function appleResult(app){
 if(app?.wrapperType!=='software'||!numeric(app.trackId)||!Array.isArray(app.genreIds)||!app.genreIds.map(String).includes('6014'))return null;
 const url=safeSearchUrl(app.trackViewUrl,'apps.apple.com');
 if(!url||!url.includes(`/id${app.trackId}`)||typeof app.trackName!=='string'||!app.trackName.trim()||app.trackName.length>300)return null;
 return {provider:'appstore',externalId:String(app.trackId),title:app.trackName,originalTitle:'',description:cleanArticleHtml(String(app.description||'')).slice(0,2000),
  platforms:['iOS（App Store）'],url:`https://apps.apple.com/jp/app/id${app.trackId}`,sourceLabel:'App Store（日本）',developer:String(app.artistName||'').slice(0,300)};
}
export async function findAppStoreGames(query){
 const data=await cached(`https://itunes.apple.com/search?${new URLSearchParams({term:query,country:'jp',entity:'software',limit:'16',lang:'ja_jp'})}`,{maxBytes:1500000});
 if(!Array.isArray(data.results))throw Error('Invalid App Store search');return data.results.map(appleResult).filter(Boolean);
}
export async function getAppStoreGame(id){
 const n=Number(id);if(!/^[1-9]\d{0,9}$/.test(String(id))||!numeric(n))throw Error('Invalid app ID');
 const data=await cached(`https://itunes.apple.com/lookup?${new URLSearchParams({id:String(n),country:'jp',entity:'software'})}`,{maxBytes:1500000});
 const result=data.results?.map(appleResult).find(app=>app?.externalId===String(n));if(!result)throw Error('Game unavailable in Japan');return result;
}
