import { randomUUID } from 'node:crypto';
import { cleanArticleHtml } from './html-text-cleaner.js';
export const STEAM_FEED_URL='https://store.steampowered.com/api/featuredcategories?l=japanese&cc=jp';
export const MAX_RESEARCH_ITEMS=3;
export function steamAppUrl(id){return `https://store.steampowered.com/app/${id}/`;}
async function json(url) {
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('Steam source unavailable');
  let bytes=0;const parts=[];
  for await(const part of response.body){bytes+=part.length;if(bytes>350000){await response.body.cancel().catch(()=>{});throw Error('Steam response too large');}parts.push(part);}
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
export function parseSteamFeed(data){
  if(!Array.isArray(data?.coming_soon?.items))throw Error('Steam feed format changed');
  return [...new Set(data.coming_soon.items.map(item=>item.id).filter(id=>Number.isSafeInteger(id)&&id>0))].slice(0,12);
}
export function parseSteamGame(data,id) {
  const entry=data?.[id];const game=entry?.data;
  if(!entry?.success||game?.type!=='game'||game.steam_appid!==id||game.release_date?.coming_soon!==true)return null;
  if(typeof game.name!=='string'||!game.name.trim()||game.name.length>300)return null;
  const raw=typeof game.about_the_game==='string'?game.about_the_game:game.short_description;
  if(typeof raw!=='string')return null;
  let description=cleanArticleHtml(raw).slice(0,4000);
  while(Buffer.byteLength(description,'utf8')>5000)description=description.slice(0,-1);
  if(description.length<60)return null;
  return {appid:id,candidate_id:randomUUID(),title:game.name.trim(),url:steamAppUrl(id),description};
}
export async function collectSteamDiscoveries(findKnown=async()=>[]) {
  const ids=parseSteamFeed(await json(STEAM_FEED_URL));
  const known=new Set(await findKnown(ids));
  const selected=ids.filter(id=>!known.has(id)).slice(0,MAX_RESEARCH_ITEMS);
  const results=await Promise.allSettled(selected.map(async id=>parseSteamGame(await json(`https://store.steampowered.com/api/appdetails?appids=${id}&l=japanese&cc=jp&filters=basic,release_date`),id)));
  const sources=results.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value);
  while(Buffer.byteLength(JSON.stringify(sources),'utf8')>17000)sources.pop();
  if(!sources.length)throw Error('No new readable Steam games');
  return sources;
}
