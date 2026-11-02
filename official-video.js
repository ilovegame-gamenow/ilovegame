import {youtubeVideoId} from './game-source-utils.js';
import {node} from './release-calendar-client.js';
export function officialVideo(title,url){
 const id=youtubeVideoId(url);if(!id)return null;
 const section=node('div',undefined,'official-video'),player=node('div',undefined,'official-video-player');
 const open=node('button',`${title}の公式トレーラーを記事内で開く ▶`);open.type='button';
 open.addEventListener('click',()=>{
  const frame=node('iframe');frame.title=`${title} 公式トレーラー`;
  frame.src=`https://www.youtube-nocookie.com/embed/${id}?rel=0`;
  frame.allow='encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
  player.replaceChildren(frame);
 },{once:true});
 player.append(open);section.append(player);
 const link=node('a','YouTubeで公式動画を見る ↗');link.href=`https://www.youtube.com/watch?v=${id}`;link.target='_blank';link.rel='noopener noreferrer';section.append(link);
 return section;
}
