import { steamAppId,steamImageUrl } from '../game-source-utils.js';
import { readPublicText } from './public-source-client.js';
import { getSteamAppDetails,parseSteamGame } from './steam-discovery-source.js';
export const SHOWCASE={id:'wholesome',name:'Wholesome Games',url:'https://wholesomegames.com/'};
export function parseShowcaseApps(html) {
  const ids=[];
  // Only explicit Steam app links in HTML attributes, never execute scripts or follow other links.
  for(const match of html.matchAll(/\bhref\s*=\s*["'](https:\/\/store\.steampowered\.com\/app\/[^"'<>\s]+)["']/gi)){
    const id=steamAppId(match[1]);if(id&&!ids.includes(id))ids.push(id);
    if(ids.length===12)break;
  }
  return ids;
}
export function parseSteamMedia(data,appid) {
  const entry=data?.[appid],game=entry?.data;
  if(!entry?.success||game?.type!=='game'||game.steam_appid!==appid)return [];
  const images=[];
  for(const item of Array.isArray(game.screenshots)?game.screenshots:[]){
    const thumbnail=steamImageUrl(item?.path_thumbnail,appid),full=steamImageUrl(item?.path_full,appid);
    if(thumbnail&&full&&!images.some(image=>image.full===full))images.push({thumbnail,full});
    if(images.length===3)break;
  }
  return images;
}
export async function getSteamMedia(appid){return parseSteamMedia(await getSteamAppDetails(appid,'basic,screenshots'),appid);}
export async function collectShowcasePreview(findKnown=async()=>[]) {
  const ids=parseShowcaseApps(await readPublicText(SHOWCASE.url));
  if(!ids.length)throw Error('Showcase links unavailable');
  const known=new Set(await findKnown(ids));
  const results=await Promise.allSettled(ids.filter(id=>!known.has(id)).slice(0,6).map(async id=>parseSteamGame(await getSteamAppDetails(id),id)));
  return {source:SHOWCASE,games:results.filter(result=>result.status==='fulfilled'&&result.value).map(result=>result.value).slice(0,3)};
}
