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

// Deliberate editorial marker only; do not guess videos from arbitrary prose.
export function articleVideoUrl(article) {
 return articleContentSegments(article).find(part=>part.type==='video')?.url??null;
}

// Preserve editorial placement, validate every marker and deduplicate by video ID.
export function articleContentSegments(article) {
 const parts=[],seen=new Set();let lines=[];
 const flush=()=>{const text=lines.join('\n').trim();if(text)parts.push({type:'text',text});lines=[];};
 for(const line of String(article.article_body||article.summary||'').trim().split('\n')){
  const match=line.match(/^公式動画[：:][ \t]*(https:\/\/\S+)[ \t]*$/);
  const id=match?youtubeVideoId(match[1]):null;
  if(!id){lines.push(line);continue;}
  flush();
  if(!seen.has(id)){parts.push({type:'video',url:`https://www.youtube.com/watch?v=${id}`});seen.add(id);}
 }
 flush();
 // Compatibility: a video used as the primary source follows the article text.
 const sourceId=youtubeVideoId(article.source_url);
 if(!seen.size&&sourceId)parts.push({type:'video',url:`https://www.youtube.com/watch?v=${sourceId}`});
 return parts;
}
