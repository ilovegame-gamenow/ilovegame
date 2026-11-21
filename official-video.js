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
