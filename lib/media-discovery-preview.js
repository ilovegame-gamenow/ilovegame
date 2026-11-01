import { readPublicText } from './public-source-client.js';
export const MEDIA_SOURCE={id:'game-watch',name:'GAME Watch',website:'https://game.watch.impress.co.jp/',feed:'https://game.watch.impress.co.jp/data/rss/1.0/gmw/feed.rdf',limit:20,maxAgeDays:14};
// Deliberately limited RSS 1.0 field reader, not a general XML processor. No entities or markup execution.
function field(item,name){
  const matches=[...item.matchAll(new RegExp(`<${name}\\s*>([\\s\\S]*?)<\\/${name}>`,'g'))];
  if(matches.length!==1)return null;
  const value=matches[0][1].trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/,'$1');
  if(/[<>]/.test(value))return null;
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,entity)=>{
    const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(named[entity])return named[entity];
    const n=entity[0]==='#'?parseInt(entity.slice(entity[1].toLowerCase()==='x'?2:1),entity[1].toLowerCase()==='x'?16:10):NaN;
    return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';
  });
}
export function mediaArticleUrl(value){
  let url;try{url=new URL(value);}catch{return null;}
  if(url.origin!==MEDIA_SOURCE.website.slice(0,-1)||url.username||url.password||!/^\/docs\/(?:news|interview|preview|kikaku)\/\d+\.html$/.test(url.pathname))return null;
  url.search='';url.hash='';return url.toString();
}
export function parseMediaFeed(xml,now=Date.now()){
  if(typeof xml!=='string'||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<rdf:RDF\b/.test(xml)||!/<\/rdf:RDF>\s*$/.test(xml))throw Error('Unsupported media feed');
  const items=[],seen=new Set();let inspected=0;
  for(const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)){
    if(++inspected>100)break;
    const title=field(match[1],'title'),link=field(match[1],'link'),published=field(match[1],'dc:date');
    if(!title||title.length>600||!link||!published||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(published))continue;
    const timestamp=Date.parse(published);if(!Number.isFinite(timestamp)||timestamp>now||now-timestamp>MEDIA_SOURCE.maxAgeDays*86400000)continue;
    const normalized=mediaArticleUrl(link);if(!normalized||seen.has(normalized))continue;seen.add(normalized);
    items.push({title,url:normalized,published_at:new Date(timestamp).toISOString()});
  }
  items.sort((a,b)=>b.published_at.localeCompare(a.published_at)||a.url.localeCompare(b.url));
  return items.slice(0,MEDIA_SOURCE.limit);
}
export async function collectMediaPreview(){
  const xml=await readPublicText(MEDIA_SOURCE.feed);const observed=new Date();
  return {source:MEDIA_SOURCE,observed_at:observed.toISOString(),items:parseMediaFeed(xml,observed.getTime())};
}
