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
