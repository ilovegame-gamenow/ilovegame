import {youtubeVideoId} from './game-source-utils.js';
import {node} from './release-calendar-client.js';
// Load the official player API once. Direct links remain available if it fails.
let playerApi;
function getPlayerApi() {
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(!playerApi)playerApi=new Promise((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{
   try{previous?.();}finally{resolve(window.YT);}
  };
  const script=document.createElement('script');
  script.src='https://www.youtube.com/iframe_api';
  script.async=true;
  script.onerror=()=>reject(new Error('YouTube API unavailable'));
  document.head.append(script);
 });
 return playerApi;
}
export function officialVideo(title,url){
 const id=youtubeVideoId(url);if(!id)return null;
 const section=node('div',undefined,'official-video'),player=node('div',undefined,'official-video-player');
 const frame=node('iframe');frame.title=`${title} 公式動画`;
 frame.src=`https://www.youtube-nocookie.com/embed/${id}?rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
 frame.loading='lazy';frame.allow='encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
 player.append(frame);section.append(player);
 const link=node('a','YouTubeで公式動画を見る ↗');link.href=`https://www.youtube.com/watch?v=${id}`;link.target='_blank';link.rel='noopener noreferrer';section.append(link);
 // Keep the ordinary iframe and clickable fallback even if the API cannot load.
 const attach=()=>{
  getPlayerApi().then(YT=>{
   if(!frame.isConnected)return;
   let instance;
   instance=new YT.Player(frame,{events:{onError:()=>{
    player.hidden=true;
    link.textContent='記事内で再生できないため YouTubeで公式動画を見る ↗';
    instance?.destroy();
   }}});
  }).catch(()=>{});
 };
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();attach();}
  },{rootMargin:'200px'});
  observer.observe(section);
 }else{setTimeout(attach,0);}
 return section;
}

const socialScripts=new Map();
function loadSocialScript(provider,src,ready){
 if(ready())return Promise.resolve();
 if(!socialScripts.has(provider)){
  socialScripts.set(provider,new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src=src;script.async=true;
   script.onload=()=>{
    const deadline=Date.now()+10000;
    const check=()=>{if(ready())resolve();else if(Date.now()>=deadline)reject(new Error('Embed SDK unavailable'));else setTimeout(check,100);};
    check();
   };
   script.onerror=()=>reject(new Error('Embed SDK unavailable'));
   document.head.append(script);
  }));
 }
 return socialScripts.get(provider);
}
function whenNear(element,fn){
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(e=>e.isIntersecting)){observer.disconnect();fn();}
  },{rootMargin:'200px'});
  observer.observe(element);
 }else setTimeout(fn,0);
}
const socialNames={x:'X',instagram:'Instagram',tiktok:'TikTok'};
export function officialSocialVideo(title,post,linkOnly=false){
 const section=node('div',undefined,'official-video official-social-video');
 const label=socialNames[post.provider];
 const link=node('a',label+'で公式動画を見る ↗');
 link.href=post.url;link.target='_blank';link.rel='noopener noreferrer';
 if(linkOnly){section.append(link);return section;}
 const mount=node('div',undefined,'social-embed social-embed-'+post.provider);
 section.append(mount);section.append(link);
 const unavailable=()=>{
  mount.hidden=true;
  link.textContent='記事内で表示できないため '+label+'で公式動画を見る ↗';
 };
 whenNear(section,()=>{
  if(!section.isConnected)return;
  if(post.provider==='tiktok'){
   const frame=node('iframe');frame.title=title+' TikTok公式動画';
   frame.loading='lazy';frame.allow='encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;
   frame.referrerPolicy='strict-origin-when-cross-origin';
   frame.src='https://www.tiktok.com/player/v1/'+post.id+'?autoplay=0&description=1&music_info=1';
   frame.addEventListener('error',unavailable,{once:true});mount.append(frame);
  }else if(post.provider==='x'){
   loadSocialScript('x','https://platform.x.com/widgets.js',()=>Boolean(window.twttr?.widgets?.createTweet))
    .then(()=>section.isConnected?window.twttr.widgets.createTweet(post.id,mount,{lang:'ja',dnt:true,align:'center',conversation:'none'}):null)
    .then(result=>{if(section.isConnected&&!result)unavailable();}).catch(unavailable);
  }else if(post.provider==='instagram'){
   const quote=node('blockquote',undefined,'instagram-media');
   quote.setAttribute('data-instgrm-permalink',post.url);
   quote.setAttribute('data-instgrm-version','14');
   const placeholder=node('a','Instagramの公式投稿を見る');placeholder.href=post.url;placeholder.target='_blank';placeholder.rel='noopener noreferrer';quote.append(placeholder);mount.append(quote);
   loadSocialScript('instagram','https://www.instagram.com/embed.js',()=>Boolean(window.instgrm?.Embeds?.process))
    .then(()=>{if(section.isConnected)window.instgrm.Embeds.process();}).catch(unavailable);
  }
 });
 return section;
}
