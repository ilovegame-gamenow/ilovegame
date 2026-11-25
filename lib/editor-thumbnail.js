import { catalogRequest } from './catalog-database.js';
import { readPublicText } from './public-source-client.js';

// Exact hosts only; external redirects and user-supplied fetch URLs are not allowed.
const pages=new Set(['www.nintendo.com','blog.ja.playstation.com','prtimes.jp','store.steampowered.com','steamcommunity.com','news.xbox.com','www.xbox.com','deadbydaylight.com','bugreport.deadbydaylight.com']);
const images=new Set([...pages,'assets.topics.apps-jp.nintendo.com','topics-cdn.nintendo.co.jp','live.staticflickr.com','prcdn.freetls.fastly.net','cdn.prtimes.jp','shared.fastly.steamstatic.com','shared.akamai.steamstatic.com','cdn.akamai.steamstatic.com','cdn.cloudflare.steamstatic.com','assets.deadbydaylight.com','store-images.s-microsoft.com']);
function allowed(value,hosts,base){
 try{const u=new URL(value,base);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.has(u.hostname)?u:null;}catch{return null;}
}
function attr(tag,key){return tag.match(new RegExp('(?:^|\\s)'+key+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27)','i'))?.slice(1).find(x=>x!==undefined);}
export function thumbnailCandidates(html,base){
 const tags=html.match(/<meta\b[^>]*>/gi)||[];
 return [...new Set(['og:image:secure_url','og:image','twitter:image','twitter:image:src'].flatMap(key=>tags.filter(t=>[attr(t,'property'),attr(t,'name')].includes(key)).map(t=>attr(t,'content')).filter(Boolean).map(v=>allowed(v.replace(/&amp;/g,'&'),images,base)?.href).filter(Boolean)))].slice(0,4);
}
async function verified(url){
 try{
  const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(5000),headers:{Range:'bytes=0-1023'}});
  if(!r.ok||!/^image\//i.test(r.headers.get('content-type')||'')||!r.body){await r.body?.cancel();return false;}
  const reader=r.body.getReader();try{return Boolean((await reader.read()).value?.length);}finally{await reader.cancel();}
 }catch{return false;}
}
async function findImage(value){
 const page=allowed(value,pages);if(!page)return null;
 try{
  const html=await readPublicText(page.href,2500000,{},7000);
  const candidates=thumbnailCandidates(html,page.href);
  const checks=await Promise.all(candidates.map(verified));
  return candidates.find((_,i)=>checks[i])||null;
 }catch{}
 return null;
}
export async function retryThumbnail(url,key,id){
 const result=(status,error)=>({status,body:{error}});
 if(!Number.isSafeInteger(id)||id<1)return result(400,'記事の指定が正しくありません。');
 const params=new URLSearchParams({id:'eq.'+id,select:'id,source_url,thumbnail_url,processing_status',limit:'1'});
 const [article]=await catalogRequest(url,key,'articles?'+params);
 if(!article)return result(404,'記事が見つかりません。');
 if(article.processing_status!=='completed')return result(409,'記事処理の完了後に再取得してください。');
 let image=await findImage(article.source_url);
 if(!image){
  const links=await catalogRequest(url,key,'article_games?'+new URLSearchParams({article_id:'eq.'+id,select:'game:games(source_url)',limit:'2'}));
  if(links.length===1){const store=allowed(links[0].game?.source_url,new Set(['store.steampowered.com','www.xbox.com','www.nintendo.com']));if(store)image=await findImage(store.href);}
 }
 if(!image)return result(422,'サムネイルが見つかりませんでした。');
 const guard=new URLSearchParams({id:'eq.'+id,processing_status:'eq.completed',thumbnail_url:article.thumbnail_url===null?'is.null':'eq.'+article.thumbnail_url,source_url:article.source_url===null?'is.null':'eq.'+article.source_url});
 const updated=await catalogRequest(url,key,'articles?'+guard,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({thumbnail_url:image})});
 if(!updated?.length)return result(409,'記事の状態が変わりました。再読み込みしてください。');
 return {status:200,body:{thumbnail_url:image}};
}
