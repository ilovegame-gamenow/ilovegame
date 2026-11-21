// Shared browser/server identity parsing; a source URL never becomes a fetch target.
export function steamAppId(value) {
  try{
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol)||url.hostname!=='store.steampowered.com'||url.username||url.password||url.port)return null;
    const match=url.pathname.match(/^\/app\/([1-9][0-9]{0,9})(?:\/|$)/);
    return match?Number(match[1]):null;
  }catch{return null;}
}
export function steamImageUrl(value,appid) {
  if(typeof value!=='string'||value.length>2000)return null;
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||url.port||!['shared.akamai.steamstatic.com','shared.fastly.steamstatic.com','cdn.akamai.steamstatic.com','cdn.cloudflare.steamstatic.com'].includes(url.hostname))return null;
    if(!url.pathname.startsWith(`/store_item_assets/steam/apps/${appid}/`)&&!url.pathname.startsWith(`/steam/apps/${appid}/`))return null;
    if(!/\.(jpg|jpeg|png|webp)$/i.test(url.pathname))return null;
    return url.href;
  }catch{return null;}
}
// Embed only a validated YouTube ID; never insert a supplied URL into an iframe.
export function youtubeVideoId(value) {
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  let id;
  if(u.hostname==='youtu.be'&&/^\/[A-Za-z0-9_-]{11}$/.test(u.pathname))id=u.pathname.slice(1);
  else if(['www.youtube.com','youtube.com','www.youtube-nocookie.com'].includes(u.hostname)){
   if(u.pathname==='/watch')id=u.searchParams.get('v');
   else id=u.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})$/)?.[1];
  }
  return typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
 }catch{return null;}
}

// Accept only canonical public post paths; never embed arbitrary URLs or profiles.
export function socialVideoPost(value) {
 try {
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  const host=u.hostname, path=u.pathname;
  let m;
  if(['x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com'].includes(host)){
   m=path.match(/^\/([A-Za-z0-9_]{1,15})\/status\/([0-9]{1,20})\/?$/);
   if(m)return {provider:'x',id:m[2],url:'https://x.com/'+m[1]+'/status/'+m[2]};
  }else if(['www.instagram.com','instagram.com'].includes(host)){
   m=path.match(/^\/(reel|p|tv)\/([A-Za-z0-9_-]{1,32})\/?$/);
   if(m)return {provider:'instagram',id:m[2],url:'https://www.instagram.com/'+m[1]+'/'+m[2]+'/'};
  }else if(['www.tiktok.com','tiktok.com'].includes(host)){
   m=path.match(/^\/@([A-Za-z0-9_.]{1,32})\/video\/([0-9]{1,20})\/?$/);
   if(m)return {provider:'tiktok',id:m[2],url:'https://www.tiktok.com/@'+m[1]+'/video/'+m[2]};
  }
 }catch{}
 return null;
}

// Editorial images are explicitly selected and never fetched by the server.
// Accept known publication assets or the article's exact official source host.
const editorialImageHosts=new Set([
 'prcdn.freetls.fastly.net','prtimes.jp','assets.topics.apps-jp.nintendo.com',
 'www.nintendo.com','www.nintendo.co.jp','blog.ja.playstation.com',
 'blog.playstation.com','gmedia.playstation.com','media.playstation.com'
]);
export function editorialImageUrl(value,sourceUrl){
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.href.length>2000)return null;
  let sourceHost='';try{const source=new URL(sourceUrl);if(source.protocol==='https:'&&!source.username&&!source.password&&!source.port)sourceHost=source.hostname;}catch{}
  if(!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(u.hostname)||/^\d+(?:\.\d+)+$/.test(u.hostname)||/\.(?:local|internal|localhost|test|invalid|example)$/i.test(u.hostname))return null;
  if(!editorialImageHosts.has(u.hostname)&&u.hostname!==sourceHost)return null;
  if(!/\.(?:jpe?g|png|webp|avif|gif)$/i.test(u.pathname)&&!(u.hostname==='assets.topics.apps-jp.nintendo.com'&&u.pathname.startsWith('/image/')))return null;
  u.hash='';return u.href;
 }catch{return null;}
}
function imageIdentity(value){
 try{const u=new URL(value);return u.hostname+u.pathname;}catch{return null;}
}

// Deliberate editorial marker only; do not guess videos from arbitrary prose.
export function articleVideoUrl(article) {
 return articleContentSegments(article).find(part=>part.type==='video')?.url??null;
}

// Preserve editorial placement, validate every marker and deduplicate by video ID.
export function articleContentSegments(article) {
 const parts=[],seen=new Set(),seenImages=new Set();let lines=[];
 const hero=imageIdentity(article.thumbnail_url)||((String(article.source_name||'').toLowerCase()==='nintendo'&&article.thumbnail_url)?imageIdentity('https://assets.topics.apps-jp.nintendo.com/image/'+String(article.thumbnail_url).replace(/^\/+/,'')):null);
 if(hero)seenImages.add(hero);
 const flush=()=>{const text=lines.join('\n').trim();if(text)parts.push({type:'text',text});lines=[];};
 for(const line of String(article.article_body||article.summary||'').trim().split('\n')){
  const image=line.match(/^公式画像[：:][ \t]*(https:\/\/[^\s｜]+)[ \t]*｜[ \t]*([^\r\n]{1,200})$/);
  if(image){
   const url=editorialImageUrl(image[1],article.source_url);
   if(url){
    flush();const key=imageIdentity(url);
    if(!seenImages.has(key)){parts.push({type:'image',url,caption:image[2].trim()});seenImages.add(key);}
    continue;
   }
  }
  const match=line.match(/^公式動画(リンク)?[：:][ \t]*(https:\/\/\S+)[ \t]*$/);
  const id=match?youtubeVideoId(match[2]):null;
  if(!id){
   const social=line.match(/^公式(?:動画|映像)[（(](X|Instagram|TikTok)[）)](リンク)?[：:][ \t]*(https:\/\/\S+)[ \t]*$/i);
   const post=social?socialVideoPost(social[3]):null;
   if(!post||post.provider!==social[1].toLowerCase()){lines.push(line);continue;}
   flush();const key=post.provider+':'+post.id;
   if(!seen.has(key)){parts.push({type:social[2]?'social-link':'social-video',...post});seen.add(key);}
   continue;
  }
  flush();
  if(!seen.has(id)){parts.push({type:match[1]?'video-link':'video',url:`https://www.youtube.com/watch?v=${id}`});seen.add(id);}
 }
 flush();
 // Compatibility: a video used as the primary source follows the article text.
 const sourceId=youtubeVideoId(article.source_url);
 if(!parts.some(p=>p.type==='video'||p.type==='video-link')&&sourceId)parts.push({type:'video',url:`https://www.youtube.com/watch?v=${sourceId}`});
 return parts;
}
